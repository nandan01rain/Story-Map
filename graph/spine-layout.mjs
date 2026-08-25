// The spine's layout core. Pure: no DOM, no canvas, no fetch.
//
// This module is the single source of the geometry. scripts/build-spine-prototype.mjs
// inlines it into the prototype page, and scripts/test-spine-layout.mjs imports it
// directly, so the thing under test is the thing that renders.
//
// The one rule the whole file obeys: NOTHING may depend on the order the payload arrays
// happened to arrive in. Every sort carries an id tiebreak, and every map is walked
// through a sorted key list. A layout that changes when the database returns rows in a
// different order is a layout nobody can learn, which is the entire argument for having
// an axis at all.

// ---------------------------------------------------------------------------
// Vocabulary note for anyone rendering this: the field names here (lane, angle,
// ordinal) are internal. None of them may reach a user-visible string. The writer's
// words are Plant, Reveal, Thread, Chapter, Scene, Subplot.
// ---------------------------------------------------------------------------

export const RADIUS = {
  spine: 0,     // chapters and scenes. The axis itself.
  ribbon: 1,    // subplots.
  strand: 2,    // characters.
  thread: 3,    // mythic threads.
};

// Zoom thresholds for the three detail tiers. Read by the renderer, computed here so the
// far view and the near view cannot disagree about which one they are in.
// Tier boundaries, derived from how many DEVICE PIXELS one chapter slot occupies rather
// than from an abstract zoom number. That is the same rule the renderer uses for detail on
// individual marks, applied one level up, and it is the only form that survives a change of
// display or viewport.
//
//   below 18px per chapter -- a chapter is narrower than its own bead, so beads are drawn
//                            on top of one another and the honest thing is a rolled-up band
//   below 54px per chapter -- room for the bead and its scene ticks, but not for a title
//   at or above            -- everything
//
// The earlier 0.3 / 0.9 came from phone-shaped assumptions and rolled up far too early for
// a laptop: at 0.3 a slot was already 56 device pixels wide, which is a slot with room to
// spare being replaced by a band.
export const SLOT_PX = { structure: 18, detail: 54 };

// The flat prototype expresses zoom as a scale over a 150-unit slot; these are SLOT_PX
// converted through that, at the target display density.
export const LOD = {
  bookBands: 0.10,  // below this: book bands and their rollup only
  structure: 0.30,  // below this: chapters and scenes; at or above: everything
};

export function tierForSlotPx(px) {
  if (px < SLOT_PX.structure) return 'books';
  if (px < SLOT_PX.detail) return 'structure';
  return 'detail';
}

export function tierFor(k) {
  if (k < LOD.bookBands) return 'books';
  if (k < LOD.structure) return 'structure';
  return 'detail';
}

// The default visible set. Hidden layers are not a second code path -- they are the same
// layers with visible=false, each reachable by one plainly-worded control.
export const PRESETS = {
  standard: {
    spine: true, bookBands: true, ribbons: true, openMarkers: true,
    detail: true, index: true, lod: true,
    strands: false, round: false, relationships: false, health: false, linking: false,
  },
  full: {
    spine: true, bookBands: true, ribbons: true, openMarkers: true,
    detail: true, index: true, lod: true,
    strands: true, round: true, relationships: false, health: true, linking: true,
  },
};

// There is no project_settings table and no project_type column in any migration, so this
// reads a field the payload does not yet carry and falls back. Wiring it to a real column
// later is a change here and nowhere else.
export function resolvePreset(payload) {
  const name = (payload && payload.settings && payload.settings.complexity) || 'standard';
  return { name: PRESETS[name] ? name : 'standard', visible: { ...(PRESETS[name] || PRESETS.standard) } };
}

