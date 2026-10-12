// The tool registry: what each tool is called, what it takes, what it says it does, and which
// agent may call it. call-model.ts hands these to whichever model is selected, in that model's
// own dialect, and runs the loop; this file runs the tool.
//
// Permissions live HERE, not in a prompt. An agent is offered only the tools on its list, and
// runTool refuses any other name -- so "Icarus never edits prose" holds even if a model is
// talked into trying.

import type { AgentName } from './agents.ts';
import * as lib from './library.ts';
import * as prop from './proposals.ts';

export type ToolSpec = { name: string; description: string; input_schema: Record<string, unknown> };
type Run = (ctx: lib.ToolContext, input: Record<string, unknown>) => Promise<string>;

const obj = (properties: Record<string, unknown>, required: string[] = []) => ({ type: 'object', properties, required, additionalProperties: false });
const s = (description: string) => ({ type: 'string', description });
const n = (description: string) => ({ type: 'integer', description });
const KINDS = ['chapter', 'document', 'scene', 'page', 'storyboard', 'character'];

const TOOLS: Record<string, { spec: ToolSpec; run: Run }> = {
  // ---- the library -----------------------------------------------------------------------
  search_library: {
    spec: { name: 'search_library', description: 'Search everything the writer keeps by MEANING (semantic): chapters, documents, scenes, pages, storyboard notes, characters. Returns the closest passages with their source ids. Use for "where do I talk about X" and for gathering evidence.',
      input_schema: obj({ query: s('What to look for, in plain words.'), kinds: { type: 'array', items: { type: 'string', enum: KINDS }, description: 'Optional: only these kinds.' } }, ['query']) },
    run: lib.searchLibrary,
  },
  keyword_search: {
    spec: { name: 'keyword_search', description: 'Search by EXACT WORDS (full-text): a name, a term, a phrase. Complements search_library, which finds by meaning and can miss rare names.',
      input_schema: obj({ query: s('Words to find.') }, ['query']) },
    run: lib.keywordSearch,
  },
  outline: {
    spec: { name: 'outline', description: 'The saga at a glance: every chapter by book and act with id, status and word count; how many scenes, storyboard notes and documents of each type.', input_schema: obj({}) },
    run: (ctx) => lib.outline(ctx),
  },
  list_documents: {
    spec: { name: 'list_documents', description: 'The document library: id, type and title of every document. Types: Master Bible, Character Bible, Scene Reference, Progression / Timeline, Other, Archive (Archive = superseded history, never canon).',
      input_schema: obj({ type: s('Optional: only this type.') }) },
    run: lib.listDocuments,
  },
  read_document: {
    spec: { name: 'read_document', description: 'Read a whole document, a page at a time (40,000 characters). Use this to read the passage around a search hit, or a canon document in full, before relying on it.',
      input_schema: obj({ document: s('Document id or title.'), offset: n('Character offset to continue from; the reply says what to pass next.') }, ['document']) },
    run: lib.readDocument,
  },
  read_chapter: {
    spec: { name: 'read_chapter', description: "Read a chapter's prose (a page at a time) with its position and notes.",
      input_schema: obj({ chapter: s('Chapter id or title.'), offset: n('Character offset to continue from.') }, ['chapter']) },
    run: lib.readChapter,
  },
  list_scenes: {
    spec: { name: 'list_scenes', description: 'List scenes (id and title; which became a chapter), optionally only those containing some words.',
      input_schema: obj({ contains: s('Optional words the scene must contain.') }) },
    run: lib.listScenes,
  },
  read_scene: {
    spec: { name: 'read_scene', description: "Read a scene's text (its live version).", input_schema: obj({ scene: s('Scene id or title.'), offset: n('Character offset to continue from.') }, ['scene']) },
    run: lib.readScene,
  },
  list_pages: {
    spec: { name: 'list_pages', description: "The writer's pages (stray thoughts), newest first, with what each became.", input_schema: obj({ contains: s('Optional words the page must contain.') }) },
    run: lib.listPages,
  },
  read_page: {
    spec: { name: 'read_page', description: 'Read one page in full.', input_schema: obj({ page: s('Page id.'), offset: n('Character offset to continue from.') }, ['page']) },
    run: lib.readPage,
  },
  read_storyboard: {
    spec: { name: 'read_storyboard', description: "A book's storyboard in order: each note's id, heading, summary, who is in it, its threads, the chapter it became and the scene it came from.",
      input_schema: obj({ book: n('1 = Book One. Omit for every book.') }) },
    run: lib.readStoryboard,
  },
  read_character: {
    spec: { name: 'read_character', description: "A character's card line, infobox fields and linked bible. With no character, lists every character.",
      input_schema: obj({ character: s('Character name or id; omit to list all.') }) },
    run: lib.readCharacter,
  },

  // ---- checks ----------------------------------------------------------------------------
  check_open_plants: { spec: { name: 'check_open_plants', description: 'Every flagged plant no reveal pays yet.', input_schema: obj({}) }, run: (ctx) => lib.checkOpenPlants(ctx) },
  check_unmet_requirements: { spec: { name: 'check_unmet_requirements', description: 'Scene requirements nothing provides (deferred ones excluded). Keyword matching, so judge each one.', input_schema: obj({}) }, run: (ctx) => lib.checkUnmetRequirements(ctx) },
  check_idle_threads: { spec: { name: 'check_idle_threads', description: 'Mythic threads not touched for a stretch of chapters.', input_schema: obj({ min_gap: n('Chapters of silence that count (default 8).') }) }, run: lib.checkIdleThreads },
  check_pov_gaps: { spec: { name: 'check_pov_gaps', description: 'Point-of-view characters absent for a long stretch.', input_schema: obj({ min_gap: n('Chapters of absence that count (default 6).') }) }, run: lib.checkPovGaps },
  check_unused_pages: { spec: { name: 'check_unused_pages', description: 'Old pages never read through and never turned into anything.', input_schema: obj({ older_than_days: n('Default 14.') }) }, run: lib.checkUnusedPages },
  check_unplaced_scenes: { spec: { name: 'check_unplaced_scenes', description: 'Scenes neither pinned to a storyboard nor made into a chapter.', input_schema: obj({}) }, run: (ctx) => lib.checkUnplacedScenes(ctx) },

  // ---- proposals: nothing is changed until the writer accepts ------------------------------
  propose_text_edit: {
    spec: { name: 'propose_text_edit', description: 'Propose replacing one exact passage in a document, chapter or scene. find must be quoted character for character and appear exactly once; keep it to the passage that changes plus enough context to be unique. To fill an empty template field, find the field line and replace it with the filled line. The writer sees the before and after and accepts or rejects; nothing changes until then.',
      input_schema: obj({ target_type: { type: 'string', enum: ['document', 'chapter', 'scene'] }, target: s('Id or title.'), find: s('The exact passage to replace.'), replace: s('What it becomes.'), summary: s('One line: what this changes.'), rationale: s('Why, briefly.') }, ['target_type', 'target', 'find', 'replace', 'summary', 'rationale']) },
    run: prop.proposeTextEdit,
  },
  propose_new_scene: {
    spec: { name: 'propose_new_scene', description: 'Propose a new scene, written in the scene template (heading, Chapter, POV · Status, Purpose, Events, Characters & reactions, Ends on, then Draft). from_page turns a page into it: keep the page\'s words, do not invent beyond them, and leave fields empty that the page does not answer.',
      input_schema: obj({ content: s('The scene text, in the template.'), from_page: s('Optional page id it comes from.'), summary: s('One line.'), rationale: s('Why.') }, ['content', 'summary', 'rationale']) },
    run: prop.proposeNewScene,
  },
  propose_storyboard_note: {
    spec: { name: 'propose_storyboard_note', description: "Propose a note for a book's storyboard: a heading and a few lines summing the beat up, optionally tied to the scene or chapter it stands for.",
      input_schema: obj({ book: n('1 = Book One.'), title: s('The note heading.'), summary: s('A few lines.'), scene: s('Optional scene id or title.'), chapter: s('Optional chapter id or title.'), rationale: s('Why.') }, ['book', 'title', 'summary', 'rationale']) },
    run: prop.proposeStoryboardNote,
  },
  propose_scene_chapter_link: {
    spec: { name: 'propose_scene_chapter_link', description: 'Propose recording that a scene became a particular chapter (its storyboard note follows it).',
      input_schema: obj({ scene: s('Scene id or title.'), chapter: s('Chapter id or title.'), rationale: s('Why you think so.') }, ['scene', 'chapter', 'rationale']) },
    run: prop.proposeSceneChapterLink,
  },
  propose_character_fields: {
    spec: { name: 'propose_character_fields', description: "Propose a character's card line and/or infobox values, taken from their bible. A field name not yet in the infobox would add that field for every character, so prefer existing names (see read_character).",
      input_schema: obj({ character: s('Name or id.'), description: s('Optional: the short line on their card.'), fields: { type: 'object', description: 'Field name to value.', additionalProperties: { type: 'string' } }, rationale: s('Where it comes from.') }, ['character', 'rationale']) },
    run: prop.proposeCharacterFields,
  },
};

