// Converts demo/ into a single JSON fixture the app can import.
//
// Run: node scripts/build-demo-fixture.mjs
//
// The fixture is generated rather than hand-written so the demo pack stays the source of
// truth -- edit the markdown, re-run this, and the app picks the change up.
import fs from 'node:fs';
import path from 'node:path';

const DEMO = path.join(process.cwd(), 'demo');
const OUT = path.join(process.cwd(), 'mobile', 'src', 'lib', 'demoFixture.ts');

const read = (p) => fs.readFileSync(path.join(DEMO, p), 'utf8');

// --- chapters -------------------------------------------------------------
// Prose is the authority for content; the breakdown supplies structure. Both key off the
// same chapter numbers, so they are parsed separately and joined on that.
const manuscript = read('Prose/Full_Manuscript.md');
const breakdown = read('04_Act_Breakdown.md');

function splitChapters(text, headerRe) {
  const out = [];
  const lines = text.split('\n');
  let current = null;
  for (const line of lines) {
    const m = line.match(headerRe);
    if (m) {
      if (current) out.push(current);
      current = { number: Number(m[1]), title: m[2].trim(), body: [] };
    } else if (current) {
      current.body.push(line);
    }
  }
  if (current) out.push(current);
  return out.map((c) => ({ ...c, body: c.body.join('\n').trim() }));
}

