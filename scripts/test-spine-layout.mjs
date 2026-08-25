// Tests for the spine's layout core. Imports graph/spine-layout.mjs directly, so what is
// tested is what the prototype page renders.
//
// Run: node scripts/test-spine-layout.mjs
//
// These replace the byte-identical-rebuild check, which proved only that JSON.stringify is
// a function. Each of these exercises an actual claim the layout makes.
import fs from 'node:fs';
import path from 'node:path';
import {
  computeSpine, allocateLanes, allocateLanesIncremental, angularCeiling,
  angularCeilingForViewport, heightFor, radiusFor, tierFor, tierForSlotPx, LOD, SLOT_PX, TARGET,
} from '../graph/spine-layout.mjs';

const ROOT = process.cwd();
const DEMO = path.join(ROOT, 'graph', 'character-web-demo.html');

function loadPayload() {
  const t = fs.readFileSync(DEMO, 'utf8');
  const at = t.indexOf('window.__GRAPH__ = ');
  if (at === -1) throw new Error('Run: node scripts/build-graph-demo.mjs');
  const open = t.indexOf('{', at);
  return JSON.parse(t.slice(open, t.indexOf('};', open) + 1));
}

let failures = 0;
function check(name, ok, detail) {
  console.log((ok ? '  PASS  ' : '  FAIL  ') + name + (detail ? '   ' + detail : ''));
  if (!ok) failures += 1;
}

