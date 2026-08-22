// Converts demo/ into a single JSON fixture the app can import.
//
// Run: node scripts/build-demo-fixture.mjs
//
// The fixture is generated rather than hand-written so the demo pack stays the source of
// truth -- edit the markdown, re-run this, and the app picks the change up.
import fs from 'node:fs';
import path from 'node:path';

import { PLANT_REVEAL_PAIRS } from './demo-plants-reveals.mjs';

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
  const content = p.body
    .replace(/^\*POV:[^\n]*\*\n+/, '')
    // The manuscript separates chapters with a horizontal rule, and the splitter reads every
    // line up to the next header -- so the rule belonged to the chapter before it. It is a
    // document separator, not prose, and it was ending up in the Reader.
    .replace(/\n+-{3,}\s*$/, '')
    .trim();
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
    // Filled by the plant/reveal pass below.
    annotations: [],
    scenes: events.slice(0, 5).map((summary, i) => ({
      order: i,
      title: summary.length > 60 ? `${summary.slice(0, 57)}…` : summary,
      summary,
      pov,
    })),
  };
});

// --- plants & reveals -----------------------------------------------------
// The writer's plant/reveal pairs, flagged into the prose itself as `plant` and `reveal`
// annotations, so the book carries them rather than only a reference document describing
// them. The table lives in scripts/demo-plants-reveals.mjs; this is only the resolver.

// Curly punctuation folded one character to one, so an offset found in the folded copy
// addresses the same span in the untouched original and the text finally stored keeps the
// prose's own punctuation. Anything that changes length -- an ellipsis character becoming
// three dots -- would break that alignment and is deliberately not folded.
function fold(s) {
  return s
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-');
}

const chapterByNumber = new Map(chapters.map((c) => [c.number, c]));

// `...` in an anchor is an elision: each fragment is located in turn, and the whole span
// from the start of the first to the end of the last becomes the flagged text.
function locateAnchor(chapterNumber, anchor) {
  const chapter = chapterByNumber.get(chapterNumber);
  if (!chapter) return { error: `chapter ${chapterNumber} does not exist` };

  const hay = fold(chapter.content);
  const parts = anchor.split('...').map(fold);

  let start = -1;
  let cursor = 0;
  let end = -1;
  for (const part of parts) {
    const at = hay.indexOf(part, cursor);
    if (at === -1) return { error: `ch ${chapterNumber}: no match for "${part.slice(0, 44)}"` };
    if (start === -1) {
      // Ambiguity only matters for the opening fragment; the rest are anchored by the
      // position of the one before them.
      if (hay.indexOf(part, at + 1) !== -1) {
        return { error: `ch ${chapterNumber}: "${part.slice(0, 44)}" appears more than once` };
      }
      start = at;
    }
    cursor = at + part.length;
    end = cursor;
  }

  return { text: chapter.content.slice(start, end), at: start };
}

const anchorFailures = [];

for (const pair of PLANT_REVEAL_PAIRS) {
  const ends = [
    ...pair.plants.map((p) => ['plant', p]),
    ...pair.reveals.map((r) => ['reveal', r]),
  ];
  ends.forEach(([type, [chapterNumber, anchor, label]], i) => {
    const found = locateAnchor(chapterNumber, anchor);
    if (found.error) {
      anchorFailures.push(`${pair.id} ${type} - ${found.error}`);
      return;
    }
    chapterByNumber.get(chapterNumber).annotations.push({
      id: `${pair.id}-${type[0]}${i}`,
      type,
      text: found.text,
      label,
      // What makes this an end of a pair rather than a loose flag. The pair's own title
      // travels with each end so the character web can group them without a second query --
      // annotations are jsonb, and denormalising three fields into them costs nothing.
      pairId: pair.id,
      pairLabel: pair.title,
      // Sorted on below, then dropped: an annotation does not carry a position, by design.
      at: found.at,
    });
  });
}

if (anchorFailures.length > 0) {
  // An anchor that silently fails to match is the worst outcome available here: the pair is
  // simply not in the book, and nothing in the app would say so.
  throw new Error(`Plant/reveal anchors that did not match:\n  ${anchorFailures.join('\n  ')}`);
}

for (const chapter of chapters) {
  chapter.annotations.sort((a, b) => a.at - b.at);
  for (const a of chapter.annotations) delete a.at;
}

