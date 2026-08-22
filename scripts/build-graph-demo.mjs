// Writes graph/character-web-demo.html — the browser-runnable copy of the character web.
//
// Run: node scripts/build-graph-demo.mjs   (after build-demo-fixture.mjs)
//
// The copy in graph/ used to be a hand-maintained duplicate of the renderer with a small
// invented cast pasted into it. Two copies of a file that must behave identically is a
// promise nobody keeps, and it had already started to drift. This generates it instead:
// the markup comes straight out of CHARACTER_WEB_HTML, and the data is the real demo pack
// shaped exactly as the character_graph() function shapes it, so what opens in a browser is
// what the app renders, against material the app can actually load.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const HTML_SOURCE = path.join(ROOT, 'mobile', 'src', 'lib', 'characterWebHtml.ts');
const FIXTURE_SOURCE = path.join(ROOT, 'mobile', 'src', 'lib', 'demoFixture.ts');
const OUT = path.join(ROOT, 'graph', 'character-web-demo.html');

// Both sources are read as text rather than imported: one is a TypeScript module and the
// other carries type annotations, and neither is loadable by node without a build step this
// repo does not otherwise need.
function between(text, open, close, what) {
  const start = text.indexOf(open);
  if (start === -1) throw new Error(`${what}: could not find ${open}`);
  const from = start + open.length;
  const end = text.lastIndexOf(close);
  if (end <= from) throw new Error(`${what}: could not find the closing ${close}`);
  return text.slice(from, end);
}

const html = between(
  fs.readFileSync(HTML_SOURCE, 'utf8'),
  'export const CHARACTER_WEB_HTML = String.raw`',
  '`;',
  'renderer',
);

// A backtick anywhere inside a String.raw template ends the template, so the TypeScript
// module is broken even though the extraction above -- which reads to the LAST occurrence --
// still produced something that looks complete. Caught here because the symptom otherwise
// is a perfectly good demo page beside a module that will not compile.
if (html.includes('`')) {
  throw new Error(
    'CHARACTER_WEB_HTML contains a backtick, which terminates its String.raw template. ' +
      'Remove it (comments inside the markup must not quote identifiers with backticks).',
  );
}

const fixture = JSON.parse(
  between(
    fs.readFileSync(FIXTURE_SOURCE, 'utf8'),
    'export const DEMO_FIXTURE: DemoFixture = ',
    ';',
    'fixture',
  ),
);

// Ids are invented here rather than looked up, because the real ones are uuids the database
// assigns at import time. Their only requirement is to be stable within this one document.
const characterId = (key) => `c:${key}`;
const eventId = (chapter) => `e:${chapter}`;
const chapterId = (chapter) => `ch:${chapter}`;

const povKey = (pov) => {
  const wanted = String(pov || '').toLowerCase();
  const character = fixture.characters.find(
    (c) => c.key === wanted || c.label.toLowerCase() === wanted,
  );
  return character ? character.key : null;
};

// PRESENT_AT, derived the same way demoImport.ts derives it: a character is present in a
// chapter if they hold its POV or one of their relationships is scoped to it. Understates
// the truth, never invents a presence.
const presentAt = new Map(); // chapter number -> Set of character keys
const addPresence = (chapter, key) => {
  if (!key) return;
  if (!presentAt.has(chapter)) presentAt.set(chapter, new Set());
  presentAt.get(chapter).add(key);
};
for (const c of fixture.chapters) addPresence(c.number, povKey(c.pov));
for (const e of fixture.graphEdges) {
  if (e.chapter === null) continue;
  addPresence(e.chapter, e.from);
  addPresence(e.chapter, e.to);
}

// Only events somebody is actually standing in, matching character_graph()'s event_nodes.
const events = fixture.chapters
  .filter((c) => presentAt.has(c.number))
  .map((c) => ({
    id: eventId(c.number),
    label: c.title,
    type: 'event',
    needsReview: false,
    participants: presentAt.get(c.number).size,
    seq: c.number,
    properties: {
      chapter_id: chapterId(c.number),
      order: c.number,
      act: c.act,
      pov: c.pov,
      pov_character_id: povKey(c.pov) ? characterId(povKey(c.pov)) : null,
      summary: c.summary,
      ends_on: c.endsOn,
    },
  }));

const degree = new Map();
for (const e of fixture.graphEdges) {
  degree.set(e.from, (degree.get(e.from) ?? 0) + 1);
  degree.set(e.to, (degree.get(e.to) ?? 0) + 1);
}

const nodes = fixture.characters.map((c) => ({
  id: characterId(c.key),
  label: c.label,
  type: 'character',
  properties: { aliases: c.aliases },
  source: 'manual',
  needsReview: false,
  degree: degree.get(c.key) ?? 0,
}));