// A seeded shuffle, so a failure is reproducible rather than intermittent.
function shuffle(list, seed) {
  const out = list.slice();
  let s = seed;
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const j = s % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const assignments = (spine) => ({
  ordinal: spine.axis.ordinal,
  ribbons: spine.ribbons.map((r) => r.id + '@' + r.lane + '/' + r.angle.toFixed(6)).sort(),
  strands: spine.strands.map((s) => s.id + '@' + s.lane + '/' + s.angle.toFixed(6)).sort(),
});

const payload = loadPayload();
const base = computeSpine(payload);

console.log('\nspine layout — ' + payload.chapters.length + ' chapters, ' +
  payload.flags.length + ' flags, ' + base.ribbons.length + ' subplots, ' +
  base.strands.length + ' characters\n');

// ---------------------------------------------------------------------------
console.log('(i) input order must not reach the output');
// Catches allocation walking a payload array or an object key set in fetch order rather
// than through an explicit sort.
{
  const shuffled = {
    ...payload,
    chapters: shuffle(payload.chapters, 7),
    flags: shuffle(payload.flags, 13),
    scenes: shuffle(payload.scenes, 29),
    events: shuffle(payload.events, 31),
    presence: shuffle(payload.presence || [], 37),
  };
  const other = computeSpine(shuffled);
  const a = JSON.stringify(assignments(base));
  const b = JSON.stringify(assignments(other));
  check('shuffled payload yields identical ordinals, lanes and angles', a === b,
    a === b ? '' : 'assignments diverged');
  check('shuffled payload yields identical open counts',
    JSON.stringify(base.openCounts) === JSON.stringify(other.openCounts));
  check('shuffled payload yields identical health signal set',
    JSON.stringify(base.health.signals.map((s) => s.kind + ':' + s.subject).sort()) ===
    JSON.stringify(other.health.signals.map((s) => s.kind + ':' + s.subject).sort()));
}

// ---------------------------------------------------------------------------
console.log('\n(ii) filtering must change visibility only');
// Allocation runs over the unfiltered set by construction: computeSpine takes no filter.
// The test proves the construction rather than trusting it -- if a filter were ever
// threaded in, this catches it.
{
  const hidden = base.ribbons.filter((r) => !r.open).slice(0, 3).map((r) => r.id);
  const refiltered = computeSpine(payload, { hiddenRibbons: hidden });
  check('hiding ' + hidden.length + ' subplots leaves every lane and angle untouched',
    JSON.stringify(assignments(base)) === JSON.stringify(assignments(refiltered)));

  // And the packing itself: removing an interval must not repack the survivors, which is
  // exactly why allocation is not allowed to see the filter.
  const ivs = base.ribbons.map((r) => ({ id: r.id, start: r.start, end: r.end }));
  const full = allocateLanes(ivs);
  const minus = allocateLanes(ivs.filter((iv) => iv.id !== ivs[0].id));
  const moved = Object.keys(minus.lane).filter((id) => minus.lane[id] !== full.lane[id]);
  check('greedy packing IS unstable under removal (so allocation must not see filters)',
    moved.length > 0, moved.length + ' subplots would move if it did');
}

// ---------------------------------------------------------------------------
console.log('\n(iii) reordering a chapter');
// The specified assertion -- "only downstream of the move" -- holds for ordinals and
// cannot hold for lanes: packing is global over concurrency, so moving a chapter changes
// which subplots coexist there, and a subplot that opened earlier can legitimately change
// lane. The provable claim is the one asserted here.
{
  const moveFrom = 12, moveTo = 3;
  const sorted = base.axis.sorted;
  const reordered = payload.chapters.map((c) => {
    const o = base.axis.ordinal[c.id];
    let next = o;
    if (o === moveFrom) next = moveTo;
    else if (o >= moveTo && o < moveFrom) next = o + 1;
    return { ...c, act: 1, seq: next };
  });
  const after = computeSpine({ ...payload, chapters: reordered });

  const changed = sorted.filter((c) => base.axis.ordinal[c.id] !== after.axis.ordinal[c.id])
    .map((c) => base.axis.ordinal[c.id]);
  const outsideSpan = changed.filter((o) => o < moveTo || o > moveFrom);
  check('ordinals change, and only inside the moved span',
    changed.length > 0 && outsideSpan.length === 0,
    changed.length + ' chapters moved, ' + outsideSpan.length + ' outside the span');

  const laneOf = (s) => Object.fromEntries(s.ribbons.map((r) => [r.id, r.lane]));
  const before = laneOf(base), now = laneOf(after);
  const ribbonMoved = Object.keys(before).filter((id) => before[id] !== now[id]);
  check('some subplot lanes change', ribbonMoved.length > 0, ribbonMoved.length + ' moved');

  // Stability beyond the moved span is NOT achievable and the earlier draft of this test
  // asserting it was wrong. Greedy packing walks intervals in (start, end, id) order
  // carrying lane-occupancy state forward, so changing any interval can change the walk
  // and move a ribbon that never overlapped the edit. What survives a reorder is the
  // packing's validity, not its assignments -- so that is what is asserted.
  const overlapsSpan = (r) => !(r.end < moveTo || r.start > moveFrom);
  const untouched = base.ribbons.filter((r) => !overlapsSpan(r));
  const alsoMoved = untouched.filter((r) => before[r.id] !== now[r.id]);
  console.log('        ' + alsoMoved.length + ' of ' + untouched.length +
    ' non-overlapping subplots also changed lane — expected, not a defect');
  check('packing is still valid after the reorder', validPacking(after.ribbons));
  check('packing is valid before it too', validPacking(base.ribbons));
}

// No two subplots that share any stretch of the axis may share a lane. This is the
// invariant; lane identity is not.
function validPacking(ribbons) {
  for (let i = 0; i < ribbons.length; i++) {
    for (let j = i + 1; j < ribbons.length; j++) {
      const a = ribbons[i], b = ribbons[j];
      if (a.lane !== b.lane) continue;
      if (!(a.end < b.start || b.end < a.start)) return false;
    }
  }
  return true;
}

// ---------------------------------------------------------------------------
console.log('\nopen plants — three rules, reported not reconciled');
{
  const c = base.openCounts;
  console.log('        groupings rule (pairs)       : ' + c.groupings + ' of ' + c.total + ' open');
  console.log('        hard-link rule (linkedPlant) : ' + c.hardLink + ' of ' + c.total + ' open');
  console.log('        Plant Ledger as implemented  : ' + c.ledger + ' of ' + c.total + ' open');
  // Reported, not asserted. The brief asked for three sources agreeing OR a discrepancy
  // reported; against this fixture they disagree for a known structural reason, so failing
  // the suite over it would train everyone to run it with the result ignored.
  const agree = c.groupings === c.hardLink && c.hardLink === c.ledger;
  if (!agree) {
    console.log('  REPORT  DISCREPANCY — the fixture carries pairs and no linkedPlant, so');
    console.log('          the Ledger and hard-link rules have nothing to match on and call');
    console.log('          every plant open. Two live models of one relationship; whichever');
    console.log('          survives, both halves of the app should not keep both.');
  } else {
    console.log('  REPORT  all three rules agree at ' + c.groupings);
  }
  check('Ledger and hard-link are the same rule, not two witnesses',
    c.ledger === c.hardLink, 'renderLedger resolves through findRevealForPlant only');
}

// ---------------------------------------------------------------------------
console.log('\nmulti-book banding (synthetic — the fixture is one book)');
{
  const perBook = Math.ceil(payload.chapters.length / 3);
  const synthetic = payload.chapters.map((c) => {
    const o = base.axis.ordinal[c.id] - 1;
    return { ...c, book: Math.floor(o / perBook), act: (o % perBook < perBook / 2) ? 1 : 2 };
  });
  const s = computeSpine({ ...payload, chapters: synthetic });
  check('three books produce three book bands', s.axis.books.length === 3,
    s.axis.books.map((b) => b.label + ' ch' + b.from + '-' + b.to).join(', '));
  check('act bands subdivide them', s.axis.acts.length === 6, s.axis.acts.length + ' act bands');
  check('every chapter falls in exactly one book band',
    s.axis.sorted.every((c) => !!s.axis.bookAt[s.axis.ordinal[c.id]]));
  check('unresolved-at-book-end fires only for books that are not the last',
    s.health.signals.filter((x) => x.kind === 'unresolved-at-book-end')
      .every((x) => x.ord < s.axis.slots));
}

// ---------------------------------------------------------------------------
console.log('\nlevel of detail');
{
  check('thresholds are ordered', LOD.bookBands < LOD.structure);
  check('tiers resolve', tierFor(0.05) === 'books' && tierFor(0.2) === 'structure' && tierFor(2) === 'detail',
    tierFor(0.05) + ' / ' + tierFor(0.2) + ' / ' + tierFor(2));
  check('tiers are also expressible in device pixels per chapter',
    tierForSlotPx(10) === 'books' && tierForSlotPx(30) === 'structure' && tierForSlotPx(90) === 'detail',
    SLOT_PX.structure + 'px / ' + SLOT_PX.detail + 'px boundaries');
  check('per-book and per-act rollups come from the same pass',
    base.axis.books.reduce((a, b) => a + b.flags, 0) ===
    base.axis.acts.reduce((a, b) => a + b.flags, 0),
    base.axis.books.reduce((a, b) => a + b.flags, 0) + ' flags counted both ways');
  check('open counts agree between the rollup and the rule',
    base.axis.books.reduce((a, b) => a + b.open, 0) === base.openCounts.groupings);
}

// ---------------------------------------------------------------------------
console.log('\nhealth');
{
  const byKind = {};
  base.health.signals.forEach((s) => { byKind[s.kind] = (byKind[s.kind] || 0) + 1; });
  console.log('        emitted: ' + (Object.keys(byKind).map((k) => k + '=' + byKind[k]).join(', ') || 'none'));
  console.log('        withheld (strand density ' + base.health.density.mean.toFixed(2) + '): ' +
    base.health.withheld.length + ' — ' + base.health.density.reason);
  check('every emitted signal is reliable',
    base.health.signals.every((s) => s.reliability === 'reliable'));
  check('unreliable signals are withheld unless the density gate passes',
    base.health.density.ok || base.health.signals.every((s) => s.kind !== 'long-absence'));
  check('subplot collision is not built', base.health.subplotCollision === null);

  const first = base.health.signals[0];
  const dismissed = computeSpine(payload, { dismissals: { [first.subject]: true } });
  check('a dismissal removes exactly one signal',
    dismissed.health.signals.length === base.health.signals.length - 1,
    first.kind + ' on ' + first.subject);
}

// ---------------------------------------------------------------------------
console.log('\npresets');
{
  check('default preset is standard with strands and round view hidden',
    base.preset.name === 'standard' && base.preset.visible.strands === false &&
    base.preset.visible.round === false && base.preset.visible.ribbons === true);
  const full = computeSpine({ ...payload, settings: { complexity: 'full' } });
  check('a settings value selects a different visible set',
    full.preset.name === 'full' && full.preset.visible.strands === true);
  check('an unknown value falls back rather than throwing',
    computeSpine({ ...payload, settings: { complexity: 'nonsense' } }).preset.name === 'standard');
}

// ---------------------------------------------------------------------------
console.log('\nincremental allocation — the fix for lane churn under reorder');
{
  const moveFrom = 12, moveTo = 3;
  const reordered = payload.chapters.map((c) => {
    const o = base.axis.ordinal[c.id];
    let next = o;
    if (o === moveFrom) next = moveTo;
    else if (o >= moveTo && o < moveFrom) next = o + 1;
    return { ...c, act: 1, seq: next };
  });

  const cold = computeSpine({ ...payload, chapters: reordered });
  const warm = computeSpine({ ...payload, chapters: reordered }, { previous: base.assignment });

  const laneOf = (s) => Object.fromEntries(s.ribbons.map((r) => [r.id, r.lane]));
  const b = laneOf(base);
  const coldMoved = Object.keys(b).filter((id) => laneOf(cold)[id] !== b[id]).length;
  const warmMoved = Object.keys(b).filter((id) => laneOf(warm)[id] !== b[id]).length;

  console.log('        cold repack moves ' + coldMoved + ' of ' + base.ribbons.length + ' subplots');
  console.log('        incremental moves ' + warmMoved);
  check('incremental moves strictly fewer subplots than a cold repack', warmMoved < coldMoved);
  check('incremental packing is still valid', validPacking(warm.ribbons));
  check('churn is reported', warm.churn.ribbon.kept + warm.churn.ribbon.moved === warm.ribbons.length,
    warm.churn.ribbon.kept + ' kept, ' + warm.churn.ribbon.moved + ' reassigned');

  // Feeding an unchanged project its own assignment must be a no-op, or the layout drifts
  // a little on every save, which is worse than reshuffling once.
  const idempotent = computeSpine(payload, { previous: base.assignment });
  check('re-running an unchanged project changes nothing',
    JSON.stringify(assignments(idempotent)) === JSON.stringify(assignments(base)),
    idempotent.churn.ribbon.moved + ' reassigned');

  check('the angular denominator never shrinks',
    warm.assignment.ribbon.count >= base.assignment.ribbon.count,
    base.assignment.ribbon.count + ' -> ' + warm.assignment.ribbon.count +
      (warm.churn.ribbon.grew ? ' (grew — one-time reflow)' : ' (held)'));

  // A cold start must still be a cold start rather than silently inheriting nothing.
  const scratch = allocateLanesIncremental(
    base.ribbons.map((r) => ({ id: r.id, start: r.start, end: r.end })), null);
  check('a cold start matches the non-incremental packing',
    JSON.stringify(scratch.lane) ===
    JSON.stringify(allocateLanes(base.ribbons.map((r) => ({ id: r.id, start: r.start, end: r.end }))).lane));
}

// ---------------------------------------------------------------------------
console.log('\nstory time — a sparse, nullable second ordering');
// The rule: mark the chapter that jumps, and everything after it follows until something
// says otherwise. Most chapters need no time at all.
{
  const none = computeSpine(payload);
  check('with no times set, story order equals reading order',
    none.axis.storyTimesSet === 0 &&
    JSON.stringify(computeSpine(payload, { order: 'story' }).axis.ordinal) ===
    JSON.stringify(none.axis.ordinal),
    'so the control can say there is nothing to show yet');

  // Chapters 8-10 are a flashback to before the book starts; 11 onward returns to the present.
  const withTimes = payload.chapters.map((c) => {
    const o = base.axis.ordinal[c.id];
    if (o === 1) return { ...c, storyTime: 1000 };
    if (o === 8) return { ...c, storyTime: 100 };
    if (o === 11) return { ...c, storyTime: 1100 };
    return c;
  });

  const story = computeSpine({ ...payload, chapters: withTimes }, { order: 'story' });
  const read = computeSpine({ ...payload, chapters: withTimes });
  const idOf = (o, s) => s.axis.sorted[o - 1].id;
  const readOrdOf = (id) => read.axis.ordinal[id];

  check('three marked chapters are counted', story.axis.storyTimesSet === 3);
  check('reading order is unchanged by the marks',
    JSON.stringify(read.axis.ordinal) === JSON.stringify(base.axis.ordinal));

  // The flashback run (read 8,9,10) should now come FIRST, in its own reading order.
  const firstThree = [1, 2, 3].map((o) => readOrdOf(idOf(o, story)));
  console.log('        story order opens with chapters read at ' + firstThree.join(', '));
  check('the flashback run leads, and keeps its internal order',
    JSON.stringify(firstThree) === JSON.stringify([8, 9, 10]));

  const rest = [];
  for (let o = 4; o <= story.axis.slots; o++) rest.push(readOrdOf(idOf(o, story)));
  check('everything else follows in reading order',
    JSON.stringify(rest) === JSON.stringify(rest.slice().sort((a, b) => a - b)),
    'unmarked chapters carry forward rather than scattering');
  check('story ordinals are still a contiguous 1..N',
    story.axis.sorted.every((c, i) => story.axis.ordinal[c.id] === i + 1));
  check('the axis reports which ordering it used',
    story.axis.order === 'story' && read.axis.order === 'read');

  // A time on a chapter that is already first changes nothing, and a run with no marks at
  // all before it must not be flung to the end by a missing value.
  const onlyLate = payload.chapters.map((c) =>
    (base.axis.ordinal[c.id] === 12 ? { ...c, storyTime: 5 } : c));
  const late = computeSpine({ ...payload, chapters: onlyLate }, { order: 'story' });
  check('chapters before any mark stay at the front in reading order',
    readOrdOf(late.axis.sorted[0].id) === 1);
}

// ---------------------------------------------------------------------------
console.log('\nnon-linear order — a reveal read before its plant');
// A flashback pays something off before it shows the setup. The span must cover both ends
// whichever way round they fall; an earlier version clamped it and collapsed such a
// grouping to a point, which drew nothing and said nothing.
{
  // A grouping that actually HAS both ends -- an open one has no reveal to arrive early.
  const paired = base.ribbons.find((r) => !r.open && r.plants.length && r.reveals.length);
  const pairId = paired.id;
  const plant = payload.flags.find((f) => f.id === paired.plants[0]);
  // Move this grouping's plant to the END of the saga, leaving its reveal early: the
  // payoff is now read long before the setup that explains it.
  const lastChapter = base.axis.sorted[base.axis.slots - 1];
  const flipped = payload.flags.map((f) =>
    (f.id === plant.id ? { ...f, chapterId: lastChapter.id } : f));

  const after = computeSpine({ ...payload, flags: flipped });
  const r = after.ribbons.find((x) => x.id === pairId);
  const before = base.ribbons.find((x) => x.id === pairId);

  check('the grouping still exists after the flip', !!r);
  check('its span covers both ends rather than collapsing',
    r && r.end > r.start, r ? 'ch ' + r.start + '–' + r.end : 'gone');
  check('it is marked as reversed', r && r.reversed === true);
  check('an ordinary grouping is not marked reversed', before && before.reversed === false);
  check('packing is still valid with a reversed grouping present', validPacking(after.ribbons));
}

// ---------------------------------------------------------------------------
console.log('\nthe id tiebreak — untested until now, on the one canonical coordinate');
// Neither the fixture nor the real manuscript contains a duplicate (book, act, order)
// triple, so the tiebreak in computeAxis has never executed. It is the last thing standing
// between two chapters claiming one slot and a non-deterministic X, and X is the only
// coordinate the design treats as canonical. Forced here.
{
  const dupes = payload.chapters.map((c, i) => ({
    ...c, book: 0, act: 1, seq: i < 6 ? 3 : c.seq,      // six chapters all claiming slot 3
  }));

  const a = computeSpine({ ...payload, chapters: dupes });
  const b = computeSpine({ ...payload, chapters: shuffle(dupes, 101) });
  const c = computeSpine({ ...payload, chapters: shuffle(dupes, 202) });

  const collided = dupes.filter((x) => x.seq === 3).length;
  check('the synthetic case really does collide', collided === 6, collided + ' chapters on one slot');

  const ords = (s) => JSON.stringify(s.axis.ordinal);
  check('duplicate triples resolve identically under three input orders',
    ords(a) === ords(b) && ords(b) === ords(c));

  const vals = a.axis.sorted.map((x) => a.axis.ordinal[x.id]);
  check('ordinals are still a contiguous 1..N despite the collision',
    vals.every((v, i) => v === i + 1), vals.length + ' chapters, no gaps or repeats');

  // The tiebreak must order by id, not by arrival: the six colliding chapters should come
  // out in id order among themselves.
  const collidedIds = a.axis.sorted
    .filter((x) => dupes.find((d) => d.id === x.id && d.seq === 3))
    .map((x) => x.id);
  const sortedIds = collidedIds.slice().sort();
  check('colliding chapters are ordered by id, not by input position',
    JSON.stringify(collidedIds) === JSON.stringify(sortedIds));
}

// ---------------------------------------------------------------------------
console.log('\nadaptive far tier — book-level rollup is not always a summary');
{
  // The real manuscript's shape: one book holding 41 of 52 chapters.
  const lopsided = payload.chapters.map((c, i) => ({
    ...c, book: i < 13 ? 0 : (i < 14 ? 1 : i < 15 ? 2 : 3), act: (i % 3) + 1, seq: i,
  }));
  const lop = computeSpine({ ...payload, chapters: lopsided });
  const biggest = Math.max(...lop.axis.books.map((b) => b.chapters));
  console.log('        largest book holds ' + biggest + ' of ' + lop.axis.slots +
    ' chapters -> far tier resolves to "' + lop.axis.farTier + '"');
  check('a dominant book pushes the far tier down to acts', lop.axis.farTier === 'acts');

  // An evenly divided saga should still roll up to books.
  const even = payload.chapters.map((c, i) => ({
    ...c, book: Math.floor(i / 5), act: (i % 2) + 1, seq: i,
  }));
  const ev = computeSpine({ ...payload, chapters: even });
  console.log('        evenly divided into ' + ev.axis.books.length +
    ' books -> far tier resolves to "' + ev.axis.farTier + '"');
  check('an evenly divided saga still rolls up to books', ev.axis.farTier === 'books');
  check('the demo fixture (one book) does not claim books as a far tier',
    base.axis.farTier === 'acts', 'one book cannot summarise itself');
}

// ---------------------------------------------------------------------------
console.log('\npath dependence — incremental allocation is order-dependent by construction');
// A real qualification on the determinism suite above, which tests cold starts only. The
// same project reached by two different edit paths will not have the same assignment.
// That is unavoidable in incremental colouring and is acceptable; it is reported rather
// than asserted away, because a suite that claimed equality here would be lying.
{
  // Both paths must land on the SAME end state, or this measures nothing. So the end state
  // is built once, absolutely, and the two paths differ only in the intermediate they pass
  // through on the way -- which is exactly the real case: two writers reaching the same
  // manuscript by different sequences of edits.
  const move = (chapters, from, to) => chapters.map((c) => {
    const o = base.axis.ordinal[c.id];
    let next = o;
    if (o === from) next = to;
    else if (o >= to && o < from) next = o + 1;
    return { ...c, act: 1, seq: next };
  });

  // These particular intermediates are chosen because they DO diverge. A scan of 315 path
  // pairs over this fixture found 160 diverging, so convergence is the exception -- an
  // earlier draft of this test happened to pick a converging pair and reported zero, which
  // would have read as a guarantee the design does not make.
  const finalChapters = move(payload.chapters, 12, 3);
  const viaA = move(payload.chapters, 2, 1);
  const viaB = move(payload.chapters, 11, 1);

  const stepA1 = computeSpine({ ...payload, chapters: viaA }, { previous: base.assignment });
  const stepA2 = computeSpine({ ...payload, chapters: finalChapters }, { previous: stepA1.assignment });

  const stepB1 = computeSpine({ ...payload, chapters: viaB }, { previous: base.assignment });
  const stepB2 = computeSpine({ ...payload, chapters: finalChapters }, { previous: stepB1.assignment });

  const laneOf = (s) => Object.fromEntries(s.ribbons.map((r) => [r.id, r.lane]));
  const a = laneOf(stepA2), b = laneOf(stepB2);
  const diverged = Object.keys(a).filter((id) => a[id] !== b[id]);
  console.log('        two edit orders, same end state: ' + diverged.length + ' of ' +
    Object.keys(a).length + ' subplots differ in lane');
  check('both paths still produce a valid packing',
    validPacking(stepA2.ribbons) && validPacking(stepB2.ribbons));
  check('both paths agree on ordinals — X is path-independent even when lanes are not',
    JSON.stringify(stepA2.axis.ordinal) === JSON.stringify(stepB2.axis.ordinal));

  const tidied = computeSpine({ ...payload, chapters: finalChapters },
    { previous: base.assignment, repack: true });
  const cold = computeSpine({ ...payload, chapters: finalChapters });
  check('an explicit repack converges on the cold-start assignment',
    JSON.stringify(laneOf(tidied)) === JSON.stringify(laneOf(cold)),
    'so the denominator comes back down only when asked');
  check('the denominator never falls without being asked',
    stepA2.assignment.ribbon.count >= base.assignment.ribbon.count);
}

// ---------------------------------------------------------------------------
console.log('\nangular capacity — against the real target, not a phone');
// The braid is a laptop-first surface. An earlier version of this derived its ceiling
// against a 390px phone in portrait, which was the wrong device; the formula is unchanged,
// only the usable height it is asked about.
{
  const laptop = angularCeilingForViewport();
  const phone = angularCeilingForViewport(390);
  console.log('        usable height ' + TARGET.usableHeight + 'px (of a ' +
    TARGET.width + 'x' + TARGET.height + ' window)');
  console.log('        concurrency ceiling: ' + laptop.readable +
    '   (a 390px phone in portrait would be ' + phone.readable + ')');
  console.log('        separation at the demo peak of 21: ' + laptop.separationAt(21).toFixed(1) + 'px');
  console.log('        separation at the ceiling of ' + laptop.readable + ': ' +
    laptop.separationAt(laptop.readable).toFixed(1) + 'px');

  check('the ceiling is finite and stated', laptop.readable > 0 && laptop.readable < 500);
  check('the laptop target carries more than the phone did', laptop.readable > phone.readable,
    phone.readable + ' -> ' + laptop.readable);
  check('the demo fixture sits comfortably under it', base.laneCounts.ribbon < laptop.readable,
    base.laneCounts.ribbon + ' concurrent against a ceiling of ' + laptop.readable);

  [26, 35, 40, 52].forEach((n) => {
    const h = heightFor(n);
    console.log('        ' + String(n).padStart(3) + ' concurrent -> ' +
      h.usableHeightPx.toFixed(0) + 'px usable (' + h.windowHeightNeeded.toFixed(0) +
      'px window)  ' + (h.fitsTarget ? 'fits' : 'does NOT fit ' + TARGET.width + 'x' + TARGET.height));
  });
  const forty = heightFor(40);
  check('40 concurrent still does not fit the target window', !forty.fitsTarget,
    forty.windowHeightNeeded.toFixed(0) + 'px of window needed against ' + TARGET.height);
  check('the growth is quadratic, so wrapping buys a little and then stops',
    Math.abs(heightFor(40).usableHeightPx / heightFor(20).usableHeightPx - 4) < 0.01,
    'doubling concurrency costs 4x the height');
}

console.log('\n' + (failures ? failures + ' FAILING' : 'all passing') + '\n');
process.exit(failures ? 1 : 0);
