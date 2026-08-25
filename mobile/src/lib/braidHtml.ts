// GENERATED FILE - do not edit by hand.
// Rebuild with: node scripts/build-braid-3d.mjs --embed
//
// The braid, as one document. The PWA loads braid.html in an iframe; the phone loads
// this string in a WebView. Neither carries data: both post it in after the page says
// it is ready, which is the handshake the character web used before it.
export const BRAID_HTML = String.raw`<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>StoryMap — the braid</title>
<style>
  /* A loom, not an instrument panel. The ground is a deep warm dark rather than neutral
     black: black plus saturated line is the trading-terminal signature, and this app
     already has a material language (the painted map, the Margin's parchment) that the
     braid was the only surface ignoring. */
  :root {
    --ground: #03060d;
    --ink: #f0c464;
    --quiet: #a8813a;
    --rule: rgba(242,185,60,0.18);
    --accent: #f2b93c;
    --book: Georgia, "Iowan Old Style", Palatino, "Palatino Linotype", serif;
    --ui: -apple-system, "Segoe UI", system-ui, sans-serif;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; height: 100%; overflow: hidden; background: var(--ground);
    font: 12px/1.5 var(--ui); color: var(--ink); }
  canvas { display: block; }
  #stage { position: fixed; inset: 0; }

  /* Marginalia, not a control room: no panel borders, no fills, no switches. */
  .panel { position: fixed; background: none; border: 0; padding: 0; }
  .panel h3 { margin: 0 0 6px; font-size: 9.5px; letter-spacing: .16em; text-transform: uppercase;
    color: var(--quiet); font-weight: 600; }

  /* One thin bar. Everything that was a floating panel is a dropdown inside it, so the
     braid gets the screen and the controls get a single line of it. */
  #bar { position: fixed; top: 0; left: 0; right: 0; height: 40px; display: flex;
    align-items: center; gap: 18px; padding: 0 18px; z-index: 5;
    background: linear-gradient(var(--ground), rgba(3,6,13,0)); }
  #brand { font-family: var(--book); font-size: 15px; letter-spacing: .03em; white-space: nowrap; }
  #brand b { font-weight: 400; }
  #brand span { color: var(--quiet); font-family: var(--ui); font-size: 10.5px; margin-left: 10px; }
  #bar nav { margin-left: auto; display: flex; gap: 16px; }

  .dd { position: relative; }
  .dd > summary { list-style: none; cursor: pointer; color: var(--quiet); font-size: 12px;
    padding: 4px 0; white-space: nowrap; }
  .dd > summary::-webkit-details-marker { display: none; }
  .dd > summary:hover { color: var(--ink); }
  .dd[open] > summary { color: var(--accent); }
  .pop { position: absolute; right: 0; top: 26px; min-width: 168px; padding: 10px 12px;
    background: var(--pop); border: 1px solid var(--rule); border-radius: 4px; }
  .pop.wide { width: 260px; max-height: 46vh; display: flex; flex-direction: column; }
  .row { padding: 3px 0; cursor: pointer; font-size: 12px; color: var(--quiet); white-space: nowrap; }
  .row:hover { color: var(--ink); }
  .row.on { color: var(--accent); }
  .row.on::before { content: "\00b7 "; }
  .note { color: var(--quiet); font-size: 10.5px; margin-top: 8px; line-height: 1.4; opacity: .75; }
  button { width: auto; background: none; color: var(--quiet); border: 0; padding: 3px 0;
    font: inherit; font-size: 12px; cursor: pointer; display: block; }
  button:hover { color: var(--accent); }
  .toggle { cursor: pointer; padding: 3px 0; color: var(--quiet); font-size: 12px; }
  .toggle:hover { color: var(--ink); }
  .toggle.on { color: var(--accent); }
  .toggle.on::before { content: "\00b7 "; }
  .toggle.dim { opacity: .45; cursor: default; }
  #how ul { margin: 0; padding: 0; list-style: none; }
  #how li { margin: 3px 0; font-size: 11px; color: var(--quiet); }
  #tabs { display: flex; gap: 10px; margin-bottom: 6px; flex-wrap: wrap; }
  #tabs button { display: inline; font-size: 11px; }
  #tabs button.on { color: var(--accent); }
  #ilist { overflow: auto; }
  .item { padding: 2px 0; cursor: pointer; font-size: 11.5px; color: var(--quiet);
    display: flex; justify-content: space-between; gap: 10px; }
  .item:hover { color: var(--ink); }
  .item span { opacity: .55; }

  .panel { position: fixed; background: none; border: 0; padding: 0; }
  #detail { left: 20px; bottom: 20px; width: 300px; display: none; }
  #detail.on { display: block; }
  #detail h2 { margin: 0 0 3px; font-family: var(--book); font-size: 16px; font-weight: 400;
    color: var(--ink); line-height: 1.25; }
  #detail .sub { color: var(--quiet); font-size: 10px; letter-spacing: .1em;
    text-transform: uppercase; margin-bottom: 9px; }
  #detail dl { margin: 0; display: grid; grid-template-columns: auto 1fr; gap: 3px 14px;
    font-size: 12px; }
  #detail dt { color: var(--quiet); }
  #detail dd { margin: 0; }
  #dclose { position: absolute; top: 0; right: 0; font-size: 15px; }

  #footer { position: fixed; left: 0; right: 0; bottom: 0; height: 46px; z-index: 4;
    display: grid; grid-template-columns: 1fr auto 1fr; align-items: center;
    padding: 0 16px; gap: 16px; }
  #legend { display: flex; flex-wrap: wrap; gap: 12px; font-size: 10.5px; color: var(--quiet); }
  #legend span { display: inline-flex; align-items: center; gap: 5px; white-space: nowrap; }
  #legend i { width: 7px; height: 7px; border-radius: 50%; display: inline-block; flex: none; }

  #scrub { width: 260px; text-align: center; }
  #scrub input { width: 100%; accent-color: #f2b93c; background: none; }
  #scrub .lab { color: var(--quiet); font-size: 10px; margin-top: 1px; }

  #zoom { display: flex; gap: 4px; justify-content: flex-end; }
  #zoom button { width: 26px; height: 26px; padding: 0; border: 1px solid var(--rule);
    border-radius: 50%; color: var(--quiet); font-size: 13px; line-height: 1;
    display: flex; align-items: center; justify-content: center; }
  #zoom button:hover { color: var(--accent); border-color: var(--accent); }

  #boot { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center;
    text-align: center; padding: 40px; color: var(--quiet); font-family: var(--book); }
</style>

<div id="stage"></div>
<div id="boot">loading the braid&hellip;</div>

<div id="bar" hidden>
  <div id="brand"><b>The Braid</b><span id="subtitle"></span></div>
  <nav>
    <details class="dd"><summary>Layers</summary><div class="pop" id="layers">
      <div class="row on" data-layer="structure">Structure</div>
      <div class="row" data-layer="scenes">Scenes</div>
      <div class="row on" data-layer="flags">Plants &amp; Reveals</div>
      <div class="row on" data-layer="ribbons">Subplots</div>
      <div class="row" data-layer="threads">Mythic threads</div>
      <div class="row" data-layer="strands">Characters</div>
    </div></details>

    <details class="dd"><summary>Show</summary><div class="pop" id="filters">
      <div class="row on" data-filter="all">All</div>
      <div class="row" data-filter="plants">Plants</div>
      <div class="row" data-filter="reveals">Reveals</div>
      <div class="row" data-filter="notes">Notes</div>
      <div class="row" data-filter="unpaid">Still open</div>
      <div class="note">Hides threads. The spine stays.</div>
    </div></details>

    <details class="dd"><summary>View</summary><div class="pop" id="controls">
      <div class="toggle" id="flat">Flatten</div>
      <div class="toggle" id="order"><span id="orderLabel">As it happened</span></div>
      <button id="reset">Reset view</button>
      <button id="top">Look along the spine</button>
    </div></details>

    <details class="dd"><summary>Find</summary><div class="pop wide" id="index">
      <div id="tabs"></div><div id="ilist"></div>
    </div></details>

    <details class="dd"><summary>?</summary><div class="pop" id="how">
      <ul>
        <li>left to right is saga order</li>
        <li>subplots below, characters above</li>
        <li>threads weave over and under</li>
        <li>drag to orbit, shift-drag to pan, scroll to zoom</li>
      </ul>
    </div></details>
  </nav>
</div>

<div class="panel" id="detail"><button id="dclose">&times;</button><div id="dbody"></div></div>

<div id="footer" hidden>
  <!-- Only what the braid actually draws. The reference sheet also listed motifs,
       locations and documents; none of those exist here, and a legend for absent things
       is worse than no legend. -->
  <div id="legend">
    <span><i style="background:#6f7ad0"></i>Characters</span>
    <span><i style="background:#6f74c4"></i>Subplots</span>
    <span><i style="background:#3fb3a8"></i>Mythic threads</span>
    <span><i style="background:#86c46a"></i>Still open</span>
    <span><i style="background:#74b45f"></i>Plants</span>
    <span><i style="background:#c4483c"></i>Reveals</span>
    <span><i style="background:#d39a4a"></i>Notes</span>
  </div>
  <div id="scrub">
    <input type="range" id="upto" min="1" value="1">
    <div class="lab" id="uptolab"></div>
  </div>
  <div id="zoom">
    <button id="zoom-out" title="Further out">&minus;</button>
    <button id="zoom-fit" title="Fit the saga">&#9633;</button>
    <button id="zoom-in" title="Closer in">&plus;</button>
  </div>
</div>

<script>window.__SOURCE__ = "";</script>
<script>
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

const RADIUS = {
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
const SLOT_PX = { structure: 18, detail: 54 };

// The flat prototype expresses zoom as a scale over a 150-unit slot; these are SLOT_PX
// converted through that, at the target display density.
const LOD = {
  bookBands: 0.10,  // below this: book bands and their rollup only
  structure: 0.30,  // below this: chapters and scenes; at or above: everything
};

function tierForSlotPx(px) {
  if (px < SLOT_PX.structure) return 'books';
  if (px < SLOT_PX.detail) return 'structure';
  return 'detail';
}

function tierFor(k) {
  if (k < LOD.bookBands) return 'books';
  if (k < LOD.structure) return 'structure';
  return 'detail';
}

// The default visible set. Hidden layers are not a second code path -- they are the same
// layers with visible=false, each reachable by one plainly-worded control.
const PRESETS = {
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
function resolvePreset(payload) {
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
function storyKeys(chapters) {
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

function computeAxis(chapters, flags, openBy, order = 'read') {
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
const FAR_TIER = { minBands: 3, maxBands: 14, dominant: 0.4 };

function chooseFarTier(books, acts, slots) {
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

function buildGroupings(flags) {
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
function openPlantRules(flags) {
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
function allocateLanes(intervals) {
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
function repackAdvised(previous, ribbons) {
  if (!previous || !previous.count) return false;
  const needed = Math.max(1, ...ribbons.map((r) => (previous.lane[r.id] || 0) + 1));
  return previous.count > Math.max(4, needed * 1.5);
}

function allocateLanesIncremental(intervals, previous) {
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
function angularCeiling(radius, minSeparationPx = 6) {
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
const TARGET = {
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
function angularCeilingForViewport(usableHeightPx = TARGET.usableHeight,
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
function heightFor(concurrency, minSeparationPx = TARGET.minSeparationPx) {
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
function radiusFor(concurrency, minSeparationPx = TARGET.minSeparationPx,
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
function anglesFromLanes(lane, count) {
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
function buildRibbons(flags, axis, rules) {
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
function buildStrands(payload, axis, predicate = 'event') {
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
function strandDensity(strands, axis) {
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
function buildThreads(flags, axis) {
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
function computeHealth(payload, axis, rules, ribbons, strands, dismissals = {}) {
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

function computeSpine(payload, options = {}) {
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

</script>

<script type="module">
let THREE;
try {
  THREE = await import('https://esm.sh/three@0.180.0');
} catch (err) {
  document.getElementById('boot').innerHTML =
    'The braid needs three.js, which is ESM-only and loaded from a CDN.<br>' +
    'No network, so it could not load.<br><br><span style="opacity:.6">' + err.message + '</span>';
  throw err;
}

// The host handshake, identical to the one the character web already uses, because both
// documents are consumed the same two ways: an iframe in the PWA and a WebView on the
// phone. With data baked in (the demo and local builds) this resolves immediately; without
// it, the page says it is listening and waits. Top-level await keeps the rest of the file
// unchanged -- nothing below needs to know the data arrived late.
function postHost(msg) {
  const payload = JSON.stringify(msg);
  if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(payload);
  else if (window.parent && window.parent !== window) window.parent.postMessage(payload, '*');
}

function waitForGraph() {
  return new Promise((resolve) => {
    function receive(e) {
      let msg;
      try { msg = JSON.parse(e.data); } catch (err) { return; }
      if (!msg || msg.type !== 'data' || !msg.payload) return;
      window.removeEventListener('message', receive);
      document.removeEventListener('message', receive);
      resolve(msg.payload);
    }
    // Both targets: a WebView delivers to document, a browser to window.
    window.addEventListener('message', receive);
    document.addEventListener('message', receive);
    postHost({ type: 'ready' });
  });
}

const raw = window.__GRAPH__ || await waitForGraph();
// Defaulted key by key rather than only when the payload is missing entirely: a database
// without the newer migrations returns an older shape, and one absent key should cost one
// layer rather than the whole view.
['chapters', 'scenes', 'flags', 'events', 'presence', 'nodes', 'links'].forEach((k) => {
  if (!Array.isArray(raw[k])) raw[k] = [];
});
const spine = computeSpine(raw, {
  order: new URLSearchParams(location.search).get('order') === 'story' ? 'story' : 'read',
});
const axis = spine.axis, N = axis.slots;

// Two palettes: thread lit in the dark, and thread on paper. The semantics are identical in
// both -- madder reveals, weld plants, indigo subplots, verdigris threads, gold structure --
// only the values move, so nothing has to be relearned when the light changes.
//
// Day is NOT the night palette on a pale ground. Additive glow adds light, and adding light
// to white produces nothing at all, so day drops the glow entirely and lets colour and the
// casing do the work. That is also what thread on paper actually looks like: it does not
// glow, it sits there.
const PALETTES = {
  night: {
    ground:  0x03060d,
    chapter: 0xe8b45a, scene: 0xa8926b, event: 0x8b8478,
    plant:   0x74b45f, reveal: 0xc4483c, note: 0xd39a4a,
    thread:  0x3fb3a8, character: 0x6f7ad0,
    spine:   0xf5be48, ribbonOpen: 0x86c46a, ribbon: 0x6f74c4,
    gold:    0xf2b93c,
    ink: '#f0c464', quiet: '#bb8f3c', band: '#f0c464', act: '#bb8f3c',
    books: [0x0c1226, 0x0f1329, 0x0a1327, 0x101228, 0x0c0f20],
    glow: 1, sky: true,
    css: { ground: '#03060d', ink: '#f0c464', quiet: '#a8813a',
           rule: 'rgba(242,185,60,0.18)', accent: '#f2b93c', pop: 'rgba(3,6,13,0.96)' },
  },
  day: {
    // A warm white page rather than a blue-black sky.
    ground:  0xfaf7f0,
    chapter: 0xb8862a, scene: 0x8a7f6a, event: 0x7d7568,
    plant:   0x3f7f34, reveal: 0xa8332a, note: 0x9c6a1f,
    thread:  0x1f7f77, character: 0x3f4a9e,
    spine:   0xb8860b, ribbonOpen: 0x3f7f34, ribbon: 0x4a4fa0,
    gold:    0xa8791f,
    ink: '#2b2318', quiet: '#6f6250', band: '#8a6a2a', act: '#8a7f6a',
    books: [0xefe6d4, 0xeae4d6, 0xe9e6dc, 0xece3d8, 0xefe8d8],
    glow: 0, sky: false,
    css: { ground: '#faf7f0', ink: '#2b2318', quiet: '#6f6250',
           rule: 'rgba(70,58,38,0.18)', accent: '#a8791f', pop: 'rgba(250,247,240,0.97)' },
  },
};

const THEME = (new URLSearchParams(location.search).get('theme') === 'day') ? 'day' : 'night';
const C = PALETTES[THEME];

// The chrome follows the same choice, through the variables the stylesheet already reads.
(function paintChrome() {
  const r = document.documentElement.style;
  r.setProperty('--ground', C.css.ground);
  r.setProperty('--ink', C.css.ink);
  r.setProperty('--quiet', C.css.quiet);
  r.setProperty('--rule', C.css.rule);
  r.setProperty('--accent', C.css.accent);
  r.setProperty('--pop', C.css.pop);
})();

const BOOK_TINT = C.books;

// ---- the coordinate system ------------------------------------------------------
// X is saga order and nothing else touches it. Y is the lane. Z is that same lane wrapped
// onto a circle -- the identical interval packing, so Flatten is a projection.
const SLOT = 26, SPINE_Y = 0, SCENE_Y = -9, FLAG_Y = -17, EVENT_Y = 12;
const RIB_BASE = -40, RIB_GAP = 7, RIB_R = 62;
const STR_BASE = 30, STR_GAP = 6.5, STR_R = 46;
const THR_BASE = -86, THR_GAP = 8, THR_R = 86;

let flatten = 0;                       // 0 = braided, 1 = flat
let upTo = N;
const X = (o) => (o - 1) * SLOT - ((N - 1) * SLOT) / 2;

// Each class keeps its own radius so it can never compete with another for a lane: subplots
// close in, characters above, mythic threads furthest out because they are the longest-range
// thing in the saga and should read as the outermost weave.
const CLASS = {
  ribbon: { base: RIB_BASE, gap: -RIB_GAP, r: RIB_R },
  strand: { base: STR_BASE, gap: STR_GAP, r: STR_R },
  thread: { base: THR_BASE, gap: -THR_GAP, r: THR_R },
};
function place(kind, lane, angle) {
  const c = CLASS[kind] || CLASS.ribbon;
  const flat = c.base + lane * c.gap;
  return {
    y: flat * flatten + c.r * Math.cos(angle) * (1 - flatten),
    z: c.r * Math.sin(angle) * (1 - flatten),
  };
}

// Thread hangs. A subplot sags between its two anchors like a catenary rather than arcing
// symmetrically -- the symmetric arc was the single strongest tell that this came out of a
// plotting library. The sag also does semantic work for free: depth scales with span, so a
// subplot running half the saga visibly carries more slack than one resolved two chapters
// later, and span length becomes readable as weight.
const SAG_K = 1.7;
const COSH_K = Math.cosh(SAG_K);
function catenary(t) {
  return (Math.cosh((t - 0.5) * 2 * SAG_K) - COSH_K) / (1 - COSH_K);   // 0 at ends, 1 at middle
}
function sagDepth(r) {
  const span = Math.max(1, r.end - r.start);
  return 0.5 + 0.5 * Math.min(1, span / Math.max(2, N * 0.6));
}
function ribbonShape(r, t) {
  const d = sagDepth(r);
  // An open subplot has no far anchor to return to, so it falls away and stays fallen.
  if (r.open) return d * Math.sin(Math.min(1, t * 1.7) * Math.PI / 2);
  return d * catenary(t);
}

// A deterministic per-thread weight. Uniform stroke is mechanical; hashed off the id rather
// than randomised so the same thread is the same weight on every run.
function threadWeight(id, base) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffff;
  return base * (0.82 + (h % 100) / 100 * 0.4);
}

// Taper toward the terminals. TubeGeometry has one radius, so the ring at each tubular
// segment is scaled about its own centre on the curve. Thread thins where it ends.
function taperTube(geo, curve, tubular, radial, fn) {
  const pos = geo.attributes.position;
  for (let i = 0; i <= tubular; i++) {
    const c = curve.getPointAt(Math.min(1, i / tubular));
    const k = fn(i / tubular);
    for (let j = 0; j <= radial; j++) {
      const idx = i * (radial + 1) + j;
      if (idx >= pos.count) continue;
      pos.setXYZ(idx,
        c.x + (pos.getX(idx) - c.x) * k,
        c.y + (pos.getY(idx) - c.y) * k,
        c.z + (pos.getZ(idx) - c.z) * k);
    }
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

// The casing: a wider stroke in the ground colour laid under the thread's own. This is what
// makes a crossing read as OVER and UNDER rather than as two traces sharing a pixel -- the
// upper thread carries a sliver of ground with it and visibly interrupts the lower one.
// Opaque, and writing depth, so the z-buffer decides the interlacing per crossing instead
// of a global draw order; transparency was what defeated it before.
// In two dimensions a casing is a wider stroke laid UNDER the thread. In three it cannot
// be: a wider tube surrounds the thinner one and simply hides it -- which is exactly what
// the first attempt did. The 3D equivalent is an inverted hull: the same tube, slightly
// larger, rendered BACK faces only. Back faces are visible only around the silhouette, so
// it reads as a rim of ground colour hugging the thread, and where one thread crosses in
// front of another its rim visibly interrupts the one behind. That is the over-under read,
// and because everything is opaque and writes depth, which thread is on top at any given
// crossing is decided by where the threads actually are rather than by draw order.
function casingMaterial() {
  return new THREE.MeshBasicMaterial({
    color: C.ground, side: THREE.BackSide, transparent: false, depthWrite: true,
  });
}
function threadMaterial(colour) {
  return new THREE.MeshStandardMaterial({
    color: colour, roughness: THEME === 'day' ? 0.85 : 0.62, metalness: 0.0,
    emissive: colour, emissiveIntensity: 0.22 * C.glow, transparent: false, depthWrite: true,
  });
}

// Lit from within, not outlined. Two concentric additive shells at falling opacity give a
// soft falloff; a single shell gives a hard halo, which is the neon reading this is meant
// to avoid. They never write depth, so an opaque thread crossing in front still occludes
// the glow of the one behind and the interlace survives.
//
// GLOW CARRIES MEANING. Intensity is not uniform: it says what state the thread is in, so
// luminance is doing work the data already contains rather than being decoration.
const GLOW = {
  ribbon: 0.075 * C.glow,   // resolved: low and steady
  open:   0.155 * C.glow,   // still open: the brightest thing in its neighbourhood
  thread: 0.045 * C.glow,   // mythic: lowest, because it runs saga-length and would dominate
  spine:  0.115 * C.glow,   // the one constant, and the only structural thing that glows
};
// THE BLEACHING FIX.
//
// Additive blending sums channels. A hue that is already desaturated has substantial values
// in all three channels, so stacking it repeatedly drives every channel toward its ceiling
// and the result trends white -- which is why madder was reading pink-grey and the greens
// read sage. The glow was not adding light to the thread, it was adding whiteness.
//
// So the glow is the thread's own hue pushed UP in saturation and DOWN in value: adding a
// deep, saturated version of the colour adds hue without adding white. The core keeps its
// own colour at full strength and sits on top, so the thread reads as a coloured filament
// lit from within rather than as a pale thread wearing a halo.
function saturated(hex, boost, valueMul) {
  const c = new THREE.Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  c.setHSL(hsl.h, Math.min(1, hsl.s + (boost === undefined ? 0.42 : boost)),
    Math.max(0.06, hsl.l * (valueMul === undefined ? 0.62 : valueMul)));
  return c;
}
function glowMaterial(colour, intensity) {
  return new THREE.MeshBasicMaterial({
    color: saturated(colour), transparent: true, opacity: intensity,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.BackSide,
  });
}

// At 21 concurrent subplots the glow accumulates wherever threads bunch and the middle of
// the picture blooms into a wash. So each thread's glow is scaled down by how crowded its
// own stretch of the axis is: the denser the weave, the fainter each strand contributes,
// and the total stays roughly bounded instead of summing.
function localDensity(r, all) {
  const mid = (r.start + r.end) / 2;
  let n = 0;
  all.forEach((o) => { if (o.start <= mid && o.end >= mid) n += 1; });
  return n;
}
function densityScale(n) {
  return Math.max(0.28, Math.min(1, 3.2 / (2.2 + n * 0.42)));
}
function addGlow(group, curve, tubular, radial, weight, colour, intensity, taper) {
  [[1.9, 0.68], [3.1, 0.32]].forEach(([mult, share]) => {
    const g = new THREE.Mesh(
      taperTube(new THREE.TubeGeometry(curve, tubular, weight * mult, radial, false),
        curve, tubular, radial, taper),
      glowMaterial(colour, intensity * share));
    g.userData.restOpacity = intensity * share;
    g.renderOrder = 2;
    group.add(g);
    group.userData.glows.push(g);
  });
}
function ribbonPointAt(r, ord) {
  const p = place('ribbon', r.lane, r.angle);
  const end = Math.min(r.end, upTo);
  const span = X(end) - X(r.start);
  const t = span === 0 ? 0 : Math.max(0, Math.min(1, (X(ord) - X(r.start)) / span));
  const k = ribbonShape(r, t);
  return { x: X(ord), y: p.y * k, z: p.z * k };
}

// ---- scene ----------------------------------------------------------------------
const stage = document.getElementById('stage');
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
stage.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(C.ground);
scene.fog = new THREE.Fog(C.ground, 520, 1800);

const camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 1, 4000);
scene.add(new THREE.AmbientLight(THEME === 'day' ? 0xffffff : 0xdfe6f5, THEME === 'day' ? 0.9 : 0.55));
const key = new THREE.DirectionalLight(THEME === 'day' ? 0xfff6e8 : 0xffeed4, THEME === 'day' ? 0.75 : 1.15);
key.position.set(-0.4, 1, 0.8);
scene.add(key);
const rim = new THREE.DirectionalLight(THEME === 'day' ? 0xcfd8e8 : 0x8fa8d8, THEME === 'day' ? 0.25 : 0.42);
rim.position.set(0.6, -0.5, -0.9);
scene.add(rim);

// Text as a canvas texture: labels are drawn, not hovered. A braid of unlabelled shapes
// cannot be navigated, which is the same reason the flat renderer draws its titles.
function label(text, opts) {
  const o = opts || {};
  const size = o.size || 46, pad = 12;
  const c = document.createElement('canvas');
  const g = c.getContext('2d');
  const face = o.book
    ? 'Georgia, "Iowan Old Style", Palatino, serif'
    : 'system-ui, sans-serif';
  g.font = (o.weight || 500) + ' ' + size + 'px ' + face;
  const w = Math.ceil(g.measureText(text).width) + pad * 2;
  c.width = w; c.height = size + pad * 2;
  g.font = (o.weight || 500) + ' ' + size + 'px ' + face;
  g.fillStyle = o.color || C.ink;
  g.textBaseline = 'middle';
  if (o.letter) g.letterSpacing = o.letter;
  g.fillText(text, pad, c.height / 2);
  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 4;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({
    map: tex, transparent: true, opacity: o.opacity == null ? 0.92 : o.opacity,
    depthWrite: false, sizeAttenuation: true,
  }));
  const scale = (o.world || 9) / size;
  sp.scale.set(c.width * scale, c.height * scale, 1);
  return sp;
}

// The sky. Parented to the CAMERA, not to the world, so it cannot parallax when the view
// pans or orbits -- a background that slides against the data reads as depth cueing and
// invites the eye to track it. It is static by construction rather than by restraint.
//
// The hard constraint: nothing here may compete with a data mark. The faintest scene tick
// is a small lit box; these are unlit points at a fifth of its brightness, drawn first and
// never depth-writing, so no star can ever be mistaken for something clickable.
function buildSky() {
  const sky = new THREE.Group();

  const dot = document.createElement('canvas');
  dot.width = dot.height = 32;
  const dg = dot.getContext('2d');
  const rg = dg.createRadialGradient(16, 16, 0, 16, 16, 16);
  rg.addColorStop(0, 'rgba(255,255,255,1)');
  rg.addColorStop(0.35, 'rgba(255,255,255,0.5)');
  rg.addColorStop(1, 'rgba(255,255,255,0)');
  dg.fillStyle = rg;
  dg.fillRect(0, 0, 32, 32);
  const dotTex = new THREE.CanvasTexture(dot);

  // Low density on purpose: sky, not texture. A seeded generator rather than Math.random,
  // so the same sky comes back on every load -- the whole design turns on the picture being
  // the same twice.
  let seed = 20260825;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };

  const COUNT = 420;
  const pos = new Float32Array(COUNT * 3);
  for (let i = 0; i < COUNT; i++) {
    pos[i * 3]     = (rnd() - 0.5) * 2600;
    pos[i * 3 + 1] = (rnd() - 0.5) * 1700;
    pos[i * 3 + 2] = -900 - rnd() * 200;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const points = new THREE.Points(geo, new THREE.PointsMaterial({
    // Size in PIXELS, not world units: attenuated points nine hundred units away are
    // sub-pixel and simply do not appear. Fixed size also means the sky does not swell as
    // the camera dollies, which would read as motion.
    map: dotTex, color: 0xc8d6f5, size: 1.7, sizeAttenuation: false,
    transparent: true, opacity: 0.13, depthWrite: false, depthTest: false,
  }));
  // Parented to a moving camera, so its local bounding sphere is meaningless to the
  // frustum test -- without this the whole sky can be culled and simply never appear.
  points.frustumCulled = false;
  points.renderOrder = -10;
  sky.add(points);

  // Two nebular washes, barely there, for depth. Same rule: dimmer than any mark.
  const wash = document.createElement('canvas');
  wash.width = wash.height = 256;
  const wg = wash.getContext('2d');
  const wr = wg.createRadialGradient(128, 128, 0, 128, 128, 128);
  wr.addColorStop(0, 'rgba(120,150,220,0.30)');
  wr.addColorStop(0.5, 'rgba(90,110,190,0.10)');
  wr.addColorStop(1, 'rgba(60,80,150,0)');
  wg.fillStyle = wr;
  wg.fillRect(0, 0, 256, 256);
  const washTex = new THREE.CanvasTexture(wash);
  [[-620, 190, 0.11], [560, -230, 0.08]].forEach(([x, y, o]) => {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: washTex, transparent: true, opacity: o, depthWrite: false, depthTest: false,
    }));
    sp.position.set(x, y, -950);
    sp.scale.set(1500, 1100, 1);
    sp.frustumCulled = false;
    sp.renderOrder = -11;
    sky.add(sp);
  });

  return sky;
}
const sky = buildSky();
sky.visible = C.sky;   // a starfield on a white page is not a sky, it is dirt
camera.add(sky);
scene.add(camera);

const groups = {};
['books', 'structure', 'scenes', 'flags', 'ribbons', 'threads', 'strands'].forEach((k) => {
  groups[k] = new THREE.Group();
  scene.add(groups[k]);
});
const picks = [];                                  // raycastable meshes

// Connectors between the two ends of a pair. Thinner than a subplot tube, because a tube is
// the arc and these are just the correspondence; and drawn ONLY while one end is selected,
// because every pair drawn at once is the smear the labels already taught us to avoid.
// Green leads outward from a plant to what answers it, red outward from a reveal to what
// set it up -- so the colour says which end you are standing on.
const links = new THREE.Group();
scene.add(links);

// ---- book slabs and act dividers -------------------------------------------------
axis.books.forEach((b, i) => {
  const x0 = X(b.from) - SLOT / 2, x1 = X(b.to) + SLOT / 2;
  const w = x1 - x0, h = 150;
  const mat = new THREE.MeshBasicMaterial({
    color: BOOK_TINT[i % BOOK_TINT.length], transparent: true, opacity: 0.11,
    side: THREE.DoubleSide, depthWrite: false,
  });
  const slab = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  slab.position.set((x0 + x1) / 2, 26, -46);
  groups.books.add(slab);

  const cap = label('BOOK ' + toRoman(b.book + 1), { size: 46, world: 8, color: C.band, weight: 400 });
  cap.position.set((x0 + x1) / 2, 92, -45);
  groups.books.add(cap);

  const edge = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(x0, -50, -46), new THREE.Vector3(x0, 100, -46)]),
    new THREE.LineBasicMaterial({ color: 0xc69a3a, transparent: true, opacity: 0.3 }));
  groups.books.add(edge);
});

axis.acts.forEach((a) => {
  const t = label('Act ' + a.act, { size: 30, world: 4.5, color: C.act, opacity: 0.7 });
  t.position.set((X(a.from) + X(a.to)) / 2, 72, -44);
  groups.books.add(t);
});

function toRoman(n) {
  const map = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let out = '';
  map.forEach(([v, s]) => { while (n >= v) { out += s; n -= v; } });
  return out;
}

// ---- the spine -------------------------------------------------------------------
const spineLine = new THREE.Mesh(
  new THREE.CylinderGeometry(0.62, 0.62, (N - 1) * SLOT, 10),
  threadMaterial(C.spine));
const spineGlow = new THREE.Mesh(
  new THREE.CylinderGeometry(1.9, 1.9, (N - 1) * SLOT, 10),
  glowMaterial(C.spine, GLOW.spine));
spineGlow.rotation.z = Math.PI / 2;
spineGlow.renderOrder = 2;
groups.structure.add(spineGlow);
spineLine.rotation.z = Math.PI / 2;
groups.structure.add(spineLine);

// Status as FINISH, not as a chart. The four states the writer already sets -- idea,
// outline, drafted, final -- are expressed as how worked the material looks: an unworked
// bead is paler and matte, a finished one deeper and polished with a stronger highlight.
// No rings, no badges, no colour coding. Texture first, information second.
const FINISH = {
  idea:    { light: 1.22, rough: 0.96, hi: 0.10, grain: 0.05 },
  outline: { light: 1.10, rough: 0.88, hi: 0.16, grain: 0.07 },
  drafted: { light: 0.94, rough: 0.62, hi: 0.30, grain: 0.10 },
  final:   { light: 0.82, rough: 0.42, hi: 0.42, grain: 0.12 },
};

// Deterministic per-bead variation, seeded off the chapter id. Identical beads read as
// machined; slightly varied ones read as made. Kept small -- hand-turned, not irregular.
function beadSeed(id) {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) { h ^= id.charCodeAt(i); h = Math.imul(h, 16777619); }
  return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); return ((h >>> 0) % 1000) / 1000; };
}

const beadTextures = [];
const texCache = {};

// Detail is gated on how many DEVICE pixels a mark actually occupies, not on camera
// distance. Distance was a proxy for size and a bad one: it ignores field of view, viewport
// size and display density, so the same threshold produced different results on different
// screens. These are the sizes at which detail can be seen at all.
// Both derived, not chosen. The earlier 22 and 70 were guesses made under phone-shaped
// assumptions and the first of them was simply wrong: at 22 device pixels the grain could
// not be resolved at all, which is most of why it read as mud.
//
//   BANDS is the striation count around the whole bead; about half of it faces the viewer,
//   so a bead needs two device pixels per visible band to resolve any of it. 36 bands means
//   18 visible means 36 pixels, and 40 gives a little margin.
//
//   The small texture is 128 wide and wraps the whole bead, so 64 texels face the viewer.
//   Past 64 device pixels it is being magnified, and that is where the large one earns its
//   memory -- not before.
const BEAD_BANDS = 36;
const PX_GRAIN = 40;
const PX_DETAIL = 64;
// Hysteresis, so a bead sitting exactly on a threshold does not flicker between states as
// the camera drifts. The swap is also below the eye's notice by construction: the grain's
// own contrast is about 0.05, so what changes across the boundary is smaller than the
// difference between two adjacent bands.
const PX_HYST = 6;

function beadTexture(chapter, withGrain, big) {
  const f = FINISH[chapter.status] || FINISH.idea;
  const key = chapter.status + '|' + (withGrain ? 'g' : 'p') + '|' + (big ? 'b' : 's');
  if (texCache[key]) return texCache[key];

  const hiPos = 0.42, hiOff = 0.42;

  // u (canvas x) runs ALONG the thread; v (canvas y) runs around the bead.
  const W = big ? 512 : 128, H = big ? 256 : 64;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d');

  const base = new THREE.Color(C.chapter).clone();
  const hsl = { h: 0, s: 0, l: 0 };
  base.getHSL(hsl);
  base.setHSL(hsl.h, hsl.s * (chapter.status === 'idea' ? 0.72 : 0.95),
    Math.min(0.86, hsl.l * f.light));
  g.fillStyle = '#' + base.getHexString();
  g.fillRect(0, 0, W, H);

  // Turned banding: rings around the thread, low contrast, same orientation on every bead
  // so they read as one material. Phase varies per bead, spacing does not.
  // Fine striation, not stripes. The first version drew about seven bands across the whole
  // wrap, of which three were ever visible -- which is why it read as painted stripes rather
  // than turned wood. Frequency up by a factor of six, contrast down by about half.
  g.globalAlpha = withGrain ? f.grain * 0.55 : 0;
  const step = Math.max(1, Math.round(W / 256));
  for (let x = 0; x < W; x += step) {
    const t = x / W;
    const v = Math.sin(t * Math.PI * BEAD_BANDS * 2);
    g.fillStyle = v > 0 ? '#000000' : '#ffffff';
    g.globalAlpha = (withGrain ? f.grain * 0.55 : 0) * Math.abs(v);
    g.fillRect(x, 0, step, H);
  }
  g.globalAlpha = 1;

  // Darker at both ends, where the thread enters and leaves. This is what seats the bead on
  // the spine rather than letting it hover.
  const ends = g.createLinearGradient(0, 0, W, 0);
  ends.addColorStop(0, 'rgba(0,0,0,0.55)');
  ends.addColorStop(0.18, 'rgba(0,0,0,0)');
  ends.addColorStop(0.82, 'rgba(0,0,0,0)');
  ends.addColorStop(1, 'rgba(0,0,0,0.55)');
  g.fillStyle = ends;
  g.fillRect(0, 0, W, H);

  // One restrained highlight, offset from centre, its position varying slightly per bead.
  const hg = g.createRadialGradient(W * hiPos, H * hiOff, 0, W * hiPos, H * hiOff, W * 0.22);
  hg.addColorStop(0, 'rgba(255,246,225,' + f.hi + ')');
  hg.addColorStop(1, 'rgba(255,246,225,0)');
  g.fillStyle = hg;
  g.fillRect(0, 0, W, H);

  const tex = new THREE.CanvasTexture(cv);
  tex.anisotropy = 8;
  tex.wrapS = THREE.RepeatWrapping;
  texCache[key] = tex;
  return tex;
}

function beadMaterial(chapter) {
  const f = FINISH[chapter.status] || FINISH.idea;
  // Form -- the round shading, the darkened ends where the thread passes through, the
  // highlight -- is what makes it a bead and belongs at every zoom. Only the banding is
  // detail that should disappear. An earlier version faded the whole map and took the
  // object with it.
  //
  // The image is shared; the per-bead variation is a clone with its own offset, so no two
  // beads show the same phase of grain or sit the highlight in quite the same place, and
  // the memory cost of that variation is zero.
  const rnd = beadSeed(String(chapter.id));
  const phase = rnd();
  const own = (t) => { const c = t.clone(); c.needsUpdate = true; c.offset.x = phase; return c; };

  const variants = {
    grainSmall: own(beadTexture(chapter, true, false)),
    plainSmall: own(beadTexture(chapter, false, false)),
    grainBig: null, plainBig: null, chapter,
  };
  const mat = new THREE.MeshStandardMaterial({
    map: variants.grainSmall, color: 0xffffff, roughness: f.rough, metalness: 0.0,
  });
  variants.mat = mat;
  variants.own = own;
  beadTextures.push(variants);
  return mat;
}

// A title may occupy its own slot and no more. At this world size a character is about
// 0.55 of the type size wide, so the character budget follows from SLOT rather than from a
// number picked by eye.
const TITLE_WORLD = 2.9;
const TITLE_CHARS = Math.max(8, Math.floor((SLOT * 0.98) / (0.55 * TITLE_WORLD)));

// The annotation marks were the last flat-shaded things in a lit image. They get the same
// treatment as a bead -- a form gradient, a darker rim where the mark meets its thread, one
// offset highlight -- with one rule governing how much of it each mark receives:
//
//   DETAIL SCALES WITH SIZE. A bead is large enough to carry striation. A scene tick is six
//   pixels and cannot; forcing grain onto it produces mud, which is worse than flat. Small
//   marks get form and rim only, and no grain at any zoom.
//
// Shapes and colours are untouched -- both are load-bearing for what a mark means, and this
// pass changes surface and nothing else.
const markMaterials = [];
const markTexCache = {};

function markTexture(hex, withGrain, small) {
  const key = hex + (withGrain ? 'g' : 'p') + (small ? 's' : 'l');
  if (markTexCache[key]) return markTexCache[key];

  const W = 128, H = 128;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d');

  const base = new THREE.Color(hex);
  g.fillStyle = '#' + base.getHexString();
  g.fillRect(0, 0, W, H);

  // Form: lit from above, falling away below.
  const form = g.createLinearGradient(0, 0, 0, H);
  form.addColorStop(0, 'rgba(255,250,240,0.20)');
  form.addColorStop(0.45, 'rgba(255,250,240,0)');
  form.addColorStop(1, 'rgba(0,0,0,0.34)');
  g.fillStyle = form;
  g.fillRect(0, 0, W, H);

  // Rim: darker where the mark meets the thread it sits on, so it is seated rather than
  // pasted over. Same reasoning as the bead's darkened ends.
  const rim = g.createRadialGradient(W / 2, H / 2, W * 0.18, W / 2, H / 2, W * 0.55);
  rim.addColorStop(0, 'rgba(0,0,0,0)');
  rim.addColorStop(1, 'rgba(0,0,0,0.42)');
  g.fillStyle = rim;
  g.fillRect(0, 0, W, H);

  // Grain, only on marks big enough to show it.
  if (withGrain && !small) {
    for (let y = 0; y < H; y += 1) {
      const v = Math.sin((y / H) * Math.PI * 52);
      g.globalAlpha = 0.05 * Math.abs(v);
      g.fillStyle = v > 0 ? '#000000' : '#ffffff';
      g.fillRect(0, y, W, 1);
    }
    g.globalAlpha = 1;
  }

  // One restrained highlight, offset from centre.
  const hi = g.createRadialGradient(W * 0.38, H * 0.34, 0, W * 0.38, H * 0.34, W * 0.3);
  hi.addColorStop(0, 'rgba(255,250,236,0.30)');
  hi.addColorStop(1, 'rgba(255,250,236,0)');
  g.fillStyle = hi;
  g.fillRect(0, 0, W, H);

  const tex = new THREE.CanvasTexture(cv);
  tex.anisotropy = 8;
  markTexCache[key] = tex;
  return tex;
}

function markMaterial(hex, opts) {
  const o = opts || {};
  const grain = o.small ? null : markTexture(hex, true, false);
  const plain = markTexture(hex, false, !!o.small);
  const mat = new THREE.MeshStandardMaterial({
    map: grain || plain, color: 0xffffff,
    roughness: o.rough === undefined ? 0.6 : o.rough, metalness: 0.0,
  });
  markMaterials.push({ mat, grain, plain });
  return mat;
}

const chapterMesh = {};
const chapterTitles = [];
const chapterNumerals = [];
let grainOn = true;
let detailOn = false;

// Screen size of a world-space radius at the current camera, in CSS pixels.
function markScreenSize(worldRadius) {
  const vFov = (camera.fov * Math.PI) / 180;
  return (worldRadius * 2 / (2 * Math.tan(vFov / 2) * Math.max(1, dist))) * innerHeight;
}
axis.sorted.forEach((c) => {
  const o = axis.ordinal[c.id];
  // A turned bead threaded onto the spine. Silhouette and hit target are exactly as they
  // were; everything here is surface. The geometry is rotated so its poles lie ALONG the
  // thread, which is what lets the texture's banding run as rings around the thread -- the
  // way a bead turned on a lathe actually reads -- and lets the ends darken where the
  // thread enters and leaves, so the bead sits on the spine instead of floating over it.
  const geo = new THREE.SphereGeometry(2.5, 20, 14);
  geo.scale(0.85, 1.35, 1.35);
  geo.rotateZ(Math.PI / 2);
  const m = new THREE.Mesh(geo, beadMaterial(c));
  m.position.set(X(o), SPINE_Y, 0);
  m.userData = { kind: 'chapter', id: c.id, ord: o, data: c };
  groups.structure.add(m);
  picks.push(m);
  chapterMesh[c.id] = m;

  const n = label(String(o), { size: 26, world: 3.4, color: C.quiet, opacity: 0.8 });
  n.position.set(X(o), SPINE_Y - 6.5, 0);
  n.userData = { numeralFor: c.id, ord: o };
  groups.structure.add(n);
  chapterNumerals.push(n);

  // ONE row, one truncation rule. The two staggered rows were a way of fitting more titles
  // in without solving the overlap, and they did not solve it -- they produced two rows that
  // both overlapped, which reads as a rendering fault. A title is now truncated to the width
  // of its own chapter slot and sits on a single line; where even that collides, the
  // collision pass drops it rather than letting two titles share pixels.
  const t = label(clip(c.title, TITLE_CHARS), {
    size: 30, world: TITLE_WORLD, color: C.ink, opacity: 0.95, book: true,
  });
  t.position.set(X(o), SPINE_Y + 9.5, 0);
  t.userData = { titleFor: c.id, ord: o };
  groups.structure.add(t);
  chapterTitles.push(t);
});

function clip(s, n) {
  s = String(s || '');
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

// ---- scenes ----------------------------------------------------------------------
const scenesByChapter = {};
raw.scenes.forEach((s) => { (scenesByChapter[s.chapterId] = scenesByChapter[s.chapterId] || []).push(s); });
const sceneX = {};
Object.keys(scenesByChapter).sort().forEach((cid) => {
  const list = scenesByChapter[cid].slice().sort((a, b) => a.seq - b.seq);
  const base = X(axis.ordinal[cid]);
  list.forEach((s, i) => {
    const x = base + ((i + 1) / (list.length + 1) - 0.5) * SLOT * 0.8;
    sceneX[s.id] = x;
    // A scene tick is the smallest mark on the picture. It gets form and rim and nothing
    // else -- no grain at any zoom -- and it is a plate rather than a cube for the same
    // reason the notes are.
    const m = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.4, 0.5),
      markMaterial(C.scene, { small: true, rough: 0.75 }));
    m.position.set(x, SCENE_Y, 0);
    m.userData = { kind: 'scene', id: s.id, ord: axis.ordinal[cid], data: s };
    groups.scenes.add(m);
    picks.push(m);
  });
});

// ---- flags, ON their subplot ------------------------------------------------------
// A plant and the reveal that pays it are joined by the ribbon they share, so the flags are
// placed ON that ribbon rather than in a row beneath the spine. Before this they were drawn
// as loose markers and nothing pointed anywhere: you could see that a line was flagged and
// not where it was answered, which is most of the question.
//
// A flag belonging to several groupings gets a marker on each -- that is not duplication,
// it is the line doing two jobs, which the pairs model exists to express.
//
// A flag in no grouping (every note, and any plant nobody has joined yet) has no ribbon to
// sit on and stays near the spine, which is the honest place for it.
const ribbonById = {};
spine.ribbons.forEach((r) => { ribbonById[r.id] = r; });

const groupsWithReveal = new Set();
raw.flags.forEach((f) => {
  if (f.type !== 'reveal') return;
  (f.pairs || []).forEach((m) => groupsWithReveal.add(m.id));
});
const openIds = new Set(raw.flags.filter((f) => {
  if (f.type !== 'plant') return false;
  const ms = f.pairs || [];
  return !ms.length || !ms.some((m) => groupsWithReveal.has(m.id));
}).map((f) => f.id));

// Who answers whom, so the panel can say it in words as well as draw it.
const counterparts = {};
spine.ribbons.forEach((r) => {
  r.plants.forEach((pid) => {
    counterparts[pid] = (counterparts[pid] || []).concat(
      r.reveals.map((rid) => ({ id: rid, via: r })));
  });
  r.reveals.forEach((rid) => {
    counterparts[rid] = (counterparts[rid] || []).concat(
      r.plants.map((pid) => ({ id: pid, via: r })));
  });
});

const flagById = {};
raw.flags.forEach((f) => { flagById[f.id] = f; });

function flagGeometry(type) {
  // Segment count raised so a cone reads as a cone rather than as a pentagon; the
  // silhouette -- triangle up for a plant, down for a reveal -- is unchanged, which is the
  // part that carries meaning.
  if (type === 'plant' || type === 'reveal') return new THREE.ConeGeometry(2.2, 4.2, 18);
  // A card, not a cube. At this size an extruded box reads as an isometric block pasted
  // onto the picture, which is worse than flat.
  return new THREE.BoxGeometry(3.0, 3.4, 0.22);
}
function flagColor(type, thread) {
  if (type === 'plant') return C.plant;
  if (type === 'reveal') return C.reveal;
  return thread ? C.thread : C.note;
}

const flagMeshes = [];
const spineFlags = {};          // anchor key -> running count, for fanning the loose ones

raw.flags.slice().sort((a, b) => (a.id < b.id ? -1 : 1)).forEach((f) => {
  const ord = axis.ordinal[f.chapterId];
  if (!ord) return;
  const kind = (f.type === 'note' && f.thread) ? 'thread' : f.type;
  const memberships = (f.pairs || []).filter((m) => ribbonById[m.id]);

  const make = (ribbon) => {
    const col = flagColor(f.type, f.thread);
    const m = new THREE.Mesh(flagGeometry(f.type), markMaterial(col, { rough: 0.55 }));
    if (f.type === 'reveal') m.rotation.z = Math.PI;
    m.userData = { kind: kind, id: f.id, ord: ord, data: f, flag: true, ribbon: ribbon || null };
    groups.flags.add(m);
    picks.push(m);
    flagMeshes.push(m);
    return m;
  };

  if (memberships.length) {
    memberships.forEach((mem) => make(ribbonById[mem.id]));
  } else {
    const key = f.chapterId;
    const i = (spineFlags[key] = (spineFlags[key] || 0) + 1) - 1;
    const m = make(null);
    m.position.set(X(ord) + ((i % 4) / 3 - 0.5) * SLOT * 0.7, FLAG_Y - Math.floor(i / 4) * 4.4, 0);
    m.userData.loose = true;
  }
});

// ---- subplot ribbons -------------------------------------------------------------
// One tube per grouping, from its first plant to its last reveal. An open one runs to the
// end of the saga and ends in a cap: a positive mark, not a fade, because a fade at the
// back of the braid is indistinguishable from something merely far away.
const ribbonObjs = [];
spine.ribbons.forEach((r) => {
  const g = new THREE.Group();
  const mat = threadMaterial(r.open ? C.ribbonOpen : C.ribbon);
  const casing = casingMaterial();
  g.userData = { kind: 'ribbon', id: r.id, ord: r.start, data: r, mat: mat, glows: [] };
  groups.ribbons.add(g);
  ribbonObjs.push(g);

  // An open subplot FRAYS rather than ending in a cap: the thread unravels into finer
  // strands that thin to nothing. Still a positive mark -- present at every zoom, and not
  // confusable with something merely occluded -- but said in the material's own language.
  const fray = r.open ? new THREE.Group() : null;
  if (fray) g.add(fray);

  const tag = label(clip(r.label, 22), {
    size: 26, world: 2.6, color: r.open ? '#' + new THREE.Color(C.ribbonOpen).getHexString() : '#' + new THREE.Color(C.ribbon).getHexString(), opacity: 0.9,
  });
  g.add(tag);
  g.userData.fray = fray;
  g.userData.casingMat = casing;
  g.userData.tag = tag;
  g.userData.tube = null;
});

// ---- mythic threads ---------------------------------------------------------------
// The one structure explicitly meant to recur across the whole saga, and until now the one
// with no span drawn at all -- its touches were loose note markers with nothing joining
// them. A thread with two or more touches gets an arc, in its own radius class.
const threadObjs = [];
spine.threads.forEach((t) => {
  const g = new THREE.Group();
  const mat = threadMaterial(C.thread);
  g.userData = { kind: 'thread-arc', id: t.id, ord: t.start, data: t, mat: mat, tube: null, glows: [] };
  const tag = label(clip(t.label, 24), { size: 26, world: 2.6, color: '#' + new THREE.Color(C.thread).getHexString(), opacity: 0.9 });
  g.add(tag);
  g.userData.tag = tag;
  groups.threads.add(g);
  threadObjs.push(g);
});

// ---- character strands -----------------------------------------------------------
// A continuous line across the span with beads where a moment was actually recorded. The
// line asserts the character exists across that stretch; the beads assert only what is
// logged. A gap is an unrecorded stretch, never a claim that anybody left.
const strandObjs = [];
spine.strands.forEach((s) => {
  const g = new THREE.Group();
  g.userData = { kind: 'strand', id: s.id, ord: s.start, data: s };
  groups.strands.add(g);
  strandObjs.push(g);

  s.beads.forEach((b) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(b.isPov ? 1.9 : 1.2, 16, 12),
      markMaterial(C.character, { small: true, rough: 0.55 }));
    m.userData = { bead: true, ord: b.ord };
    g.add(m);
  });
  const tag = label(s.label, { size: 26, world: 2.6, color: '#' + new THREE.Color(C.character).getHexString(), opacity: 0.85 });
  g.add(tag);
  g.userData.tag = tag;
  g.userData.line = null;
});

// ---- rebuild the parts whose geometry depends on flatten / upTo -------------------
function rebuildCurves() {
  ribbonObjs.forEach((g) => {
    const r = g.userData.data;
    if (g.userData.tube) { g.remove(g.userData.tube); g.userData.tube.geometry.dispose(); }
    if (g.userData.cased) { g.remove(g.userData.cased); g.userData.cased.geometry.dispose(); }
    while (g.userData.glows.length) {
      const gl = g.userData.glows.pop();
      g.remove(gl); gl.geometry.dispose(); gl.material.dispose();
    }
    if (r.start > upTo) { g.visible = false; return; }
    g.visible = true;
    const end = Math.min(r.end, upTo);
    const p = place('ribbon', r.lane, r.angle);
    const pts = [];
    const steps = 26;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = X(r.start) + (X(end) - X(r.start)) * t;
      // Leaves the spine, runs in its lane, and returns to the spine at the reveal --
      // unless it is open, in which case it never comes back.
      const k = ribbonShape(r, t);
      pts.push(new THREE.Vector3(x, p.y * k, p.z * k));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const w = threadWeight(r.id, 0.72);
    const TUB = 64, RAD = 7;

    // Thread, then the casing beneath it. Both tapered toward the ends.
    const taper = (f) => 0.35 + 0.65 * Math.sin(Math.min(1, Math.max(0, f)) * Math.PI);
    const tube = new THREE.Mesh(
      taperTube(new THREE.TubeGeometry(curve, TUB, w, RAD, false), curve, TUB, RAD, taper),
      g.userData.mat);
    const cased = new THREE.Mesh(
      taperTube(new THREE.TubeGeometry(curve, TUB, w * 2.1, RAD, false), curve, TUB, RAD, taper),
      g.userData.casingMat);
    // renderOrder keeps the casing painted immediately before its own thread; depth does
    // the rest, so which of two crossing threads is on top is decided by where they
    // actually are rather than by the order they happen to be in the scene.
    tube.userData = g.userData;
    cased.userData = g.userData;
    g.add(cased);
    g.add(tube);
    g.userData.tube = tube;
    g.userData.cased = cased;

    const dens = densityScale(localDensity(r, spine.ribbons));
    const base = (r.open ? GLOW.open : GLOW.ribbon) * dens;
    addGlow(g, curve, TUB, RAD, w, r.open ? C.ribbonOpen : C.ribbon, base, taper);

    // An open subplot brightens toward the frayed end, so the unfinished thing is the
    // brightest thing near it. Done as a second glow over the last stretch of the curve
    // rather than by varying opacity along one tube, which a single material cannot do.
    if (r.open) {
      const tail = new THREE.CatmullRomCurve3(pts.slice(Math.floor(pts.length * 0.62)));
      addGlow(g, tail, 20, RAD, w, C.ribbonOpen, base * 0.85, (f) => 0.45 + 0.55 * f);
    }

    if (g.userData.fray) {
      while (g.userData.fray.children.length) {
        const c = g.userData.fray.children.pop();
        c.geometry.dispose();
      }
      const tip = pts[pts.length - 1];
      const prev = pts[pts.length - 2] || tip;
      const dir = tip.clone().sub(prev).normalize();
      for (let i = 0; i < 3; i++) {
        const spread = (i - 1) * 0.55;
        const a = tip.clone();
        const b = tip.clone().add(dir.clone().multiplyScalar(SLOT * 0.55))
          .add(new THREE.Vector3(0, spread * 2.4, spread * 1.6));
        const fc = new THREE.CatmullRomCurve3([
          a, a.clone().lerp(b, 0.5).add(new THREE.Vector3(0, spread * 0.9, 0)), b]);
        const fg = taperTube(new THREE.TubeGeometry(fc, 18, w * 0.5, 5, false), fc, 18, 5,
          (f) => 1 - f * 0.95);
        g.userData.fray.add(new THREE.Mesh(fg, g.userData.mat));
      }
    }

    g.userData.tag.position.set(X(r.start) - 6, p.y * 0.55 + 3, p.z * 0.55);
  });

  // The flags ride their ribbon, so they move with it through the whole unroll rather than
  // detaching halfway.
  flagMeshes.forEach((m) => {
    if (!m.userData.ribbon) return;
    const q = ribbonPointAt(m.userData.ribbon, m.userData.ord);
    m.position.set(q.x, q.y, q.z);
  });
  // The connectors join two markers, so they are rebuilt whenever those markers move.
  if (selected) drawLinks(selected);

  threadObjs.forEach((g) => {
    const t = g.userData.data;
    if (g.userData.tube) { g.remove(g.userData.tube); g.userData.tube.geometry.dispose(); }
    if (g.userData.cased) { g.remove(g.userData.cased); g.userData.cased.geometry.dispose(); }
    while (g.userData.glows.length) {
      const gl = g.userData.glows.pop();
      g.remove(gl); gl.geometry.dispose(); gl.material.dispose();
    }
    if (t.start > upTo) { g.visible = false; return; }
    g.visible = true;
    const end = Math.min(t.end, upTo);
    const p = place('thread', t.lane, t.angle);
    const pts = [];
    for (let i = 0; i <= 24; i++) {
      const f = i / 24;
      const x = X(t.start) + (X(end) - X(t.start)) * f;
      // A thread does not resolve, it recurs -- so it leaves and returns symmetrically
      // rather than arcing out and landing on a payoff the way a subplot does.
      const k = Math.sin(f * Math.PI);
      pts.push(new THREE.Vector3(x, p.y * k, p.z * k));
    }
    const tcurve = new THREE.CatmullRomCurve3(pts);
    const tw = threadWeight(t.id, 0.5);
    const ttaper = (f) => 0.3 + 0.7 * Math.sin(Math.min(1, Math.max(0, f)) * Math.PI);
    const tube = new THREE.Mesh(
      taperTube(new THREE.TubeGeometry(tcurve, 50, tw, 6, false), tcurve, 50, 6, ttaper),
      g.userData.mat);
    const tcased = new THREE.Mesh(
      taperTube(new THREE.TubeGeometry(tcurve, 50, tw * 2.3, 6, false), tcurve, 50, 6, ttaper),
      casingMaterial());
    tube.userData = g.userData; tcased.userData = g.userData;
    g.add(tcased); g.add(tube);
    g.userData.tube = tube; g.userData.cased = tcased;
    addGlow(g, tcurve, 50, 6, tw, C.thread,
      GLOW.thread * densityScale(localDensity(t, spine.threads)), ttaper);
    picks.push(tube);
    g.userData.tag.position.set(X(t.start) - 6, p.y * 0.6 + 3, p.z * 0.6);
  });

  strandObjs.forEach((g) => {
    const s = g.userData.data;
    if (g.userData.line) { g.remove(g.userData.line); g.userData.line.geometry.dispose(); }
    if (s.start > upTo) { g.visible = false; return; }
    g.visible = true;
    const p = place('strand', s.lane, s.angle);
    const a = new THREE.Vector3(X(s.start), p.y, p.z);
    const b = new THREE.Vector3(X(Math.min(s.end, upTo)), p.y, p.z);
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([a, b]),
      new THREE.LineDashedMaterial({
        color: C.character, dashSize: 3, gapSize: 3, transparent: true, opacity: 0.5,
      }));
    line.computeLineDistances();
    g.add(line);
    g.userData.line = line;
    g.children.forEach((ch) => {
      if (!ch.userData || !ch.userData.bead) return;
      ch.visible = ch.userData.ord <= upTo;
      ch.position.set(X(ch.userData.ord), p.y, p.z);
    });
    g.userData.tag.position.set(X(s.start) - 8, p.y, p.z);
  });
}

function applyTime() {
  [groups.structure, groups.scenes, groups.flags].forEach((grp) => {
    grp.children.forEach((m) => {
      if (m.userData && m.userData.ord) m.visible = m.userData.ord <= upTo;
    });
  });
  groups.structure.children.forEach((m) => {
    if (m.type === 'Sprite' || m.geometry instanceof THREE.CylinderGeometry) { /* labels follow below */ }
  });
  rebuildCurves();
}

// ---- layers, filters -------------------------------------------------------------
// Plants, reveals and notes are ON from the start. They were off, which is why they
// could not be found: the layer holding the flagged lines was hidden by default.
const shown = { structure: true, scenes: false, flags: true, ribbons: true, threads: false, strands: false };
function syncLayers() {
  groups.structure.visible = shown.structure;
  groups.scenes.visible = shown.scenes;
  groups.flags.visible = shown.flags;
  groups.ribbons.visible = shown.ribbons;
  groups.threads.visible = shown.threads;
  groups.strands.visible = shown.strands;
}
document.querySelectorAll('#layers .row').forEach((el) => {
  el.addEventListener('click', () => {
    const k = el.dataset.layer;
    shown[k] = !shown[k];
    el.classList.toggle('on', shown[k]);
    syncLayers();
  });
});

let filter = 'all';
document.querySelectorAll('#filters .row').forEach((el) => {
  el.addEventListener('click', () => {
    filter = el.dataset.filter;
    document.querySelectorAll('#filters .row').forEach((o) => o.classList.toggle('on', o === el));
    flagMeshes.forEach((m) => {
      const t = m.userData.kind;
      m.visible = filter === 'all'
        || (filter === 'plants' && t === 'plant')
        || (filter === 'reveals' && t === 'reveal')
        || (filter === 'notes' && (t === 'note' || t === 'thread'))
        || (filter === 'unpaid' && t === 'plant' && openIds.has(m.userData.id));
    });
    ribbonObjs.forEach((g) => {
      g.visible = filter === 'all' || filter === 'plants' || filter === 'reveals'
        ? g.userData.data.start <= upTo
        : (filter === 'unpaid' ? (g.userData.data.open && g.userData.data.start <= upTo) : false);
    });
  });
});

// ---- camera: orbit about X, pan along X, never roll --------------------------------
const target = new THREE.Vector3(0, 0, 0);

// The distance that frames the whole saga: half the axis, divided by the tangent of half
// the horizontal field of view. Computed rather than guessed -- a fixed default framed a
// 17-chapter saga from inside the braid.
function framingDistance() {
  const width = Math.max(1, (N - 1) * SLOT) * 0.98;
  const vFov = (camera.fov * Math.PI) / 180;
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
  return Math.max(120, (width / 2) / Math.tan(hFov / 2));
}

// theta is ELEVATION above the spine. The offset is a true spherical one, so dist is
// really the distance; the earlier version scaled y and z differently and put the camera
// a third of the way in from where it claimed to be.
let theta = 0.34, dist = 480;
function updateCamera() {
  camera.position.set(
    target.x,
    target.y + Math.sin(theta) * dist,
    target.z + Math.cos(theta) * dist,
  );
  camera.up.set(0, 1, 0);          // no roll, ever: X keeps a fixed screen direction
  camera.lookAt(target);
  groups.books.rotation.x = -theta;
}

let drag = null;
renderer.domElement.addEventListener('pointerdown', (e) => {
  drag = { x: e.clientX, y: e.clientY, theta, tx: target.x, ty: target.y, moved: false,
           pan: e.button === 2 || e.shiftKey };
  renderer.domElement.setPointerCapture(e.pointerId);
});
let hoverId = null;
let hoverTick = 0;
renderer.domElement.addEventListener('pointermove', (e) => {
  // Hover is the same emphasis at a fraction of the strength. Throttled, because a raycast
  // per mouse move over sixty tubes is work nobody asked for.
  if (!drag && !selected && (hoverTick = (hoverTick + 1) % 3) === 0) {
    const v = new THREE.Vector2((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    ray.setFromCamera(v, camera);
    const cands = [];
    ribbonObjs.forEach((g) => { if (g.visible && g.userData.tube) cands.push(g.userData.tube); });
    const hit = ray.intersectObjects(cands, false)[0];
    const id = hit ? hit.object.userData.data.id : null;
    if (id !== hoverId) {
      hoverId = id;
      applyEmphasis(id ? new Set([id]) : new Set(), 0.45);
    }
  }
  if (!drag) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
  if (drag.pan) {
    target.x = drag.tx - dx * dist * 0.0016;
    target.y = drag.ty + dy * dist * 0.0016;
  } else {
    theta = Math.max(-1.35, Math.min(1.35, drag.theta - dy * 0.006));
    target.x = drag.tx - dx * dist * 0.0016;
  }
  updateCamera();
});
renderer.domElement.addEventListener('pointerup', (e) => {
  const wasDrag = drag && drag.moved;
  drag = null;
  if (!wasDrag) pick(e.clientX, e.clientY);
});
renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());
renderer.domElement.addEventListener('wheel', (e) => {
  e.preventDefault();
  dist = Math.max(45, Math.min(1400, dist * (e.deltaY < 0 ? 0.9 : 1.11)));
  updateCamera();
}, { passive: false });

// ---- picking and the detail sheet ---------------------------------------------------
const ray = new THREE.Raycaster();
let selected = null;
function pick(cx, cy) {
  const v = new THREE.Vector2((cx / innerWidth) * 2 - 1, -(cy / innerHeight) * 2 + 1);
  ray.setFromCamera(v, camera);
  const candidates = picks.filter((m) => m.visible && m.parent && m.parent.visible);
  ribbonObjs.forEach((g) => { if (g.visible && g.userData.tube) candidates.push(g.userData.tube); });
  const hits = ray.intersectObjects(candidates, false);
  select(hits.length ? hits[0].object.userData : null);
}

function esc(s) {
  return String(s == null || s === '' ? '—' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
const row = (k, v) => '<dt>' + k + '</dt><dd>' + esc(v) + '</dd>';

// Selection contrast, in BOTH directions. Raising the chosen thread alone does not read at
// twenty-one concurrent: it is one bright line among twenty bright lines. So the chosen
// thread goes up in saturation and glow, and every other thread simultaneously drops to a
// low, desaturated state -- still present as context, never invisible.
//
// The cost, stated: unselected threads become transparent while a selection is active, and
// transparent surfaces do not write depth, so the over-under interlacing is degraded for
// the dimmed threads until the selection is cleared. That is the right trade -- when the
// question is "where does this one go", the weave of the others is not the thing being read
// -- but it is a real loss and not a free win.
function applyEmphasis(lit, strength) {
  const active = lit && lit.size > 0;
  ribbonObjs.forEach((g) => {
    const on = active && lit.has(g.userData.data.id);
    const base = g.userData.data.open ? C.ribbonOpen : C.ribbon;
    const mat = g.userData.mat;

    if (!active) {
      mat.color.set(base);
      mat.emissive.set(base);
      mat.emissiveIntensity = 0.22;
      mat.transparent = false;
      mat.opacity = 1;
    } else if (on) {
      // Up in saturation as well as in light: a brighter pale thread still reads pale.
      mat.color.copy(saturated(base, 0.3, 1.25));
      mat.emissive.copy(saturated(base, 0.3, 1.0));
      mat.emissiveIntensity = (0.28 + 0.85 * strength) * (C.glow ? 1 : 0.35);
      mat.transparent = false;
      mat.opacity = 1;
    } else {
      // Dimmed, not drained. An earlier version dropped unselected threads to a tenth of
      // their saturation, which meant one click turned the entire picture grey and the
      // braid stopped looking like dyed thread at all. The contrast now comes from lifting
      // the selected thread rather than from bleaching the other twenty-six: they keep
      // their hue and most of their weight, and simply stop glowing.
      mat.color.copy(saturated(base, -0.12, 0.86));
      mat.emissive.copy(saturated(base, -0.12, 0.5));
      mat.emissiveIntensity = 0.06 * C.glow;
      mat.transparent = true;
      mat.opacity = 1 - 0.4 * strength;
    }
    mat.needsUpdate = true;

    g.userData.glows.forEach((gl) => {
      const rest = gl.userData.restOpacity;
      gl.material.opacity = !active ? rest
        : (on ? Math.min(0.7, rest * (1 + 3.6 * strength)) : rest * (1 - 0.55 * strength));
    });
  });
}

function markersFor(flagId) {
  return flagMeshes.filter((m) => m.userData.id === flagId && m.visible);
}

function drawLinks(u) {
  while (links.children.length) {
    const c = links.children.pop();
    if (c.geometry) c.geometry.dispose();
    if (c.material) c.material.dispose();
  }
  if (!u || !u.flag || (u.kind !== 'plant' && u.kind !== 'reveal')) return;

  const outward = u.kind === 'plant' ? C.plant : C.reveal;
  const from = markersFor(u.id);
  if (!from.length) return;

  (counterparts[u.id] || []).forEach((other) => {
    markersFor(other.id).forEach((to) => {
      from.forEach((f) => {
        // Bowed, not straight. A chord cutting across the braid reads as a different kind
        // of thing from the arcs around it; bowing it outward from the spine -- the same
        // direction the subplot itself departs in -- makes the connector read as the same
        // gesture drawn thinner.
        const a = f.position.clone(), b = to.position.clone();
        const mid = a.clone().add(b).multiplyScalar(0.5);
        mid.y *= 1.45;
        mid.z *= 1.45;
        // Two flags both sitting on the axis would give a midpoint on the axis and a dead
        // straight line, so give it somewhere to bow to.
        if (Math.hypot(mid.y, mid.z) < 4) mid.y -= 9;
        const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
        const geo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(44));
        links.add(new THREE.Line(geo, new THREE.LineBasicMaterial({
          color: outward, transparent: true, opacity: 0.85,
        })));
      });
    });
  });
}

function select(u) {
  // Selecting either END of a pair lights the ribbon between them: that is the answer to
  // "where does this go", and it should not require finding the tube by eye first.
  const litRibbons = new Set();
  if (u && u.kind === 'ribbon') litRibbons.add(u.data.id);
  if (u && u.flag) {
    if (u.ribbon) litRibbons.add(u.ribbon.id);
    (u.data.pairs || []).forEach((m) => litRibbons.add(m.id));
  }
  applyEmphasis(litRibbons, 1);
  selected = u;
  const box = document.getElementById('detail');
  if (!u) { box.classList.remove('on'); drawLinks(null); return; }
  const d = u.data;
  let head = '', sub = '', body = '';
  if (u.kind === 'chapter') {
    head = d.title; sub = 'Book ' + (d.book + 1) + ' · Act ' + d.act;
    body = row('position', 'chapter ' + u.ord + ' of ' + N)
      + row('words', d.words) + row('scenes', (scenesByChapter[d.id] || []).length)
      + row('status', d.status);
  } else if (u.kind === 'scene') {
    head = d.title || 'Untitled scene'; sub = 'Scene';
    body = row('told by', d.pov) + row('summary', clip(d.summary, 190));
  } else if (u.kind === 'ribbon') {
    head = d.label; sub = 'Subplot';
    body = row('opens', 'chapter ' + d.start)
      + row(d.open ? 'status' : 'resolves', d.open ? 'still open — nothing claims it' : 'chapter ' + d.end)
      + row('planted', d.plants.length) + row('revealed', d.reveals.length)
      + row('spans', d.spansBooks + (d.spansBooks === 1 ? ' book' : ' books'));
  } else if (u.kind === 'thread-arc') {
    head = d.label; sub = 'Mythic thread';
    body = row('first touch', 'chapter ' + d.start) + row('last touch', 'chapter ' + d.end)
      + row('touches', d.touches.length)
      + row('spans', d.spansBooks + (d.spansBooks === 1 ? ' book' : ' books'));
  } else if (u.kind === 'strand') {
    head = d.label; sub = 'Character';
    body = row('first seen', 'chapter ' + d.start) + row('last seen', 'chapter ' + d.end)
      + row('appears in', d.beads.length + ' of ' + N + ' chapters')
      + row('gaps mean', 'no moment recorded — not absence');
  } else {
    head = d.label || clip(d.text, 40);
    sub = u.kind === 'thread' ? 'Mythic thread' : u.kind[0].toUpperCase() + u.kind.slice(1);
    body = row('position', 'chapter ' + u.ord)
      + row('attached to', d.sceneId ? 'a scene' : 'the whole chapter')
      + row('subplots', (d.pairs || []).map((p) => p.label || p.id).join(', '))
      + row('the line', clip(d.text, 200));

    // The far end, in words. The ribbon draws it, but "where is this answered" should be
    // readable without following a curve across the screen -- and for an unpaid plant the
    // answer is a real state to report, not an empty list.
    const others = counterparts[d.id] || [];
    if (u.kind === 'plant') {
      body += others.length
        ? row('paid off in', others.map((o) => {
            const g = flagById[o.id];
            return g ? 'chapter ' + axis.ordinal[g.chapterId] + ' — ' + clip(g.label || g.text, 34) : '?';
          }).join('; '))
        : row('paid off in', 'nothing claims this yet');
    } else if (u.kind === 'reveal') {
      body += others.length
        ? row('planted in', others.map((o) => {
            const g = flagById[o.id];
            return g ? 'chapter ' + axis.ordinal[g.chapterId] + ' — ' + clip(g.label || g.text, 34) : '?';
          }).join('; '))
        : row('planted in', 'not joined to a plant');
    }
  }
  document.getElementById('dbody').innerHTML =
    '<h2>' + esc(head) + '</h2><div class="sub">' + esc(sub) + '</div><dl>' + body + '</dl>';
  box.classList.add('on');
  drawLinks(u);
}
document.getElementById('dclose').addEventListener('click', () => select(null));

// ---- index -------------------------------------------------------------------------
const TABS = {
  Chapters: () => axis.sorted.map((c) => ({
    label: clip(c.title, 30), note: 'ch ' + axis.ordinal[c.id],
    go: () => { focusOn(X(axis.ordinal[c.id])); select(chapterMesh[c.id].userData); },
  })),
  Subplots: () => spine.ribbons.map((r) => ({
    label: clip(r.label, 30), note: r.open ? 'open' : r.start + '–' + r.end,
    go: () => { shown.ribbons = true; syncLayers(); focusOn(X(r.start)); select({ kind: 'ribbon', data: r, ord: r.start }); },
  })),
  Characters: () => spine.strands.map((s) => ({
    label: s.label, note: s.beads.length + ' ch',
    go: () => { shown.strands = true; syncLayers(); document.querySelector('[data-layer=strands]').classList.add('on'); focusOn(X(s.start)); select({ kind: 'strand', data: s, ord: s.start }); },
  })),
  Threads: () => spine.threads.map((t) => ({
    label: clip(t.label, 30), note: t.touches.length + ' touches',
    go: () => { shown.threads = true; syncLayers();
      document.querySelector('[data-layer=threads]').classList.add('on');
      focusOn(X(t.start)); select({ kind: 'thread-arc', data: t, ord: t.start }); },
  })),
  Open: () => spine.ribbons.filter((r) => r.open).map((r) => ({
    label: clip(r.label, 30), note: 'from ' + r.start,
    go: () => { shown.ribbons = true; syncLayers(); focusOn(X(r.start)); select({ kind: 'ribbon', data: r, ord: r.start }); },
  })),
};
let tab = 'Chapters';
function renderIndex() {
  document.getElementById('tabs').innerHTML = Object.keys(TABS)
    .map((t) => '<button class="' + (t === tab ? 'on' : '') + '" data-tab="' + t + '">' + t + '</button>').join('');
  document.querySelectorAll('#tabs button').forEach((b) => b.addEventListener('click', () => {
    tab = b.dataset.tab; renderIndex();
  }));
  const items = TABS[tab]();
  const list = document.getElementById('ilist');
  list.innerHTML = items.map((it, i) =>
    '<div class="item" data-i="' + i + '">' + esc(it.label) + '<span>' + esc(it.note) + '</span></div>').join('')
    || '<div class="item" style="color:#7f8fa0">nothing here yet</div>';
  list.querySelectorAll('.item').forEach((el) => {
    if (el.dataset.i === undefined) return;
    el.addEventListener('click', () => items[+el.dataset.i].go());
  });
}
function focusOn(x) { target.x = x; dist = Math.min(dist, framingDistance() * 0.4); updateCamera(); }

// ---- flatten, scrub, reset ----------------------------------------------------------
const flatSw = document.getElementById('flat');
flatSw.addEventListener('click', () => {
  const to = flatten > 0.5 ? 0 : 1;
  flatSw.classList.toggle('on', to === 1);
  const from = flatten, t0 = performance.now();
  (function step(now) {
    const p = Math.min(1, (now - t0) / 520);
    const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
    flatten = from + (to - from) * e;
    rebuildCurves();
    if (p < 1) requestAnimationFrame(step);
  })(t0);
});

const slider = document.getElementById('upto');
slider.max = String(N); slider.value = String(N);
slider.addEventListener('input', () => {
  upTo = +slider.value;
  document.getElementById('uptolab').textContent = 'showing the saga up to chapter ' + upTo;
  applyTime();
});

// Switching the axis re-ranks every chapter, which moves every other coordinate with it --
// lanes, ribbons, flags and all. Rather than mutate a live scene into an inconsistent
// half-state, the page reloads under the other ordering. It is the honest, cheap answer for
// a prototype; the real renderer would rebuild in place.
const orderSw = document.getElementById('order');
const params = new URLSearchParams(location.search);
const wantStory = params.get('order') === 'story';
orderSw.classList.toggle('on', wantStory);
if (!axis.storyTimesSet) {
  document.getElementById('orderLabel').textContent = 'As it happened — no times set';
  orderSw.classList.add('dim');
}
orderSw.addEventListener('click', () => {
  if (!axis.storyTimesSet) return;      // nothing to reorder by; the label already says so
  params.set('order', wantStory ? 'read' : 'story');
  location.search = params.toString();
});

// Zoom by the same dolly the wheel uses, so the buttons and the wheel cannot disagree.
function dolly(factor){
  dist = Math.max(45, Math.min(1400, dist * factor));
  updateCamera();
}
document.getElementById('zoom-in').addEventListener('click', () => dolly(0.78));
document.getElementById('zoom-out').addEventListener('click', () => dolly(1.28));
document.getElementById('zoom-fit').addEventListener('click', () => {
  theta = 0.34; dist = framingDistance(); target.set(0, 0, 0); updateCamera();
});

document.getElementById('reset').addEventListener('click', () => {
  theta = 0.34; dist = framingDistance(); target.set(0, 0, 0); updateCamera();
});
document.getElementById('top').addEventListener('click', () => {
  theta = 1.3; dist = framingDistance() * 0.85; target.set(0, 0, 0); updateCamera();
});

// ---- go ------------------------------------------------------------------------------
// Landscape is the supported orientation; portrait on a narrow viewport shows the prompt
// instead of the graph. Nothing is disposed and no state is reset, so rotating back reveals
// the same scene at the same camera position with no reload.
// The braid always renders. An earlier version refused portrait on a narrow viewport and
// asked the reader to rotate, which was wrong twice over: it fired on laptops whose
// dimensions or pointer type were transiently misread, and even where it fired correctly it
// made the reader do work the app should do. A narrow window shows a narrower slice of the
// axis, which pans and zooms like any other view.

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// Some environments resize the viewport without emitting a resize event -- device
// emulators and embedded panes among them -- which leaves the canvas at a stale size.
// Observing the element itself catches those.
if (window.ResizeObserver) {
  new ResizeObserver(() => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  }).observe(document.documentElement);
}

document.getElementById('subtitle').textContent =
  window.__SOURCE__ + ' · ' + N + ' chapters · ' + axis.books.length + ' book(s) · ' +
  raw.flags.length + ' flagged · ' + spine.ribbons.length + ' subplots · ' +
  spine.ribbons.filter((r) => r.open).length + ' still open' +
  (axis.order === 'story' ? ' · ordered as it happened' : '');
document.getElementById('uptolab').textContent = 'showing the whole saga';
document.getElementById('bar').hidden = false;
document.getElementById('footer').hidden = false;

// One dropdown open at a time, and any touch of the canvas closes them: the braid should
// never be competing with a panel for the screen.
const dds = Array.prototype.slice.call(document.querySelectorAll('.dd'));
dds.forEach((d) => d.addEventListener('toggle', () => {
  if (d.open) dds.forEach((o) => { if (o !== d) o.open = false; });
}));
renderer.domElement.addEventListener('pointerdown', () => {
  dds.forEach((d) => { d.open = false; });
});
document.getElementById('boot').style.display = 'none';

syncLayers();
renderIndex();
applyTime();
dist = framingDistance();
updateCamera();

// A label nobody can read is worse than no label: twenty-seven subplot names at saga zoom
// rendered as a single illegible smear across the braid. So names appear when there is room
// for them -- chapter titles as the camera comes in, a subplot's name when it is open (there
// are few of those and they are the ones worth naming) or when it is the thing selected.
function updateLabels() {
  const frame = framingDistance();
  const near = dist < frame * 0.55;

  // Collision avoidance, in screen space. Overlapping titles read as a rendering fault
  // whatever the palette, so this runs before anything cosmetic can matter: each candidate
  // is projected, and one that would land on a label already placed is simply not drawn.
  // Nearest-to-centre wins, so the thing being looked at keeps its name.
  const placed = [];
  const cx = innerWidth / 2, cy = innerHeight / 2;
  const fits = (sp, padPx) => {
    const v = sp.position.clone().project(camera);
    if (v.z > 1) return null;
    const x = (v.x + 1) / 2 * innerWidth;
    const y = (-v.y + 1) / 2 * innerHeight;
    // Measure the sprite's real screen width by projecting a point half its world width
    // away along the camera's right vector. The previous estimate was a fudge factor and
    // hid almost every title.
    const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
    const edge = sp.position.clone().add(right.multiplyScalar(sp.scale.x / 2)).project(camera);
    const ex = (edge.x + 1) / 2 * innerWidth;
    const w = Math.max(24, Math.abs(ex - x) * 2) + padPx;
    const h = 15 + padPx;
    if (x < -w || x > innerWidth + w || y < -h || y > innerHeight + h) return null;
    return { x, y, w, h, d: Math.hypot(x - cx, y - cy) };
  };
  const claim = (box) => {
    for (const p of placed) {
      if (Math.abs(box.x - p.x) < (box.w + p.w) / 2 && Math.abs(box.y - p.y) < (box.h + p.h) / 2) {
        return false;
      }
    }
    placed.push(box);
    return true;
  };

  const candidates = [];
  chapterTitles.forEach((t) => {
    if (!near || t.userData.ord > upTo || !groups.structure.visible) { t.visible = false; return; }
    const box = fits(t, 10);
    if (!box) { t.visible = false; return; }
    candidates.push({ sprite: t, box });
  });
  ribbonObjs.forEach((g) => {
    const r = g.userData.data;
    const want = g.visible && (r.open || (selected && selected.kind === 'ribbon' && selected.data.id === r.id));
    if (!want) { g.userData.tag.visible = false; return; }
    const box = fits(g.userData.tag, 8);
    if (!box) { g.userData.tag.visible = false; return; }
    candidates.push({ sprite: g.userData.tag, box });
  });
  threadObjs.forEach((g) => {
    if (!g.visible || !groups.threads.visible) { g.userData.tag.visible = false; return; }
    const box = fits(g.userData.tag, 8);
    if (!box) { g.userData.tag.visible = false; return; }
    candidates.push({ sprite: g.userData.tag, box });
  });
  strandObjs.forEach((g) => {
    if (!g.visible || !groups.strands.visible) { g.userData.tag.visible = false; return; }
    const box = fits(g.userData.tag, 8);
    if (!box) { g.userData.tag.visible = false; return; }
    candidates.push({ sprite: g.userData.tag, box });
  });

  candidates.sort((a, b) => a.box.d - b.box.d);
  candidates.forEach((c) => { c.sprite.visible = claim(c.box); });

  // How large is a bead on screen, in device pixels? One projection answers it, and every
  // detail decision below follows from the answer rather than from a distance threshold.
  const beadPx = markScreenSize(2.5 * 1.35) * (window.devicePixelRatio || 1);
  const wantGrain = beadPx >= (grainOn ? PX_GRAIN - PX_HYST : PX_GRAIN);
  const wantBig = beadPx >= (detailOn ? PX_DETAIL - PX_HYST : PX_DETAIL);
  if (wantGrain !== grainOn || wantBig !== detailOn) {
    grainOn = wantGrain;
    detailOn = wantBig;
    beadTextures.forEach((b) => {
      if (detailOn && !b.grainBig) {
        b.grainBig = b.own(beadTexture(b.chapter, true, true));
        b.plainBig = b.own(beadTexture(b.chapter, false, true));
      }
      b.mat.map = detailOn
        ? (grainOn ? b.grainBig : b.plainBig)
        : (grainOn ? b.grainSmall : b.plainSmall);
      b.mat.needsUpdate = true;
    });
    markMaterials.forEach((m) => {
      m.mat.map = grainOn && m.grain ? m.grain : m.plain;
      m.mat.needsUpdate = true;
    });
  }

  chapterNumerals.forEach((n) => {
    n.visible = groups.structure.visible && n.userData.ord <= upTo && dist < frame * 0.8;
  });
}

(function loop() {
  requestAnimationFrame(loop);
  updateLabels();
  renderer.render(scene, camera);
})();

// Inspection handle. The same reasoning as the flat prototype's: the claims this makes --
// that a flag sits on its own ribbon, that selecting one end draws connectors to the other
// -- are only checkable from outside if the selection path is reachable from outside.
// Focus at any granularity, the same contract the character web answers: one id, which may
// be a chapter, a scene or a single flagged line. No translation is needed at either end
// because all three are keyed by their own database id here too.
function focusNode(id) {
  // Searched across the collections the braid actually keeps rather than through a single
  // lookup table: a chapter, a scene, a flagged line, a subplot and a thread live in
  // different groups here, and all five are addressed by their own database id.
  const chapter = chapterMesh[id];
  if (chapter) { focusOn(X(chapter.userData.ord)); select(chapter.userData); return; }

  const flag = flagMeshes.find((m) => m.userData.id === id);
  if (flag) {
    shown.flags = true; syncLayers();
    focusOn(X(flag.userData.ord)); select(flag.userData); return;
  }

  const scene = groups.scenes.children.find((m) => m.userData && m.userData.id === id);
  if (scene) {
    shown.scene = true; groups.scenes.visible = true;
    focusOn(X(scene.userData.ord)); select(scene.userData); return;
  }

  const ribbon = ribbonObjs.find((g) => g.userData.data.id === id);
  if (ribbon) {
    shown.ribbons = true; syncLayers();
    const r = ribbon.userData.data;
    focusOn(X(r.start)); select({ kind: 'ribbon', data: r, ord: r.start }); return;
  }

  const thread = threadObjs.find((g) => g.userData.data.id === id);
  if (thread) {
    shown.threads = true; syncLayers();
    const t = thread.userData.data;
    focusOn(X(t.start)); select({ kind: 'thread-arc', data: t, ord: t.start }); return;
  }
  // Anything else has been deleted since the caller opened the view; ignoring it is the
  // right answer, and the same one the character web gave.
}

function hostMessage(e) {
  let msg;
  try { msg = JSON.parse(e.data); } catch (err) { return; }
  if (msg && msg.type === 'focus' && msg.id) focusNode(msg.id);
}
window.addEventListener('message', hostMessage);
document.addEventListener('message', hostMessage);

window.__BRAID__ = {
  spine, scene, camera, groups, links, flagMeshes, counterparts,
  select, drawLinks, shown,
  flatten: () => flatten,
  focusNode,
  // Peak additive glow opacity summed across every thread overlapping one chapter. This is
  // the number the density guard exists to hold down, and it is reachable so the guard can
  // be checked instead of trusted.
  peakGlow: () => {
    let peak = 0, at = 0;
    for (let o = 1; o <= N; o++) {
      let sum = 0;
      spine.ribbons.forEach((r) => {
        if (r.start > o || r.end < o) return;
        sum += (r.open ? GLOW.open : GLOW.ribbon) * densityScale(localDensity(r, spine.ribbons));
      });
      if (sum > peak) { peak = sum; at = o; }
    }
    return { peak: +peak.toFixed(3), atChapter: at };
  },
};
</script>
`;
