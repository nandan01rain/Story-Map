// Runs the spine's geometry against the local project dump and reports what it finds.
//
// Run:
//   node scripts/dump-project-structure.mjs <projectId>
//   node scripts/spine-report.mjs
//
// This is what closes the multi-book caveat: every banding, ordinal and rollup claim made
// so far has been checked against a one-book fixture with its book numbers reassigned by
// the test. Here they meet a real five-book manuscript.
import fs from 'node:fs';
import path from 'node:path';
import { computeSpine, tierFor, angularCeiling } from '../graph/spine-layout.mjs';

const SRC = path.join(process.cwd(), 'graph', '.local-project.json');
if (!fs.existsSync(SRC)) {
  console.error('graph/.local-project.json is missing. Run: node scripts/dump-project-structure.mjs <projectId>');
  process.exit(2);
}

const { project, payload } = JSON.parse(fs.readFileSync(SRC, 'utf8'));
const spine = computeSpine(payload);
const axis = spine.axis;

const pad = (s, n) => String(s).padEnd(n);
console.log('\n' + '='.repeat(70));
console.log(project.name);
console.log('='.repeat(70));

console.log('\nTHE AXIS');
console.log('  chapters          : ' + axis.slots);
console.log('  books             : ' + axis.books.length);
console.log('  acts              : ' + axis.acts.length);
console.log('  scenes            : ' + (payload.scenes || []).length);
console.log('  flags             : ' + (payload.flags || []).length);

// Ordinals must be a contiguous 1..N over (book, act, order) with an id tiebreak. On real
// data this is the first time that ranking meets duplicate orders, gaps, and whatever else
// a manuscript edited over months actually contains.
const ords = axis.sorted.map((c) => axis.ordinal[c.id]);
const contiguous = ords.every((v, i) => v === i + 1);
console.log('  ordinals 1..N     : ' + (contiguous ? 'contiguous' : 'BROKEN'));

const seen = {};
let dupSlots = 0;
axis.sorted.forEach((c) => {
  const k = c.book + ':' + c.act + ':' + c.seq;
  if (seen[k]) dupSlots += 1;
  seen[k] = true;
});
console.log('  duplicate (book,act,order) triples: ' + dupSlots +
  (dupSlots ? '  <- the id tiebreak is doing real work here' : ''));

console.log('  unanchorable      : ' + spine.unanchorable.count +
  (spine.unanchorable.count ? '  <- no flagged text, so they cannot be placed' : ''));
console.log('  far tier rolls to : ' + axis.farTier);

console.log('\nBOOK BANDS' + (axis.farTier === 'books' ? '  (the far view)' : ''));
axis.books.forEach((b) => {
  console.log('  ' + pad(b.label, 10) + ' ch ' + pad(b.from + '-' + b.to, 9) +
    pad(b.chapters + ' chapters', 15) + pad(b.flags + ' flagged', 13) +
    pad(b.open + ' open', 10) + (b.words ? (b.words / 1000).toFixed(0) + 'k words' : ''));
});

console.log('\nACT BANDS' + (axis.farTier === 'acts'
  ? '  (the far view — a book dominates, so books do not summarise)'
  : '  (the middle view)'));
axis.acts.forEach((a) => {
  console.log('  ' + pad(a.label, 22) + ' ch ' + pad(a.from + '-' + a.to, 9) +
    pad(a.chapters + ' chapters', 15) + a.flags + ' flagged');
});

const bookFlags = axis.books.reduce((n, b) => n + b.flags, 0);
const actFlags = axis.acts.reduce((n, a) => n + a.flags, 0);
console.log('\n  rollups agree: ' + (bookFlags === actFlags ? 'yes' : 'NO') +
  '  (' + bookFlags + ' both ways)');
console.log('  every chapter lands in exactly one book band: ' +
  (axis.sorted.every((c) => !!axis.bookAt[axis.ordinal[c.id]]) ? 'yes' : 'NO'));
console.log('  every chapter lands in exactly one act band : ' +
  (axis.sorted.every((c) => !!axis.actAt[axis.ordinal[c.id]]) ? 'yes' : 'NO'));

console.log('\nSUBPLOTS');
console.log('  groupings         : ' + spine.ribbons.length);
if (spine.ribbons.length) {
  let peak = 0, peakAt = 0;
  for (let o = 1; o <= axis.slots; o++) {
    const n = spine.ribbons.filter((r) => r.start <= o && r.end >= o).length;
    if (n > peak) { peak = n; peakAt = o; }
  }
  const spans = spine.ribbons.map((r) => r.end - r.start).sort((a, b) => a - b);
  console.log('  peak concurrency  : ' + peak + ' at chapter ' + peakAt);
  console.log('  median span       : ' + spans[Math.floor(spans.length / 2)] + ' chapters');
  console.log('  lanes needed      : ' + spine.laneCounts.ribbon);
  console.log('  angular ceiling   : ' + angularCeiling(210).readable);
} else {
  console.log('  nothing to draw — no plant or reveal is joined to anything, so the');
  console.log('  ribbon layer has no evidence here either way.');
}

console.log('\nCHARACTERS');
console.log('  strands           : ' + spine.strands.length);
console.log('  strand density    : ' + spine.health.density.mean.toFixed(2) +
  '  (' + spine.health.density.reason + ')');

console.log('\nHEALTH');
const byKind = {};
spine.health.signals.forEach((s) => { byKind[s.kind] = (byKind[s.kind] || 0) + 1; });
console.log('  emitted           : ' +
  (Object.keys(byKind).map((k) => k + '=' + byKind[k]).join(', ') || 'none'));
console.log('  withheld          : ' + spine.health.withheld.length + ' (density gate)');

console.log('\nLEVEL OF DETAIL');
[0.1, 0.5, 2].forEach((k) => {
  console.log('  zoom ' + pad(k, 5) + '-> ' + tierFor(k));
});
// The far tier is whichever level chooseFarTier picked, not books unconditionally --
// printing books.length here said "1 bands" for a one-book project whose far view is
// actually its three acts.
const farBands = axis.farTier === 'books' ? axis.books : axis.acts;
console.log('  at the far tier the reader sees ' + farBands.length + ' ' +
  (farBands.length === 1 ? 'band' : 'bands') + ' (' + axis.farTier +
  ') rather than ' + axis.slots + ' beads.');

// Claim only what this project actually exercised. The old line said "multi-book" for
// every project including one-book ones, which is the kind of unearned claim this whole
// exercise keeps catching elsewhere.
const held = contiguous && bookFlags === actFlags;
const scope = axis.books.length > 1
  ? axis.books.length + ' books'
  : 'one book (multi-book NOT exercised here)';
console.log('\n' + (held
  ? 'Axis, banding and rollups hold on ' + scope + '.'
  : 'SOMETHING FAILED — see above.'));

if (spine.unanchorable.count === 0) {
  console.log('Note: unanchorable is 0, but character_graph() only reports that field once');
  console.log('20260825_spine_support.sql is applied. Until then 0 means "not asked".');
}
console.log('');