// --- notes ----------------------------------------------------------------
// Notes are the third kind of annotation, and the pack had none -- which left the character
// web's Notes filter with nothing to draw and no way to tell whether it worked.
//
// Derived rather than written: the Act Breakdown already states what each chapter closes on,
// so that line becomes a note anchored to the chapter's actual closing sentence. Real pack
// content, mechanically placed, and nothing invented on the writer's behalf.
//
// Attached to the chapter's LAST scene rather than to the chapter at large, because a note
// about how a chapter ends is a note about its final scene -- and because scene-level
// association is otherwise a field nothing exercises.
for (const chapter of chapters) {
  if (!chapter.endsOn) continue;

  const trimmed = chapter.content.trimEnd();
  const lastParagraph = trimmed.slice(trimmed.lastIndexOf('\n') + 1).trim();
  if (!lastParagraph) continue;

  // The closing sentence, not the closing paragraph: these paragraphs run to two hundred
  // words and a note that highlights all of them highlights nothing.
  const sentences = lastParagraph.match(/[^.!?]+[.!?]+["\u201d]?\s*$|[^.!?]+[.!?]+["\u201d]?/g);
  const anchor = (sentences ? sentences[sentences.length - 1] : lastParagraph).trim();
  if (anchor.length < 25) continue;

  const at = chapter.content.indexOf(anchor);
  if (at === -1) continue;

  // A note that lands on top of a plant or a reveal is dropped rather than allowed to
  // collide: overlapping spans are resolved by array order at render time, which would make
  // one of the two silently invisible.
  const clashes = chapter.annotations.some((a) => {
    const start = chapter.content.indexOf(a.text);
    return start !== -1 && start < at + anchor.length && at < start + a.text.length;
  });
  if (clashes) continue;

  const lastScene = chapter.scenes[chapter.scenes.length - 1];
  chapter.annotations.push({
    id: `note-ch${chapter.number}`,
    type: 'note',
    text: anchor,
    label: `Ends on: ${chapter.endsOn}`,
    pairId: null,
    pairLabel: null,
    // Resolved to a real scene id at import time; the fixture cannot know one.
    sceneOrder: lastScene ? lastScene.order : null,
    at,
  });
}

for (const chapter of chapters) {
  chapter.annotations.sort(
    (a, b) => chapter.content.indexOf(a.text) - chapter.content.indexOf(b.text),
  );
  for (const a of chapter.annotations) delete a.at;
}

// Overlapping flags are dropped at render time in annotation-array order (storyData.ts),
// which would make one of the two invisible for reasons nothing explains. Caught here
// instead, where the fix is to move an anchor. Runs after the notes are in, so it covers
// them too.
for (const chapter of chapters) {
  for (let i = 1; i < chapter.annotations.length; i += 1) {
    const previous = chapter.annotations[i - 1];
    const current = chapter.annotations[i];
    if (chapter.content.indexOf(previous.text) + previous.text.length > chapter.content.indexOf(current.text)) {
      throw new Error(
        `Overlapping flags in ch ${chapter.number}: ${previous.id} and ${current.id}. Move one anchor.`,
      );
    }
  }
}

const plantRevealPairs = PLANT_REVEAL_PAIRS.map((p) => ({
  id: p.id,
  title: p.title,
  plants: p.plants.length,
  reveals: p.reveals.length,
}));

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
  plantRevealPairs,
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
/** One end of a plant/reveal pair, written into the chapter's prose as an annotation. */
export type DemoAnnotation = {
  id: string;
  type: 'plant' | 'reveal' | 'note';
  /** The exact flagged substring. Annotations relocate by searching for this. */
  text: string;
  /** What this end of the pair does. */
  label: string;
  /** Shared by both ends of a pair. A pair with no reveal is an unpaid plant, which is a
   *  real state. Null on a note, which has no far end. */
  pairId: string | null;
  pairLabel: string | null;
  /** Which scene of its chapter this belongs to, resolved to a real id at import time. */
  sceneOrder?: number | null;
};
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
  annotations: DemoAnnotation[];
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
/** Summary only -- the pairs themselves live in the chapters' annotations. */
export type DemoPlantRevealPair = {
  id: string;
  title: string;
  plants: number;
  reveals: number;
};
export type DemoFixture = {
  projectName: string;
  chapters: DemoChapter[];
  documents: DemoDocument[];
  characters: DemoCharacter[];
  graphEdges: DemoGraphEdge[];
  plantRevealPairs: DemoPlantRevealPair[];
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
const flagCount = (type) => chapters.reduce((n, c) => n + c.annotations.filter((a) => a.type === type).length, 0);
console.log(`plants        ${flagCount('plant')}`);
console.log(`reveals       ${flagCount('reveal')}`);
console.log(`pairs         ${plantRevealPairs.length} (${plantRevealPairs.filter((p) => p.reveals === 0).length} unpaid)`);
console.log(`notes         ${flagCount('note')}`);
console.log(`wrote         ${path.relative(process.cwd(), OUT)}`);
