// Proposals: the only way either assistant changes anything, and it does not change anything.
//
// Each tool here validates what the model asked for against the project as it is now, and if
// it holds, writes ONE row to assistant_proposals. The app shows the queue; the writer accepts
// or rejects; only an accepted proposal is applied, by the app, after re-checking it against the
// text as it is by then (lib/proposals.ts on the phone). So the thing that DECIDES is never the
// thing that INSCRIBES, and a proposal that has gone stale cannot land on the wrong words.
//
// A text edit is a find-and-replace of an EXACT, UNIQUE passage. Not a whole-document rewrite:
// a diff the writer can read at a glance is a proposal; a new version of a 40-page bible is a
// demand. And not a fuzzy match: the find must appear exactly once, or the edit is refused with
// the count, so the model quotes more context rather than the app guessing which one it meant.

import { type ToolContext, bookName, loadChapters, loadScenes, resolve } from './library.ts';

type Row = Record<string, unknown>;
const str = (v: unknown) => (typeof v === 'string' ? v : '');

async function queue(ctx: ToolContext, p: { kind: string; target_type?: string; target_id?: string; summary: string; rationale: string; payload: Row }) {
  const summary = p.summary.trim().slice(0, 300) || p.kind;
  const { data, error } = await ctx.supabase.from('assistant_proposals').insert({
    user_id: ctx.userId, project_id: ctx.projectId, agent: ctx.agent, kind: p.kind,
    target_type: p.target_type ?? null, target_id: p.target_id ?? null,
    summary, rationale: p.rationale.trim(), payload: p.payload,
  }).select('id').single();
  if (error) {
    throw new Error(/assistant_proposals/.test(error.message)
      ? 'The proposal queue does not exist yet: the writer needs to run supabase/migrations/20261012_assistant_library.sql.'
      : error.message);
  }
  ctx.proposals.push({ id: data.id as string, kind: p.kind, summary });
  return `Proposed (${data.id}). Nothing has changed: the writer will accept or reject it.`;
}

function countOf(haystack: string, needle: string) {
  let n = 0, i = 0;
  while ((i = haystack.indexOf(needle, i)) !== -1) { n++; i += needle.length; }
  return n;
}

export async function proposeTextEdit(ctx: ToolContext, input: Row) {
  const type = str(input.target_type);
  const find = str(input.find), replace = str(input.replace);
  if (!['document', 'chapter', 'scene'].includes(type)) throw new Error('target_type must be document, chapter or scene.');
  if (!find) throw new Error('find is required: the exact passage to change, quoted from the text.');
  if (find === replace) throw new Error('find and replace are identical.');

  let id: string, title: string, content: string, versionId: string | undefined;
  if (type === 'document') {
    const { data, error } = await ctx.supabase.from('documents').select('id, title, content').eq('project_id', ctx.projectId);
    if (error) throw new Error(error.message);
    const d = resolve((data ?? []) as Row[], input.target, (r) => str(r.title), 'document');
    id = d.id as string; title = str(d.title); content = str(d.content);
  } else if (type === 'chapter') {
    const c = resolve(await loadChapters(ctx), input.target, (r) => str(r.title), 'chapter');
    id = c.id as string; title = str(c.title); content = str(c.content);
  } else {
    const s = resolve(await loadScenes(ctx), input.target, (r) => str(r.title), 'scene');
    id = s.id as string; title = s.title; content = s.content; versionId = s.version_id;
  }
  const n = countOf(content, find);
  if (n === 0) throw new Error(`That passage is not in "${title}" exactly as quoted. Read it again and quote it character for character.`);
  if (n > 1) throw new Error(`That passage appears ${n} times in "${title}". Quote more of the surrounding text so it is unique.`);

  const at = content.indexOf(find);
  return queue(ctx, {
    kind: 'edit_text', target_type: type, target_id: id,
    summary: str(input.summary) || `Edit ${type} "${title}"`,
    rationale: str(input.rationale),
    payload: { title, find, replace, version_id: versionId ?? null,
      before_context: content.slice(Math.max(0, at - 120), at), after_context: content.slice(at + find.length, at + find.length + 120) },
  });
}

