// Tests for Arachne's loom. Imports graph/arachne.mjs directly, so what is tested is what
// the apps and the agent actually run.
//
// Run: node scripts/test-arachne.mjs
//
// The anchor tests carry the weight here. A bad anchor does not throw and does not show up
// as a wrong number anywhere -- the annotation simply stops rendering, and the braid draws
// one thread fewer with nothing to say it should have drawn more. These are the tests that
// would catch that before a manuscript does.
import {
  chooseAnchor, joinGrouping, leaveGrouping, pairsOf, groupingIndex,
  planTranscription, planIsEmpty,
} from '../graph/arachne.mjs';

let failures = 0;
function check(name, ok, detail) {
  console.log((ok ? '  PASS  ' : '  FAIL  ') + name + (detail ? '   ' + detail : ''));
  if (!ok) failures += 1;
}

/* ---------- anchors ---------- */
console.log('\nanchors');

const prose = [
  'The ferryman refused payment.',
  '',
  'He said the river already owed him, and turned the boat about.',
  '',
  'Later, at the far bank, the ferryman refused payment again, and she understood.',
].join('\n');

{
  const a = chooseAnchor(prose, 'the river already owed him');
  check('an exact, unique quote is taken as-is', a.ok && a.reason === 'exact' && a.text === 'the river already owed him');
}
{
  // "the ferryman refused payment" appears twice, differing only in case at the start.
  const a = chooseAnchor(prose, 'ferryman refused payment');
  check('an ambiguous quote is widened, not guessed', a.ok && a.reason === 'widened');
  check('  ...and the widened anchor is unique', a.ok && prose.split(a.text).length - 1 === 1, JSON.stringify(a.text));
  check('  ...and still contains the quote', a.ok && a.text.includes('ferryman refused payment'));
  check('  ...and does not cross the paragraph break', a.ok && !a.text.includes('\n\n'));
}
{
  const a = chooseAnchor(prose, 'He said   the river\n already owed him');
  check('a quote whose whitespace was flattened still matches', a.ok, a.reason);
  check('  ...and the anchor is the exact prose, not the loosened copy', a.ok && prose.includes(a.text));
}
{
  const a = chooseAnchor(prose, 'she drew the knife and waited');
  check('a paraphrase fails loudly rather than binding to something near it', !a.ok && a.reason === 'not-in-chapter');
}
{
  const refrain = 'and so it went.\n\nand so it went.\n\nand so it went.';
  const a = chooseAnchor(refrain, 'and so it went.');
  check('an unanchorable refrain is reported, not bound to the first hit', !a.ok && a.reason === 'ambiguous');
  check('  ...and says how many times it occurred', a.occurrences === 3, String(a.occurrences));
}
{
  check('an empty quote is refused', !chooseAnchor(prose, '  ').ok);
  check('an empty chapter is refused', !chooseAnchor('', 'anything').ok);
}

/* ---------- groupings ---------- */
console.log('\ngroupings');

{
  const plant = { id: 1, type: 'plant', text: 'a', label: 'The debt' };
  const reveal = { id: 2, type: 'reveal', text: 'b', label: '' };
  const g = joinGrouping([plant, reveal], null, 'The debt');
  check('joining mints one grouping shared by both ends', pairsOf(plant)[0].id === pairsOf(reveal)[0].id);
  check('  ...carrying the grouping label', g.label === 'The debt' && pairsOf(reveal)[0].label === 'The debt');

  const before = JSON.stringify([plant.pairs, reveal.pairs]);
  joinGrouping([plant, reveal], g.id, 'The debt');
  check('re-joining the same members changes nothing', JSON.stringify([plant.pairs, reveal.pairs]) === before);

  const second = { id: 3, type: 'reveal', text: 'c' };
  joinGrouping([plant, second], g.id, 'The debt');
  check('a second reveal joins the same grouping', pairsOf(second)[0].id === g.id);
  check('  ...and the plant is still in exactly one grouping', pairsOf(plant).length === 1);

  const other = joinGrouping([plant, { id: 4, type: 'reveal', text: 'd' }], 'pair:other', 'A second job');
  check('one flag can belong to two groupings at once', pairsOf(plant).length === 2 && other.id === 'pair:other');

  leaveGrouping(plant, 'pair:other');
  check('leaving one grouping leaves the other intact', pairsOf(plant).length === 1 && pairsOf(plant)[0].id === g.id);
}
{
  const legacy = { id: 9, type: 'plant', text: 'x', pairId: 'pair:old', pairLabel: 'Old shape' };
  check('the superseded pairId shape still reads', pairsOf(legacy)[0].id === 'pair:old');
  joinGrouping([legacy], 'pair:new', 'New');
  check('  ...and is removed once converted', legacy.pairId === undefined && legacy.pairLabel === undefined);
}
{
  const chapters = [
    { id: 'c2', book: 0, act: 1, order: 2, annotations: [{ id: 2, type: 'reveal', text: 'b', pairs: [{ id: 'p1', label: 'Paid' }] }] },
    { id: 'c1', book: 0, act: 1, order: 1, annotations: [
      { id: 1, type: 'plant', text: 'a', pairs: [{ id: 'p1', label: 'Paid' }] },
      { id: 3, type: 'plant', text: 'c', pairs: [{ id: 'p2', label: 'Open' }] },
    ] },
  ];
  const index = groupingIndex(chapters);
  const paid = index.find((g) => g.id === 'p1');
  const open = index.find((g) => g.id === 'p2');
  check('a grouping with a reveal is paid', paid.paid === true);
  check('a grouping with no reveal is open, not broken', open.paid === false && open.plants.length === 1);
  check('members are gathered across chapters', paid.plants.length === 1 && paid.reveals.length === 1);
}