const prose = splitChapters(manuscript, /^# CHAPTER (\d+) — (.+)$/);
const structure = splitChapters(breakdown, /^## CH (\d+) — (.+)$/);

// Act boundaries come from the breakdown's own ACT headers rather than being assumed from
// chapter ranges -- the fixture should reflect what the pack says, not what I infer.
const actOf = new Map();
{
  let act = 1;
  for (const line of breakdown.split('\n')) {
    if (/^# ACT ONE/.test(line)) act = 1;
    else if (/^# ACT TWO/.test(line)) act = 2;
    else if (/^# ACT THREE/.test(line)) act = 3;
    const m = line.match(/^## CH (\d+) —/);
    if (m) actOf.set(Number(m[1]), act);
  }
}

function field(body, label) {
  const m = body.match(new RegExp(`\\*\\*${label}:?\\*\\*\\s*(.+)`));
  return m ? m[1].trim() : '';
}

function povOf(body) {
  const m = body.match(/\*\*POV:\*\*\s*([^·\n]+)/);
  return m ? m[1].trim().replace(/\s*\(.*\)$/, '') : '';
}

function eventsOf(body) {
  const section = body.split(/\*\*Events\*\*/)[1];
  if (!section) return [];
  const out = [];
  for (const line of section.split('\n')) {
    if (/^\s*-\s+/.test(line)) out.push(line.replace(/^\s*-\s+/, '').trim());
    else if (out.length && line.trim() === '') break;
  }
  return out;
}

const chapters = prose.map((p) => {
  const s = structure.find((x) => x.number === p.number);
  const pov = s ? povOf(s.body) : '';
  // The prose carries its own POV italic line; it is metadata, not text, so it comes out of
  // the content and into the scene records where the POV tracker can see it.
  const content = p.body.replace(/^\*POV:[^\n]*\*\n+/, '').trim();
  const events = s ? eventsOf(s.body) : [];

  return {
    number: p.number,
    title: p.title,
    act: actOf.get(p.number) ?? 1,
    pov,
    content,
    notes: s
      ? [
          field(s.body, 'Purpose') && `Purpose: ${field(s.body, 'Purpose')}`,
          field(s.body, 'Setup/payoff') && `Setup/payoff: ${field(s.body, 'Setup/payoff')}`,
          field(s.body, 'Ends on') && `Ends on: ${field(s.body, 'Ends on')}`,
        ]
          .filter(Boolean)
          .join('\n\n')
      : '',
    // Capped at five: the pack says 3-5 scenes per chapter, and a couple of chapters list
    // more events than that.
    summary: s ? field(s.body, 'Purpose') : '',
    endsOn: s ? field(s.body, 'Ends on') : '',
    scenes: events.slice(0, 5).map((summary, i) => ({
      order: i,
      title: summary.length > 60 ? `${summary.slice(0, 57)}…` : summary,
      summary,
      pov,
    })),
  };
});

// --- documents ------------------------------------------------------------
const documents = [
  ['00_Project_Overview.md', 'Project Overview', 'bible'],
  ['01_Story_Bible.md', 'Story Bible', 'bible'],
  ['02_Character_Bible.md', 'Character Bible', 'character'],
  ['03_Locations.md', 'Locations', 'reference'],
  ['04_Act_Breakdown.md', 'Chapter Breakdown', 'reference'],
  ['05_Plants_and_Reveals.md', 'Plants & Reveals', 'reference'],
  ['06_Continuity_Timeline.md', 'Continuity Timeline', 'timeline'],
  ['07_Patch_1.md', 'Patch 1', 'reference'],
  ['08_InWorld_Document_Namboodiri_Ritual_Notes.md', "Namboodiri's Ritual Notes", 'reference'],
].map(([file, title, type]) => ({ title, type, content: read(file) }));

// --- character graph ------------------------------------------------------
// Characters are parsed from the bible's headings; aliases come from the short names the
// relationship blocks actually use ("Sunny" for "Dr. Sunny Joseph"), which is exactly the
// resolution problem the graph's alias handling exists for.
const bible = read('02_Character_Bible.md');
const graphCharacters = [];
for (const line of bible.split('\n')) {
  const m = line.match(/^###? ([A-Z][A-Z .'—-]+?)(?: — .*)?$/);
  if (!m) continue;
  const raw = m[1].trim();
  if (/^HISTORICAL/.test(raw)) continue;
  graphCharacters.push(raw);
}

function pretty(name) {
  return name
    .toLowerCase()
    .split(' ')
    .map((w) => (w === 'dr.' ? 'Dr.' : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');
}

// Deriving the short name positionally does not work: it is the last word for
// "Karanavar Sankaran Thambi" but the middle one for "Dr. Sunny Joseph", and taking the
// last there silently dropped every edge involving Sunny. Stated explicitly instead --
// four names, and being wrong about them is invisible until the graph is missing its
// busiest character.
const SHORT_NAMES = {
  'Dr. Sunny Joseph': 'Sunny',
  'The Elders': 'Elders',
  'Pullattuparam Brahmadathan Namboodiri': 'Namboodiri',
  'Karanavar Sankaran Thambi': 'Thambi',
};

const characters = graphCharacters.map((raw) => {
  const label = pretty(raw);
  const short = SHORT_NAMES[label] ?? label;
  return {
    key: short.toLowerCase(),
    label,
    aliases: short !== label ? [short] : [],
  };
});


// The bible states each relationship in a sentence or two under the character who holds
// it. That is exactly the detail the expanded view needs, so it is read from the source
// rather than written again here -- if the bible changes, the graph's explanations change
// with it.
const relationshipProse = new Map();
{
  let owner = null;
  for (const line of bible.split('\n')) {
    const head = line.match(/^###? ([A-Z][A-Z .'\u2014-]+?)(?: \u2014 .*)?$/);
    if (head && !/^HISTORICAL/.test(head[1].trim())) {
      const label = pretty(head[1].trim());
      owner = (SHORT_NAMES[label] ?? label).toLowerCase();
      continue;
    }
    const rel = line.match(/^- \*\*(.+?)\*\*\s*\u2014\s*(.+)$/);
    if (rel && owner) {
      const target = rel[1].replace(/^The /i, '').trim().toLowerCase();
      relationshipProse.set(`${owner}|${target}`, rel[2].trim());
      relationshipProse.set(`${target}|${owner}`, rel[2].trim());
    }
  }
}

function proseFor(a, b) {
  return relationshipProse.get(`${a}|${b}`) ?? relationshipProse.get(`${b}|${a}`) ?? '';
}

// Relationships as stated in the bible's own Role/Relationships/Function prose. Curated
// rather than inferred: the text describes what happens between people but not in a fixed
// grammar, so classifying it by keyword would invent as much as it read.
//
// The fifth column is a chapter number, or null for a relationship that holds across the
// whole book rather than happening at one identifiable moment. This is not decoration:
// Ganga loves Nakulan throughout AND the alter attacks him in Ch 13, and those are two
// different edges that can only coexist if the second is scoped to an event. A first pass
// left both saga-level, which collides on the unscoped unique key and rejected the entire
// batch -- the graph came out with every character and not one relationship.
//
// Sixth column is confidence; a number marks the edge for review, null means settled.
const relationships = [
  ['ganga', 'nakulan', 'romantic', 'positive', null, null],
  ['ganga', 'nakulan', 'confrontation', 'negative', 13, 0.55],
  ['ganga', 'sunny', 'alliance', 'positive', null, null],
  ['ganga', 'sunny', 'alliance', 'positive', 7, null],
  ['ganga', 'sunny', 'mentorship', 'ambiguous', 10, 0.5],
  ['ganga', 'sridevi', 'alliance', 'positive', null, null],
  ['ganga', 'alli', 'other', 'ambiguous', 3, 0.5],
  ['ganga', 'alli', 'confrontation', 'negative', 8, null],
  ['ganga', 'mahadevan', 'confrontation', 'ambiguous', 6, 0.45],
  ['nakulan', 'sunny', 'alliance', 'positive', null, null],
  ['nakulan', 'sunny', 'alliance', 'positive', 2, null],
  ['nakulan', 'elders', 'confrontation', 'ambiguous', null, 0.58],
  ['sunny', 'sridevi', 'romantic', 'positive', 16, null],
  ['sunny', 'sridevi', 'alliance', 'positive', 11, null],
  ['sunny', 'sridevi', 'alliance', 'positive', null, null],
  ['sunny', 'namboodiri', 'alliance', 'ambiguous', 12, null],
  ['sunny', 'elders', 'confrontation', 'ambiguous', null, 0.52],
  ['sridevi', 'elders', 'confrontation', 'negative', null, null],
  ['alli', 'mahadevan', 'romantic', 'positive', null, null],
  ['mahadevan', 'elders', 'confrontation', 'negative', 6, 0.4],
  ['namboodiri', 'elders', 'alliance', 'positive', 14, null],
  ['nagavalli', 'ramanathan', 'romantic', 'positive', 0, null],
  ['nagavalli', 'thambi', 'betrayal', 'negative', 0, null],
  ['ramanathan', 'thambi', 'betrayal', 'negative', 0, null],
  ['nakulan', 'thambi', 'other', 'ambiguous', null, 0.35],
  ['mahadevan', 'ramanathan', 'other', 'ambiguous', null, 0.35],
];

const knownKeys = new Set(characters.map((c) => c.key));
const dropped = relationships.filter(([a, b]) => !knownKeys.has(a) || !knownKeys.has(b));
if (dropped.length > 0) {
  // Silently dropping these is how the "Dr. Sunny Joseph" short-name bug hid: five edges
  // vanished and the only symptom was a slightly emptier graph.
  throw new Error(
    `Relationships reference unknown characters: ${dropped.map(([a, b]) => `${a}->${b}`).join(', ')}`,
  );
}

// The database enforces this too, but a unique-violation there rejects the whole insert and
// surfaces as an empty graph. Failing here names the offending pair instead.
const edgeKeys = new Set();
for (const [from, to, , , chapter] of relationships) {
  const key = [from, to].sort().join('|') + '@' + (chapter === null ? 'saga' : chapter);
  if (edgeKeys.has(key)) {
    throw new Error(`Duplicate relationship: ${key}. Scope one of them to a chapter.`);
  }
  edgeKeys.add(key);
}

// Written only where the bible does not state the relationship itself -- the historical
// pairs and the moment-specific ones, which the bible describes under Function rather than
// Relationships.
const WRITTEN = {
  'nagavalli|ramanathan': 'Partners for two years before the Karanavar bought her out of the Thanjavur court, and again in secret at Madampalli. Careful, and eventually not careful enough. Ch 0 gives them the book\u2019s only true account of what they were to each other, so every later retelling of the legend reads against it.',
  'nagavalli|thambi': 'He did not kill her in a rage. Ch 0 is explicit that he arrived having already decided the shape of the evening and simply walked through its stages \u2014 which is what the family legend spends a century and a half softening into something more bearable.',
  'ramanathan|thambi': 'Killed first, and separately, at the cottage. The order matters: the Karanavar went to him before he went to her, methodically, which is the detail the sanitised family version loses.',
  'nakulan|thambi': 'No relationship in life \u2014 they are separated by a hundred and fifty years. But Ganga\u2019s alter casts Nakulan as the Karanavar, so he inherits a role he never asked for and cannot argue his way out of.',
  'mahadevan|ramanathan': 'Mahadevan is the real-world trigger the \u201cRamanathan\u201d projection latches onto. Nothing about him invites it; proximity and the wrong moment are enough.',
  'ganga|nakulan@13': 'The alter takes over fully and recasts her husband as the man who killed her. The text should read this as tragic rather than symbolic \u2014 she is not really angry at Nakulan, the substrate trauma simply needed a face, and his was the one available.',
  'ganga|alli@8': 'The \u201cattack\u201d on Alli, which is a dissociative episode misdirected rather than an assault. Alli helped her open the Thekkini in Ch 3 and is repaid by being the nearest body when the episode breaks.',
  'ganga|mahadevan@6': 'Read by the household as harassment and by Ganga\u2019s alter as recognition. Both readings are wrong, and the family acts on theirs \u2014 which is what puts Mahadevan under suspicion.',
  'mahadevan|elders@6': 'The elders turn on him quickly and completely, on no evidence, because a culprit is easier to hold than an explanation.',
  'sunny|namboodiri@12': 'The book\u2019s thesis in one conversation. The Namboodiri never concedes that Sunny is right; he simply builds his ritual around Sunny\u2019s plan and lets both traditions claim the result.',
  'namboodiri|elders@14': 'His blessing is what lets the family accept the outcome without ever being told the clinical truth. The vessel a truth arrives in matters as much as the truth.',
  'sunny|sridevi@16': 'He proposes. It should read as earned rather than tacked on \u2014 built across several small scenes of two people doing careful work together while everyone around them reacts.',
  'sunny|elders': 'They read him as a clown for longer than he minds — informal, irreverent, unbothered by a hierarchy the house runs on. He lets them, because being underestimated makes people drop their guard, and it is the elders whose permission he will eventually need.',
  'ganga|sunny@10': 'Sunny reaches the correct diagnosis and decides not to say it aloud yet. The hardest part of his arc is not the diagnosis; it is choosing to build the cure inside the family\u2019s belief system rather than against it.',
};

const graphEdges = relationships.map(([from, to, interactionType, valence, chapter, confidence]) => {
  const scoped = `${from}|${to}@${chapter}`;
  const description =
    WRITTEN[scoped] ?? WRITTEN[`${to}|${from}@${chapter}`] ??
    WRITTEN[`${from}|${to}`] ?? WRITTEN[`${to}|${from}`] ??
    proseFor(from, to);
  return { from, to, interactionType, valence, chapter, confidence, description };
});

const undescribed = graphEdges.filter((e) => !e.description);
if (undescribed.length > 0) {
  // An interaction with nothing behind it expands to an empty panel, which reads as broken
  // rather than as "not written yet".
  throw new Error(
    `Relationships with no explanation: ${undescribed.map((e) => `${e.from}->${e.to}`).join(', ')}`,
  );
}

const fixture = {
  projectName: 'The Southern Wing (Demo)',
  chapters,
  documents,
  characters,
  graphEdges,
};

const banner = `// GENERATED FILE -- do not edit by hand.
// Built from demo/ by scripts/build-demo-fixture.mjs. Edit the markdown and re-run that.
//
// A disposable test project that exercises the feature set end to end: 3 acts, 17 chapters
// with real prose, per-chapter POV and scenes, and nine documents including deliberately
// unresolved continuity flags. Loaded from the app rather than pushed into the database
// from a script, because every table is behind row-level security -- writes need the
// writer's own session, which only the signed-in app has.

export type DemoScene = { order: number; title: string; summary: string; pov: string };
export type DemoChapter = {
  number: number;
  title: string;
  act: number;
  pov: string;
  content: string;
  notes: string;
  /** The chapter's stated purpose, shown when the event is expanded in Progression. */
  summary: string;
  endsOn: string;
  scenes: DemoScene[];
};
export type DemoDocument = { title: string; type: string; content: string };
export type DemoCharacter = { key: string; label: string; aliases: string[] };
export type DemoGraphEdge = {
  from: string;
  to: string;
  interactionType: string;
  valence: string;
  /** Chapter number this happened in, or null for a relationship that holds throughout. */
  chapter: number | null;
  confidence: number | null;
  /** What actually happens between them, shown when the interaction is expanded. */
  description: string;
};
export type DemoFixture = {
  projectName: string;
  chapters: DemoChapter[];
  documents: DemoDocument[];
  characters: DemoCharacter[];
  graphEdges: DemoGraphEdge[];
};

export const DEMO_FIXTURE: DemoFixture = `;

fs.writeFileSync(OUT, `${banner}${JSON.stringify(fixture, null, 2)};\n`, 'utf8');

const words = chapters.reduce((n, c) => n + c.content.split(/\s+/).length, 0);
console.log(`chapters      ${chapters.length}`);
console.log(`acts          ${new Set(chapters.map((c) => c.act)).size}`);
console.log(`scenes        ${chapters.reduce((n, c) => n + c.scenes.length, 0)}`);
console.log(`POVs          ${[...new Set(chapters.map((c) => c.pov))].filter(Boolean).join(', ')}`);
console.log(`documents     ${documents.length}`);
console.log(`prose words   ${words.toLocaleString()}`);
console.log(`missing prose ${chapters.filter((c) => c.content.length < 50).map((c) => c.number).join(', ') || 'none'}`);
console.log(`missing POV   ${chapters.filter((c) => !c.pov).map((c) => c.number).join(', ') || 'none'}`);
console.log(`characters    ${characters.length} (${characters.map((c) => c.label).join(', ')})`);
console.log(`graph edges   ${graphEdges.length} (${graphEdges.filter((e) => e.chapter !== null).length} scoped to a chapter)`);
console.log(`for review    ${graphEdges.filter((e) => e.confidence !== null).length}`);
console.log(`wrote         ${path.relative(process.cwd(), OUT)}`);