// The aggregate the renderer draws a line from, collapsed the way character_pair_edges
// collapses it: undirected, counted, and carrying the commonest interaction type.
const byPair = new Map();
for (const e of fixture.graphEdges) {
  const key = [e.from, e.to].sort().join('|');
  if (!byPair.has(key)) byPair.set(key, []);
  byPair.get(key).push(e);
}
const commonest = (values) => {
  const counts = new Map();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
};

const links = [...byPair.entries()].map(([key, group]) => {
  const [a, b] = key.split('|');
  return {
    source: characterId(a),
    target: characterId(b),
    count: group.length,
    type: commonest(group.map((e) => e.interactionType)),
    valence: commonest(group.map((e) => e.valence)),
    eventIds: group.filter((e) => e.chapter !== null).map((e) => eventId(e.chapter)),
    needsReview: group.some((e) => e.confidence !== null),
  };
});

const interactions = fixture.graphEdges
  .map((e, i) => {
    const chapter = e.chapter === null ? null : fixture.chapters.find((c) => c.number === e.chapter);
    return {
      id: `i${i}`,
      from: characterId(e.from),
      to: characterId(e.to),
      type: e.interactionType,
      valence: e.valence,
      description: e.description,
      eventId: chapter ? eventId(chapter.number) : null,
      eventLabel: chapter ? chapter.title : null,
      seq: chapter ? chapter.number : -1,
      needsReview: e.confidence !== null,
    };
  })
  .sort((a, b) => a.seq - b.seq);

const presence = [...presentAt.entries()].flatMap(([chapter, keys]) =>
  [...keys].map((key) => ({
    character: characterId(key),
    event: eventId(chapter),
    isPov: povKey(fixture.chapters.find((c) => c.number === chapter).pov) === key,
  })),
);

const sceneId = (chapter, order) => `s:${chapter}:${order}`;

// The structural layer. Chapters exist whether or not anyone was placed in them, which is
// the whole reason they are returned alongside events rather than instead of them.
const chapters = fixture.chapters.map((c) => ({
  id: chapterId(c.number),
  title: c.title,
  book: 0,
  act: c.act,
  seq: c.number,
  status: 'drafted',
  words: c.content.length,
  eventId: presentAt.has(c.number) ? eventId(c.number) : null,
}));

const scenes = fixture.chapters.flatMap((c) =>
  c.scenes.map((sc) => ({
    id: sceneId(c.number, sc.order),
    chapterId: chapterId(c.number),
    seq: sc.order,
    title: sc.title,
    summary: sc.summary,
    pov: sc.pov,
    status: 'drafted',
  })),
);

const flags = fixture.chapters.flatMap((c) =>
  c.annotations.map((a) => ({
    id: a.id,
    type: a.type,
    text: a.text,
    label: a.label,
    pairId: a.pairId ?? null,
    pairLabel: a.pairLabel ?? null,
    chapterId: chapterId(c.number),
    chapterTitle: c.title,
    // The app resolves this against real scene rows after inserting them; here the ids are
    // invented, so it resolves against the same invention.
    sceneId: a.sceneOrder != null ? sceneId(c.number, a.sceneOrder) : null,
    // Null where nobody was placed in the chapter, exactly as the real query returns it --
    // the renderer has to cope with an unanchored flag either way.
    eventId: presentAt.has(c.number) ? eventId(c.number) : null,
    seq: c.number,
  })),
);

const payload = { nodes, links, events, presence, interactions, flags, chapters, scenes };

// Injected ahead of the force-graph tag so the document starts with data instead of asking
// for it; the renderer treats a pre-set window.__GRAPH__ as "no host to talk to".
const anchor = '<!-- Only the 2D renderer loads up front.';
if (!html.includes(anchor)) throw new Error('Could not find the script block to inject before.');

const banner =
  '<!-- GENERATED FILE - do not edit by hand.\n' +
  '     Markup from mobile/src/lib/characterWebHtml.ts, data from the demo pack.\n' +
  '     Rebuild with: node scripts/build-graph-demo.mjs -->\n';

const document = html.replace(
  anchor,
  `<script>window.__GRAPH__ = ${JSON.stringify(payload)};</script>\n\n${anchor}`,
);

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, banner + document, 'utf8');

const count = (type) => flags.filter((f) => f.type === type).length;
console.log(`characters    ${nodes.length}`);
console.log(`chapters      ${chapters.length}`);
console.log(`scenes        ${scenes.length}`);
console.log(`events        ${events.length}`);
console.log(`relationships ${links.length} lines from ${interactions.length} interactions`);
console.log(`presence      ${presence.length}`);
console.log(`flags         ${count('plant')} plants, ${count('reveal')} reveals, ${count('note')} notes`);
console.log(`wrote         ${path.relative(ROOT, OUT)}`);
