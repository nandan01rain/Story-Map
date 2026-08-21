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

// Relationships as stated in the bible's own Role/Relationships/Function prose. Curated
// rather than inferred: the text describes what happens between people but not in a fixed
// grammar, so classifying it by keyword would invent as much as it read. Confidence is set
// low on the genuinely ambiguous ones so the review queue has something real to show.
const relationships = [
  ['ganga', 'nakulan', 'romantic', 'positive', null],
  ['ganga', 'nakulan', 'confrontation', 'negative', 0.55],
  ['ganga', 'sunny', 'alliance', 'positive', null],
  ['ganga', 'sridevi', 'alliance', 'positive', null],
  ['ganga', 'alli', 'other', 'ambiguous', 0.5],
  ['ganga', 'mahadevan', 'confrontation', 'ambiguous', 0.45],
  ['nakulan', 'sunny', 'alliance', 'positive', null],
  ['nakulan', 'elders', 'confrontation', 'ambiguous', 0.58],
  ['sunny', 'sridevi', 'romantic', 'positive', null],
  ['sunny', 'namboodiri', 'alliance', 'ambiguous', null],
  ['sunny', 'elders', 'confrontation', 'ambiguous', 0.52],
  ['sridevi', 'elders', 'confrontation', 'negative', null],
  ['alli', 'mahadevan', 'romantic', 'positive', null],
  ['mahadevan', 'elders', 'confrontation', 'negative', 0.4],
  ['namboodiri', 'elders', 'alliance', 'positive', null],
  ['nagavalli', 'ramanathan', 'romantic', 'positive', null],
  ['nagavalli', 'thambi', 'betrayal', 'negative', null],
  ['ramanathan', 'thambi', 'betrayal', 'negative', null],
  ['nakulan', 'thambi', 'other', 'ambiguous', 0.35],
  ['mahadevan', 'ramanathan', 'other', 'ambiguous', 0.35],
];

const knownKeys = new Set(characters.map((c) => c.key));
const graphEdges = relationships
  .filter(([a, b]) => knownKeys.has(a) && knownKeys.has(b))
  .map(([from, to, interactionType, valence, confidence]) => ({
    from,
    to,
    interactionType,
    valence,
    confidence,
  }));

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
  scenes: DemoScene[];
};
export type DemoDocument = { title: string; type: string; content: string };
export type DemoCharacter = { key: string; label: string; aliases: string[] };
export type DemoGraphEdge = {
  from: string;
  to: string;
  interactionType: string;
  valence: string;
  confidence: number | null;
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
console.log(`graph edges   ${graphEdges.length} of ${relationships.length} (rest reference unknown names)`);
console.log(`for review    ${graphEdges.filter((e) => e.confidence !== null).length}`);
console.log(`wrote         ${path.relative(process.cwd(), OUT)}`);