const byId = (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

// ---------------------------------------------------------------------------
// The axis
// ---------------------------------------------------------------------------

// One number per chapter, 1..N, with an id tiebreak so two chapters claiming the same slot
// still land in a fixed order. Both rollups are built in this same pass: the far view, the
// band label and any health badge must be reading one number, not three that drift.
//
// Two orderings of the same chapters:
//
//   'read'  -- (book, act, order). The order a reader meets them. The default, and the one
//              every other coordinate has been derived from up to now.
//   'story' -- the order the events happened in, from the nullable storyTime field.
//
// storyTime is deliberately nullable and deliberately sparse. Most chapters do not need a
// time; what matters is that linearity is preserved. So an unmarked chapter CARRIES FORWARD
// the time of the last marked chapter before it in reading order, and ties are broken by
// reading order. A run of unmarked chapters therefore stays in the sequence it was written,
// attached to whatever moment last placed it -- which is exactly how a flashback behaves:
// mark the chapter that jumps, and everything following it comes along until something says
// otherwise.
//
// Chapters before ANY marked chapter carry -Infinity, so they stay at the front in reading
// order rather than being flung to the end by a missing value.
export function storyKeys(chapters) {
  const reading = chapters.slice().sort(
    (a, b) => (a.book - b.book) || (a.act - b.act) || (a.seq - b.seq) || byId(a, b),
  );
  const eff = {};
  let carried = -Infinity;
  let marked = 0;
  reading.forEach((c) => {
    const t = c.storyTime;
    if (t !== null && t !== undefined && t !== '' && !Number.isNaN(Number(t))) {
      carried = Number(t);
      marked += 1;
    }
    eff[c.id] = carried;
  });
  const readingIndex = {};
  reading.forEach((c, i) => { readingIndex[c.id] = i; });
  return { eff, readingIndex, marked, reading };
}

export function computeAxis(chapters, flags, openBy, order = 'read') {
  const keys = storyKeys(chapters);
  const sorted = order === 'story'
    ? chapters.slice().sort(
      (a, b) => (keys.eff[a.id] - keys.eff[b.id]) || (keys.readingIndex[a.id] - keys.readingIndex[b.id]))
    : keys.reading.slice();
  const ordinal = {};
  sorted.forEach((c, i) => { ordinal[c.id] = i + 1; });

  const rollup = (keyOf, label) => {
    const out = [];
    let current = null;
    sorted.forEach((c, i) => {
      const key = keyOf(c);
      if (!current || current.key !== key) {
        current = {
          key, label: label(c), book: c.book, act: c.act,
          from: i + 1, to: i + 1, chapters: 0, words: 0,
          flags: 0, open: 0, unresolvedAtEnd: 0,
        };
        out.push(current);
      }
      current.to = i + 1;
      current.chapters += 1;
      current.words += c.words || 0;
      current.open += (openBy[c.id] || 0);
    });
    return out;
  };

  // Bands are labelled by their ACTUAL act number, never by position in the book. Acts are
  // inferred from whatever distinct integers exist, so a book whose first act is Act 2 is
  // the schema working, not an error -- renumbering it or validating against it would make
  // a legitimate outline state look like a fault.
  const acts = rollup((c) => c.book + ':' + c.act, (c) => 'Book ' + (c.book + 1) + ' · Act ' + c.act);
  const books = rollup((c) => String(c.book), (c) => 'Book ' + (c.book + 1));

  const bucket = (list) => {
    const at = {};
    list.forEach((r) => { for (let o = r.from; o <= r.to; o++) at[o] = r; });
    return at;
  };
  const actAt = bucket(acts);
  const bookAt = bucket(books);
  flags.slice().sort(byId).forEach((f) => {
    const o = ordinal[f.chapterId];
    if (actAt[o]) actAt[o].flags += 1;
    if (bookAt[o]) bookAt[o].flags += 1;
  });

  return {
    ordinal, sorted, acts, books, actAt, bookAt, slots: sorted.length,
    farTier: chooseFarTier(books, acts, sorted.length),
    order,
    // How many chapters actually carry a time. Zero means the story ordering is identical
    // to the reading one, and the control offering it should say so rather than pretending
    // to a second view that does not exist yet.
    storyTimesSet: keys.marked,
  };
}

// Which level the far view rolls up to. NOT always books: on real material one book was 41
// of 52 chapters, so a book-level far tier drew one band over four-fifths of the axis and
// called it a summary. A far view whose largest band is most of the saga has not summarised
// anything.
//
// Rule: take books when they divide the axis usefully -- at least three bands, and no band
// larger than DOMINANT of the whole. Otherwise drop to acts, which is the finer level that
// still isn't chapters. Reported on the axis so the renderer and any badge agree.
export const FAR_TIER = { minBands: 3, maxBands: 14, dominant: 0.4 };

export function chooseFarTier(books, acts, slots) {
  const workable = (bands) => {
    if (bands.length < FAR_TIER.minBands || bands.length > FAR_TIER.maxBands) return false;
    const largest = Math.max(...bands.map((b) => b.chapters));
    return largest / slots <= FAR_TIER.dominant;
  };
  if (workable(books)) return 'books';
  if (workable(acts)) return 'acts';
  // Neither divides it well: prefer whichever has more bands without exceeding the cap,
  // because too few bands hides more than too many crowds.
  return acts.length > books.length && acts.length <= FAR_TIER.maxBands ? 'acts' : 'books';
}

// ---------------------------------------------------------------------------
// Groupings -- a grouping is a subplot
// ---------------------------------------------------------------------------

export function buildGroupings(flags) {
  const groups = {};
  const membershipsOf = (f) =>
    (f.pairs && f.pairs.length) ? f.pairs.slice() : [{ id: 'solo:' + f.id, label: '' }];

  flags.slice().sort(byId).forEach((f) => {
    membershipsOf(f).slice().sort((a, b) => (a.id < b.id ? -1 : 1)).forEach((m) => {
      if (!groups[m.id]) groups[m.id] = { id: m.id, label: m.label || '', plants: [], reveals: [], notes: [] };
      if (!groups[m.id].label && m.label) groups[m.id].label = m.label;
      if (f.type === 'plant') groups[m.id].plants.push(f);
      else if (f.type === 'reveal') groups[m.id].reveals.push(f);
      else groups[m.id].notes.push(f);
    });
  });
  return { groups, membershipsOf };
}

// Three rules for the same question, kept separate on purpose.
//
//   groupings  -- a plant is open when no grouping it belongs to holds a reveal.
//   hardLink   -- a plant is open when no reveal carries a linkedPlant pointing at it.
//   ledger     -- what index.html's renderLedger actually prints.
//
// hardLink and ledger are the SAME rule: renderLedger resolves paid/open through
// findRevealForPlant, which matches on linkedPlant and nothing else. They are reported
// separately anyway, because "the Ledger agrees" is only meaningful if it was asked.
export function openPlantRules(flags) {
  const { groups, membershipsOf } = buildGroupings(flags);

  const openByGroupings = (f) => {
    if (f.type !== 'plant') return false;
    const ms = (f.pairs && f.pairs.length) ? f.pairs : [];
    if (!ms.length) return true;
    return !ms.some((m) => groups[m.id] && groups[m.id].reveals.length > 0);
  };

  const linked = {};
  flags.forEach((f) => {
    if (f.type === 'reveal' && f.linkedPlant) linked[f.linkedPlant.annotationId] = true;
  });
  const openByHardLink = (f) => f.type === 'plant' && !linked[f.id];

  const plants = flags.filter((f) => f.type === 'plant');
  return {
    groups, membershipsOf, openByGroupings, openByHardLink,
    counts: {
      total: plants.length,
      groupings: plants.filter(openByGroupings).length,
      hardLink: plants.filter(openByHardLink).length,
      ledger: plants.filter(openByHardLink).length,
    },
  };
}

// ---------------------------------------------------------------------------
// Interval packing -- lanes, and the same packing wrapped onto a circle
// ---------------------------------------------------------------------------

// Greedy packing over sorted intervals: an item takes the lowest lane whose last occupant
// ended before it starts. Concurrent items get distinct lanes; non-concurrent ones reuse.
//
// Allocation always runs over the UNFILTERED set. Filtering sets visibility and leaves the
// gap, because greedy packing is not stable under removal -- hiding one ribbon would
// repack every lane after it, and a filter that rearranges the picture is not a filter.
export function allocateLanes(intervals) {
  const sorted = intervals.slice().sort(
    (a, b) => (a.start - b.start) || (a.end - b.end) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
  const lastEnd = [];
  const lane = {};
  sorted.forEach((iv) => {
    let l = 0;
    while (l < lastEnd.length && lastEnd[l] >= iv.start) l += 1;
    lane[iv.id] = l;
    lastEnd[l] = iv.end;
  });
  return { lane, count: Math.max(1, lastEnd.length) };
}

// Incremental packing. The reason this exists: a full repack moves 17 of 21 lanes on a
// single chapter reorder, which is a routine editing action. A spine whose X is stable and
// whose Y reshuffles has not delivered stable coordinates -- it has delivered half of them,
// and the half a reader builds memory on is the one that moved.
//
// Standard incremental interval colouring: keep every prior assignment that is still
// conflict-free, evict only genuine conflicts, and give the evicted and the new the lowest
// free lane. Deterministic throughout -- when two kept intervals collide, the one that
// starts earlier keeps the lane, id breaking the tie, never insertion order.
//
// previous: { lane: {id: n}, count: n } from the last run, or null for a cold start.
//
// THE DENOMINATOR ONLY GROWS, AND ONLY A PERSON MAY RESET IT. Growth is monotone because
// shrinking rotates every ribbon that did not move. But monotone growth over a long editing
// life means slot width narrows permanently and never recovers, so the 26-slot ceiling
// arrives earlier than peak concurrency alone would predict -- a project that once had 30
// concurrent subplots keeps paying for it after they close.
//
// The reset is therefore an explicit action (repack: true), never a silent heuristic. A
// layout that quietly re-packs itself when it judges the drift bad enough is a layout that
// rearranges without being asked, which is the thing this whole design exists to stop.
// repackAdvised() below is what a "Tidy up" control should light up on; it decides nothing.
export function repackAdvised(previous, ribbons) {
  if (!previous || !previous.count) return false;
  const needed = Math.max(1, ...ribbons.map((r) => (previous.lane[r.id] || 0) + 1));
  return previous.count > Math.max(4, needed * 1.5);
}

export function allocateLanesIncremental(intervals, previous) {
  if (!previous || !previous.lane) {
    const fresh = allocateLanes(intervals);
    return { ...fresh, kept: 0, moved: intervals.length, grew: false };
  }

  const sorted = intervals.slice().sort(
    (a, b) => (a.start - b.start) || (a.end - b.end) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
  const overlaps = (a, b) => !(a.end < b.start || b.end < a.start);

  // Pass one: provisionally keep prior lanes, evicting on collision.
  const inLane = new Map();          // lane -> intervals settled there
  const evicted = [];
  let kept = 0;
  for (const iv of sorted) {
    const prior = previous.lane[iv.id];
    if (prior === undefined) { evicted.push(iv); continue; }
    const occupants = inLane.get(prior) || [];
    if (occupants.some((o) => overlaps(o, iv))) { evicted.push(iv); continue; }
    occupants.push(iv);
    inLane.set(prior, occupants);
    kept += 1;
  }

  // Pass two: the evicted and the new take the lowest lane with room.
  const lane = {};
  for (const [l, occupants] of inLane) for (const iv of occupants) lane[iv.id] = l;
  for (const iv of evicted) {
    let l = 0;
    for (;;) {
      const occupants = inLane.get(l) || [];
      if (!occupants.some((o) => overlaps(o, iv))) {
        occupants.push(iv); inLane.set(l, occupants); lane[iv.id] = l; break;
      }
      l += 1;
    }
  }

  // The angular denominator only ever grows. Shrinking it would rotate every ribbon that
  // did not move, and on a cylinder that reads as ribbons jumping across the seam -- worse
  // than the lane churn this whole function exists to avoid. A growth is a one-time reflow
  // and is reported rather than hidden.
  const needed = Math.max(1, ...Object.values(lane).map((l) => l + 1));
  const count = Math.max(previous.count || 1, needed);
  return { lane, count, kept, moved: evicted.length, grew: count > (previous.count || 1) };
}

// How many concurrent ribbons the circle can carry before adjacent slots stop being
// separable at rest. This is NOT the same as how many it can hold: a circle has a finite
// circumference exactly as a column has a finite height, and wrapping defers exhaustion
// rather than removing it.
//
// The binding constraint is the projection, not the circumference. Offset is r*cos(theta),
// so separation between neighbouring slots collapses toward the front and back of the
// cylinder -- to first order r*(dtheta^2)/2 there, against r*dtheta at the sides. The
// front is exactly where the reader is looking.
export function angularCeiling(radius, minSeparationPx = 6) {
  const worst = (n) => radius * Math.pow((Math.PI * 2) / n, 2) / 2;   // front/back, worst case
  const best = (n) => radius * ((Math.PI * 2) / n);                   // sides, best case
  let n = 2;
  while (n < 500 && worst(n + 1) >= minSeparationPx) n += 1;
  return { readable: n, worstAt: worst(n), bestAt: best(n), minSeparationPx, radius };
}

// The braid is a LAPTOP-FIRST surface, meant for long structural sessions. An earlier
// version of this derived its numbers against a 390px phone held in portrait, which was
// simply the wrong device: it produced a ceiling of 26 that was never the real constraint.
//
// Usable height, not window height. The axis is locked horizontal, so the cylinder's
// diameter has to fit the SHORT dimension, and the bar and the scrubber take some of it.
export const TARGET = {
  width: 1440,
  height: 900,
  usableHeight: 760,     // 900 less the bar, the scrubber and a margin
  minSeparationPx: 6,
};

// Concurrency the circle can carry at a given usable height.
//
// Separation between neighbouring slots is worst at the front and back of the cylinder,
// where it goes as r*(dTheta^2)/2. With the diameter filling the usable height, r = H/2 and
// dTheta = 2*PI/n, so the separation is H*PI^2/n^2 and the ceiling falls out directly:
//
//     n <= PI * sqrt(H / minSeparation)
//
// which is where both the old phone figure and the new laptop one come from -- the formula
// did not change, only the H it was asked about.
export function angularCeilingForViewport(usableHeightPx = TARGET.usableHeight,
                                          minSeparationPx = TARGET.minSeparationPx) {
  const n = Math.floor(Math.PI * Math.sqrt(usableHeightPx / minSeparationPx));
  return {
    readable: n,
    usableHeightPx,
    minSeparationPx,
    separationAt: (k) => (usableHeightPx * Math.PI * Math.PI) / (k * k),
  };
}

// The inverse: the usable height a given concurrency would need. Quadratic in concurrency,
// which is the part that matters -- doubling how many ribbons must be separable at the
// silhouette costs four times the height, so wrapping buys a little and then stops.
export function heightFor(concurrency, minSeparationPx = TARGET.minSeparationPx) {
  const height = (minSeparationPx * concurrency * concurrency) / (Math.PI * Math.PI);
  return {
    concurrency, minSeparationPx,
    usableHeightPx: height,
    fitsTarget: height <= TARGET.usableHeight,
    windowHeightNeeded: height + (TARGET.height - TARGET.usableHeight),
    growth: 'usable height grows with the square of concurrency',
  };
}

// Kept for the world-space form, which the renderer still uses when it needs a radius
// rather than a viewport.
export function radiusFor(concurrency, minSeparationPx = TARGET.minSeparationPx,
                          viewportPx = TARGET.usableHeight) {
  const dTheta = (Math.PI * 2) / concurrency;
  const radius = (2 * minSeparationPx) / (dTheta * dTheta);
  return {
    concurrency, radius, diameter: radius * 2, viewportPx,
    fits: radius * 2 <= viewportPx,
    growth: 'radius grows with the square of concurrency',
  };
}

// The circle is the same packing, wrapped. Concurrent ribbons take distinct angular slots;
// non-concurrent ones reuse them. Ordering inside a concurrent set follows the greedy walk,
// which is opening order -- so at any slice of the axis, going round the cylinder still
// goes forward through openings.
//
// WHY WRAP AT ALL -- corrected, and the old reason should not be quoted again. This was
// originally justified by lane exhaustion: a column has finite height, a circle does not.
// That justification is wrong. angularCeiling() puts the readable limit at 26 concurrent
// against a flat chart's ~21, so wrapping buys about five slots. It is a rounding error,
// not a scaling strategy, and radiusFor() shows why: the radius needed grows with the
// SQUARE of concurrency, so the escape closes rather than opens.
//
// What actually justifies wrapping is that unrolling this yields the lane packing exactly.
// Flatten is a projection of one geometry rather than a switch between two layouts, which
// gives a second, stable reading of the same axis and keeps both postures learnable.
// (Ranking angle globally instead would have given one lane per ribbon saga-wide once
// unrolled, which is unusable -- so the packing is load-bearing for Flatten specifically.)
//
// Consequence worth stating plainly: no layout choice escapes the granularity question. If
// concurrency on real material is anywhere near what this fixture shows, ribbons-as-pairs
// is unrenderable flat AND wrapped, and the answer has to come from the data model or from
// what the default view chooses to draw.
//
// The +PI and the half-slot put the wrap point -- where the highest slot meets slot 0 --
// at the back of the cylinder, so the seam sits behind the camera at rest and the unroll
// does not tear across the middle of the picture.
export function anglesFromLanes(lane, count) {
  const angle = {};
  Object.keys(lane).sort().forEach((id) => {
    angle[id] = Math.PI + ((lane[id] + 0.5) / count) * Math.PI * 2;
  });
  return angle;
}

// ---------------------------------------------------------------------------
// Ribbons and strands
// ---------------------------------------------------------------------------

// A ribbon spans from its earliest plant to its latest reveal. An open ribbon has no far
// end: it runs to the end of the saga, because that is the stretch of axis it actually
// occupies, and packing it as a point would let a later ribbon sit on top of it.
export function buildRibbons(flags, axis, rules) {
  const { groups } = rules;
  const out = [];
  Object.keys(groups).sort().forEach((id) => {
    const g = groups[id];
    if (!g.plants.length && !g.reveals.length) return;      // a note-only grouping is not a subplot
    if (id.indexOf('solo:') === 0) return;
    const ords = (list) => list.map((f) => axis.ordinal[f.chapterId]).filter((o) => !!o);
    const plantOrds = ords(g.plants);
    const revealOrds = ords(g.reveals);
    if (!plantOrds.length && !revealOrds.length) return;
    // The span covers EVERY member, not plants-then-reveals. An earlier version took
    // start from the plants and end from the reveals and then clamped end to be at least
    // start -- which silently collapsed to a point any grouping whose reveal is READ
    // BEFORE its plant. That is not a corner case: it is what a flashback is. A payoff
    // that lands before its setup is a legitimate and deliberate structure, and the
    // picture has to be able to draw it.
    const allOrds = plantOrds.concat(revealOrds);
    const open = revealOrds.length === 0;
    const start = Math.min(...allOrds);
    const end = open ? axis.slots : Math.max(...allOrds);

    // True when the first reveal is read before the first plant. Reported rather than
    // corrected: the writer meant it.
    const reversed = !open && plantOrds.length > 0 && revealOrds.length > 0
      && Math.min(...revealOrds) < Math.min(...plantOrds);

    // How many books it crosses. NEUTRAL INFORMATION, never a warning: a setup planted in
    // Book I and paid in Book IV is the saga working as intended, and anything that treats
    // distance as a defect will be switched off within a week.
    const booksCrossed = new Set();
    for (let o = start; o <= end; o++) {
      const b = axis.bookAt[o];
      if (b) booksCrossed.add(b.key);
    }

    out.push({
      id, label: g.label || 'Untitled subplot',
      start, end, open, reversed,
      spansBooks: booksCrossed.size,
      plants: g.plants.map((f) => f.id), reveals: g.reveals.map((f) => f.id),
    });
  });
  return out;
}

// A strand is a character's run through the saga. Two predicates, and they are NOT the
// same thing:
//
//   'event'   -- the app's: presence rows against event nodes carrying properties.chapter_id.
//   'fixture' -- the demo generator's: POV, plus relationships scoped to a chapter. It
//                understates and never invents, so fixture strand density says nothing
//                about real strand density.
//
// Either way a gap means NO EVENT RECORDED, not "character absent". That is why a strand
// renders as a continuous ghost line with beads on it: the line asserts the character
// exists across the span, the beads assert only where something was logged.
export function buildStrands(payload, axis, predicate = 'event') {
  const eventChapter = {};
  (payload.events || []).forEach((ev) => {
    const cid = (ev.properties || {}).chapter_id;
    if (cid) eventChapter[ev.id] = cid;
  });

  const beadsBy = {};
  (payload.presence || []).slice()
    .sort((a, b) => (a.character < b.character ? -1 : a.character > b.character ? 1 : (a.event < b.event ? -1 : 1)))
    .forEach((p) => {
      const cid = eventChapter[p.event];
      if (predicate === 'event' && !cid) return;
      const o = axis.ordinal[cid];
      if (!o) return;
      (beadsBy[p.character] = beadsBy[p.character] || []).push({ ord: o, isPov: !!p.isPov });
    });

  const out = [];
  Object.keys(beadsBy).sort().forEach((cid) => {
    const beads = beadsBy[cid].slice().sort((a, b) => a.ord - b.ord);
    const node = (payload.nodes || []).find((n) => n.id === cid);
    out.push({
      id: cid, label: (node && node.label) || cid,
      start: beads[0].ord, end: beads[beads.length - 1].ord,
      beads,
      coverage: beads.length / Math.max(1, axis.slots),
    });
  });
  return out;
}

// The gate the unreliable signals are meant to sit behind. Below this, the event log is
// too thin for any absence-based claim to mean anything.
export function strandDensity(strands, axis) {
  if (!strands.length) return { ok: false, mean: 0, reason: 'no characters have logged events' };
  const mean = strands.reduce((a, s) => a + s.coverage, 0) / strands.length;
  return {
    ok: mean >= 0.5, mean,
    reason: mean >= 0.5 ? 'dense enough for absence-based signals'
      : 'too sparse: an absence here means no event was logged, not that anyone left',
  };
}

// A mythic thread is the one structure explicitly built to recur across the WHOLE saga --
// many-to-many, book after book. Until now its touches were drawn as loose note markers with
// nothing joining them, so the single feature designed for saga-length recurrence was the
// one feature with no span at all. A thread with two or more touches now gets an arc like a
// subplot's, in its own radius class so it never competes with one for a lane.
export function buildThreads(flags, axis) {
  const byName = {};
  flags.forEach((f) => {
    if (f.type !== 'note' || !f.thread) return;
    const o = axis.ordinal[f.chapterId];
    if (!o) return;
    (byName[f.thread] = byName[f.thread] || []).push({ id: f.id, ord: o, characterId: f.characterId });
  });

  const out = [];
  Object.keys(byName).sort().forEach((name) => {
    const touches = byName[name].slice().sort((a, b) => a.ord - b.ord || (a.id < b.id ? -1 : 1));
    // One touch is not yet a recurrence. It stays a note; drawing an arc from a point to
    // itself would claim a pattern the prose has not made.
    if (touches.length < 2) return;
    const start = touches[0].ord, end = touches[touches.length - 1].ord;
    const booksCrossed = new Set();
    for (let o = start; o <= end; o++) {
      const b = axis.bookAt[o];
      if (b) booksCrossed.add(b.key);
    }
    out.push({
      id: 'thread:' + name, label: name, start, end,
      touches: touches.map((t) => t.id),
      characterId: (touches.find((t) => t.characterId) || {}).characterId || null,
      spansBooks: booksCrossed.size,
    });
  });
  return out;
}

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------

// Deterministic structural signals, computed in the axis pass so the badge, the band label
// and the far view are one number. Each carries its own reliability, in the data, not in a
// comment -- the renderer must be able to tell a hard signal from a guess.
//
// Dismissals are read from the annotation itself -- health_dismissed on the flag, in the
// chapters.annotations jsonb the editor already writes. Not view state and not device
// state: this is a multi-device app over one Supabase project, and a dismissal that lives
// on the laptop means the same signal reappears on the phone, which is precisely the
// behaviour that teaches a writer to ignore every badge.
//
// options.dismissals is an overlay for things that are not annotations (a ribbon is a
// grouping, not a row) and for tests. Anything annotation-shaped should be persisted on
// the annotation, not passed in here.
//
// NOTE, unresolved: a defer and a dismissal are NOT the same act. "Not due yet" is
// time-bounded and expected to come back; "deliberate" is permanent. They should share one
// store keyed by subject with a kind, so there is one list to maintain rather than two --
// but they must not collapse into one flag. See the report; awaiting a decision.
function dismissedOnAnnotation(f) {
  return !!(f && f.health_dismissed);
}
export function computeHealth(payload, axis, rules, ribbons, strands, dismissals = {}) {
  const signals = [];
  const chapterById = {};
  (payload.chapters || []).forEach((c) => { chapterById[c.id] = c; });
  const drafted = (cid) => {
    const s = (chapterById[cid] || {}).status;
    return s === 'drafted' || s === 'final';
  };

  const flagById = {};
  (payload.flags || []).forEach((f) => { flagById[f.id] = f; });
  const push = (s) => {
    if (dismissals[s.subject]) return;
    if (dismissedOnAnnotation(flagById[s.subject])) return;
    signals.push(s);
  };

  // RELIABLE -- hard-link/grouping absence, no strand dependency.
  payload.flags.slice().sort(byId).forEach((f) => {
    if (rules.openByGroupings(f)) {
      push({
        kind: 'open-plant', reliability: 'reliable', subject: f.id,
        ord: axis.ordinal[f.chapterId], chapterId: f.chapterId,
        text: 'Plant with nothing claiming it yet',
      });
    }
    // An unlinked Reveal usually means not-yet-linked rather than orphan, so a second
    // condition is required before this asserts anything: the chapter has to be written.
    if (f.type === 'reveal' && (!f.pairs || !f.pairs.length) && drafted(f.chapterId)) {
      push({
        kind: 'unlinked-reveal', reliability: 'reliable', subject: f.id,
        ord: axis.ordinal[f.chapterId], chapterId: f.chapterId,
        text: 'Reveal in a written chapter that is not joined to a Plant',
      });
    }
  });

  // RELIABLE -- flag density per chapter, against the saga's own median rather than a
  // constant, so a densely-flagged writer is not permanently in the red.
  const perChapter = {};
  payload.flags.forEach((f) => { perChapter[f.chapterId] = (perChapter[f.chapterId] || 0) + 1; });
  const counts = axis.sorted.map((c) => perChapter[c.id] || 0).sort((a, b) => a - b);
  const median = counts.length ? counts[Math.floor(counts.length / 2)] : 0;
  axis.sorted.forEach((c) => {
    const n = perChapter[c.id] || 0;
    if (median > 0 && n >= median * 3) {
      push({
        kind: 'flag-density', reliability: 'reliable', subject: c.id,
        ord: axis.ordinal[c.id], chapterId: c.id,
        text: n + ' flags here against a saga median of ' + median,
      });
    }
  });

  // WITHDRAWN: 'unresolved-at-book-end'.
  //
  // It fired whenever an open subplot's book ended before the saga did. But subplots,
  // plants, reveals and threads are all expected to span several books -- a plant sown in
  // Book I and paid in Book IV is the design, not a defect. The signal would therefore have
  // fired on nearly every deliberate long-range setup, which is the "lights up the whole
  // saga on first run and gets switched off permanently" failure this overlay set has
  // already been warned about once.
  //
  // What remains true and is already said once, by 'open-plant': nothing claims this yet.
  // Distance is reported as ribbon.spansBooks, which is information rather than a warning.

  // UNRELIABLE -- both of these accuse the writer of dropping a character who simply has
  // no logged events. Computed so the gate can be reported, emitted only if it passes.
  const density = strandDensity(strands, axis);
  const deferred = [];
  strands.forEach((s) => {
    let prev = null;
    s.beads.forEach((b) => {
      if (prev !== null && b.ord - prev > Math.max(3, Math.floor(axis.slots / 4))) {
        deferred.push({
          kind: 'long-absence', reliability: 'unreliable', subject: s.id + ':' + prev,
          ord: prev, chapterId: null,
          text: s.label + ' is unseen from ' + prev + ' to ' + b.ord,
        });
      }
      prev = b.ord;
    });
    if (s.start > Math.max(2, Math.floor(axis.slots / 3))) {
      deferred.push({
        kind: 'late-arc', reliability: 'unreliable', subject: s.id + ':late',
        ord: s.start, chapterId: null,
        text: s.label + ' first appears late',
      });
    }
  });
  if (density.ok) deferred.forEach(push);

  return {
    signals,
    withheld: density.ok ? [] : deferred,
    density,
    // REJECTED, deliberately not built. Several reveals landing in one chapter is a
    // climax, not a defect, and at the concurrency this material actually shows it would
    // fire constantly and accuse deliberate craft of being a fault. If convergence is
    // worth seeing it belongs on the spine as a neutral mark, never in the health set.
    subplotCollision: null,
  };
}

// ---------------------------------------------------------------------------
// The one entry point
// ---------------------------------------------------------------------------

export function computeSpine(payload, options = {}) {
  const all = (payload.flags || []).slice();

  // An unanchorable annotation has no flagged substring, so there is no position on the
  // axis it could occupy. It is excluded from the layout and from health -- a signal
  // pointing at nothing is worse than no signal -- but it is COUNTED, so a client can say
  // "3 annotations cannot be placed" instead of quietly showing fewer than the writer made.
  // Before the 20260825 migration these never arrived at all.
  const unanchorable = all.filter((f) => f.unanchorable);
  const flags = all.filter((f) => !f.unanchorable);
  const rules = openPlantRules(flags);

  const openBy = {};
  flags.forEach((f) => {
    if (rules.openByGroupings(f)) openBy[f.chapterId] = (openBy[f.chapterId] || 0) + 1;
  });

  const axis = computeAxis(payload.chapters || [], flags, openBy, options.order || 'read');
  const ribbons = buildRibbons(flags, axis, rules);
  const strands = buildStrands(payload, axis, options.predicate || 'event');
  const threads = buildThreads(flags, axis);

  // options.previous carries the last run's assignments, per class, so a routine edit moves
  // a handful of ribbons instead of reshuffling the picture. Absent, this is a cold start.
  // options.repack discards the prior assignment on purpose -- the explicit "tidy up", the
  // only way the angular denominator ever comes back down.
  const prior = options.repack ? {} : (options.previous || {});
  const ribbonPack = allocateLanesIncremental(ribbons, prior.ribbon);
  const strandPack = allocateLanesIncremental(strands, prior.strand);
  const threadPack = allocateLanesIncremental(threads, prior.thread);

  const health = computeHealth({ ...payload, flags }, axis, rules, ribbons, strands, options.dismissals || {});

  return {
    axis,
    ribbons: ribbons.map((r) => ({
      ...r, radius: RADIUS.ribbon,
      lane: ribbonPack.lane[r.id], angle: anglesFromLanes(ribbonPack.lane, ribbonPack.count)[r.id],
    })),
    strands: strands.map((s) => ({
      ...s, radius: RADIUS.strand,
      lane: strandPack.lane[s.id], angle: anglesFromLanes(strandPack.lane, strandPack.count)[s.id],
    })),
    threads: threads.map((t) => ({
      ...t, radius: RADIUS.thread,
      lane: threadPack.lane[t.id], angle: anglesFromLanes(threadPack.lane, threadPack.count)[t.id],
    })),
    laneCounts: { ribbon: ribbonPack.count, strand: strandPack.count, thread: threadPack.count },
    // Hand this back as options.previous on the next run. This is what makes the layout
    // incremental; without persisting it, every rebuild is a cold start.
    assignment: {
      ribbon: { lane: ribbonPack.lane, count: ribbonPack.count },
      strand: { lane: strandPack.lane, count: strandPack.count },
      thread: { lane: threadPack.lane, count: threadPack.count },
    },
    churn: {
      ribbon: { kept: ribbonPack.kept, moved: ribbonPack.moved, grew: ribbonPack.grew },
      strand: { kept: strandPack.kept, moved: strandPack.moved, grew: strandPack.grew },
    },
    ceiling: angularCeilingForViewport(),
    repackAdvised: repackAdvised(prior.ribbon, ribbons),
    openCounts: rules.counts,
    unanchorable: { count: unanchorable.length, ids: unanchorable.map((f) => f.id) },
    health,
    preset: resolvePreset(payload),
  };
}