export async function proposeNewScene(ctx: ToolContext, input: Row) {
  const content = str(input.content);
  if (!content.trim()) throw new Error('content is required: the scene, in the scene template.');
  let pageId: string | null = null;
  if (str(input.from_page).trim()) {
    const { data, error } = await ctx.supabase.from('sticky_notes').select('*').eq('project_id', ctx.projectId);
    if (error) throw new Error(error.message);
    const p = resolve((data ?? []) as Row[], input.from_page, (r) => str(r.content).split('\n')[0] ?? '', 'page');
    if (p.became_type) throw new Error(`That page already became a ${p.became_type} (${p.became_id}).`);
    pageId = p.id as string;
  }
  return queue(ctx, {
    kind: 'new_scene', target_type: pageId ? 'page' : undefined, target_id: pageId ?? undefined,
    summary: str(input.summary) || 'A new scene', rationale: str(input.rationale),
    payload: { content, from_page: pageId },
  });
}

export async function proposeStoryboardNote(ctx: ToolContext, input: Row) {
  const book = Number(input.book) - 1;
  if (!Number.isInteger(book) || book < 0) throw new Error('book is a whole number from 1 (1 = Book One).');
  const title = str(input.title).trim(), summary = str(input.summary).trim();
  if (!title || !summary) throw new Error('title and summary are both required: the note is a heading and a few lines.');
  let sceneId: string | null = null, chapterId: string | null = null;
  if (str(input.scene).trim()) sceneId = resolve(await loadScenes(ctx), input.scene, (r) => str(r.title), 'scene').id as string;
  if (str(input.chapter).trim()) chapterId = resolve(await loadChapters(ctx), input.chapter, (r) => str(r.title), 'chapter').id as string;
  return queue(ctx, {
    kind: 'storyboard_note', target_type: 'book',
    summary: str(input.proposal_summary) || `A note on ${bookName(book)}'s storyboard: ${title}`,
    rationale: str(input.rationale),
    payload: { book, title, summary, scene_id: sceneId, chapter_id: chapterId },
  });
}

export async function proposeSceneChapterLink(ctx: ToolContext, input: Row) {
  const scene = resolve(await loadScenes(ctx), input.scene, (r) => str(r.title), 'scene');
  const chapters = await loadChapters(ctx);
  const chapter = resolve(chapters, input.chapter, (r) => str(r.title), 'chapter');
  if (scene.became_type === 'chapter' && scene.became_id === chapter.id) throw new Error('That scene is already linked to that chapter.');
  return queue(ctx, {
    kind: 'link_scene_chapter', target_type: 'scene', target_id: scene.id as string,
    summary: `Scene "${scene.title}" became "${chapter.title}"`, rationale: str(input.rationale),
    payload: { scene_id: scene.id, chapter_id: chapter.id, previous: scene.became_id ?? null },
  });
}

export async function proposeCharacterFields(ctx: ToolContext, input: Row) {
  const { data: cast, error } = await ctx.supabase.from('storyboard_cast').select('*').eq('project_id', ctx.projectId);
  if (error) throw new Error(error.message);
  const c = resolve((cast ?? []) as Row[], input.character, (r) => str(r.name), 'character');
  const { data: fields } = await ctx.supabase.from('character_fields').select('id, name').eq('project_id', ctx.projectId);
  const given = (input.fields && typeof input.fields === 'object' ? input.fields : {}) as Record<string, unknown>;
  const values: Record<string, string> = {};
  for (const [k, v] of Object.entries(given)) if (str(v).trim()) values[k.trim()] = str(v).trim();
  const description = str(input.description).trim();
  if (!Object.keys(values).length && !description) throw new Error('Give a description, or fields with values.');
  const known = new Set(((fields ?? []) as Row[]).map((f) => str(f.name).toLowerCase()));
  const newFields = Object.keys(values).filter((k) => !known.has(k.toLowerCase()));
  return queue(ctx, {
    kind: 'character_fields', target_type: 'character', target_id: c.id as string,
    summary: `${c.name}: ${[description ? 'card line' : '', ...Object.keys(values)].filter(Boolean).join(', ')}`,
    rationale: str(input.rationale),
    payload: { name: c.name, description: description || null, fields: values, new_fields: newFields },
  });
}