const READ = ['search_library', 'keyword_search', 'outline', 'list_documents', 'read_document', 'read_chapter', 'list_scenes', 'read_scene', 'list_pages', 'read_page', 'read_storyboard', 'read_character'];
const CHECKS = ['check_open_plants', 'check_unmet_requirements', 'check_idle_threads', 'check_pov_gaps', 'check_unused_pages', 'check_unplaced_scenes'];
const ORGANISE = ['propose_new_scene', 'propose_storyboard_note', 'propose_scene_chapter_link', 'propose_character_fields'];

/** Librarian: reads, checks and organises. Never touches prose. Editor: all of that, plus text edits. */
export const AGENT_TOOLS: Record<AgentName, string[]> = {
  icarus: [...READ, ...CHECKS, ...ORGANISE],
  daedalus: [...READ, ...CHECKS, ...ORGANISE, 'propose_text_edit'],
};

export const toolSpecs = (agent: AgentName): ToolSpec[] => AGENT_TOOLS[agent].map((name) => TOOLS[name].spec);

/** Runs a tool and returns its text. Errors come back as text too, flagged, so the model can correct itself. */
export async function runTool(ctx: lib.ToolContext, name: string, input: unknown): Promise<{ text: string; isError: boolean }> {
  if (!AGENT_TOOLS[ctx.agent].includes(name) || !TOOLS[name]) return { text: `${name} is not one of your tools.`, isError: true };
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { text: 'The tool input must be a JSON object.', isError: true };
  try {
    return { text: await TOOLS[name].run(ctx, input as Record<string, unknown>), isError: false };
  } catch (e) {
    return { text: e instanceof Error ? e.message : String(e), isError: true };
  }
}