/* ---------- the plan ---------- */
console.log('\nthe plan');

{
  const chapters = [
    { id: 'ch4', book: 0, act: 1, order: 4, content: prose, annotations: [] },
    { id: 'ch31', book: 0, act: 3, order: 31, content: 'She paid the ferryman twice over, and he took it.', annotations: [] },
  ];
  const recognitions = [
    { kind: 'plant', chapterId: 'ch4', quote: 'the river already owed him', label: 'The debt', grouping: { key: 'debt', label: 'The debt' } },
    { kind: 'reveal', chapterId: 'ch31', quote: 'paid the ferryman twice over', label: 'The debt settled', grouping: { key: 'debt', label: 'The debt' } },
    { kind: 'note', chapterId: 'ch4', quote: 'turned the boat about', label: 'Charon', thread: 'Ferryman' },
  ];

  const plan = planTranscription(recognitions, chapters, 100);
  check('every recognition becomes one create', plan.creates.length === 3, JSON.stringify(plan.failures));
  check('a plant and a reveal in different chapters share one grouping', plan.joins.length === 2 && plan.joins[0].groupingId === plan.joins[1].groupingId);
  check('  ...which is the thing the editor structurally cannot do', plan.joins[0].chapterId !== plan.joins[1].chapterId);
  check('a note carries its thread and never joins a grouping', plan.creates[2].annotation.thread === 'Ferryman' && plan.joins.every((j) => j.index !== 2));
  check('ids are allocated from the caller\'s counter', plan.nextId === 103);

  // Apply it, then re-plan: the second run must be a no-op.
  plan.creates.forEach((c) => chapters.find((ch) => ch.id === c.chapterId).annotations.push(c.annotation));
  plan.joins.forEach((j) => {
    const ch = chapters.find((c) => c.id === j.chapterId);
    joinGrouping([ch.annotations.find((a) => a.id === j.annotationId)], j.groupingId, j.label);
  });

  const again = planTranscription(recognitions, chapters, plan.nextId);
  check('re-running the same transcription writes nothing', planIsEmpty(again), JSON.stringify({ c: again.creates.length, j: again.joins.length }));
  // Five, not three: each of the three flags is already flagged, and the two grouped ones are
  // additionally already grouped. Both halves have to be recognised as done independently, or
  // an interrupted session would re-join on resume.
  check('  ...and says why, for the flag and the grouping separately',
    again.skipped.length === 5 &&
    again.skipped.filter((s) => s.reason === 'already-flagged').length === 3 &&
    again.skipped.filter((s) => s.reason === 'already-grouped').length === 2,
    JSON.stringify(again.skipped.map((s) => s.reason)));
  // The property that makes the re-run safe: the grouping id is derived from the anchor
  // annotation's own id, so the same join computes the same id on a later run rather than
  // minting a second grouping over the same pair.
  check('  ...because the grouping id is derived, not generated',
    again.skipped.filter((s) => s.reason === 'already-grouped').every((s) => s.groupingId === plan.joins[0].groupingId));
}
{
  const chapters = [{ id: 'ch1', book: 0, act: 1, order: 1, content: prose, annotations: [] }];
  const plan = planTranscription([
    { kind: 'plant', chapterId: 'nope', quote: 'x' },
    { kind: 'plant', chapterId: 'ch1', quote: 'a line never written' },
    { kind: 'sonnet', chapterId: 'ch1', quote: 'the river already owed him' },
  ], chapters, 1);
  check('a bad plan produces failures, not partial writes', plan.creates.length === 0 && plan.failures.length === 3);
  check('  ...each naming its own reason', new Set(plan.failures.map((f) => f.reason)).size === 3);
}

console.log(failures === 0 ? '\nall passed\n' : '\n' + failures + ' FAILED\n');
process.exit(failures === 0 ? 0 : 1);
