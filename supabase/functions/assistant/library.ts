// The library: everything the assistants can READ, and the checks they can run. No model is
// involved in any of this -- these are queries and arithmetic, run as the calling user so
// row-level security decides what is visible. The model's job is to choose which to call and
// to judge what comes back.
//
// Every result is plain text or compact JSON, sized for a model to read: long documents come
// back a page at a time with the offset of the next page, lists are capped, and anything
// truncated says so.

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

export type ToolContext = {
  // deno-lint-ignore no-explicit-any
  supabase: SupabaseClient<any, any, any>;
  projectId: string;
  userId: string;
  agent: 'icarus' | 'daedalus';
  embedQuery: (text: string) => Promise<number[]>;
  /** Proposals made during this turn, returned to the app with the reply. */
  proposals: { id: string; kind: string; summary: string }[];
};

type Row = Record<string, unknown>;

const PAGE_CHARS = 40_000;
// Names for any book index -- the app sets no number of books, and neither does this.
const BOOK_WORDS = ['One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve',
  'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen', 'Twenty'];
export const bookName = (i: number) => (BOOK_WORDS[i] ? `Book ${BOOK_WORDS[i]}` : `Book ${i + 1}`);
const str = (v: unknown) => (typeof v === 'string' ? v : '');

async function rows(ctx: ToolContext, table: string, columns: string, extra?: (q: any) => any): Promise<Row[]> {
  let q = ctx.supabase.from(table).select(columns).eq('project_id', ctx.projectId);
  if (extra) q = extra(q);
  const { data, error } = await q;
  if (error) throw new Error(`${table}: ${error.message}`);
  return (data ?? []) as unknown as Row[];
}

/**
 * Find one row by id, then exact title, then a title containing the words. Ambiguity is an
 * error that lists the candidates, so the model asks again precisely instead of guessing.
 */
export function resolve<T extends Row>(list: T[], ref: unknown, titleOf: (r: T) => string, what: string): T {
  const want = str(ref).trim();
  if (!want) throw new Error(`Say which ${what}: an id or a title.`);
  const byId = list.find((r) => r.id === want);
  if (byId) return byId;
  const low = want.toLowerCase();
  const exact = list.filter((r) => titleOf(r).trim().toLowerCase() === low);
  if (exact.length === 1) return exact[0];
  const words = low.split(/\s+/).filter(Boolean);
  const loose = list.filter((r) => { const t = titleOf(r).toLowerCase(); return words.every((w) => t.includes(w)); });
  if (loose.length === 1) return loose[0];
  const found = (exact.length ? exact : loose).slice(0, 12);
  if (found.length === 0) throw new Error(`No ${what} matches "${want}".`);
  throw new Error(`"${want}" matches ${exact.length || loose.length} ${what}s; use an id. Candidates:\n` +
    found.map((r) => `- ${r.id}  ${titleOf(r)}`).join('\n'));
}

const page = (text: string, offset = 0) => {
  const start = Math.max(0, Math.floor(offset) || 0);
  const body = text.slice(start, start + PAGE_CHARS);
  const end = start + body.length;
  return `${body}${end < text.length ? `\n\n[… ${text.length - end} more characters. Call again with offset ${end}.]` : ''}`;
};

// ---- shared shapes ---------------------------------------------------------------------

export async function loadChapters(ctx: ToolContext) {
  const list = await rows(ctx, 'chapters', 'id, book, act, "order", title, status, content, notes, annotations');
  return list.sort((a, b) => (a.book as number) - (b.book as number) || (a.act as number) - (b.act as number) || (a.order as number) - (b.order as number));
}

export type Scene = Row & {
  id: string; title: string; content: string; version_id?: string;
  became_type?: string | null; became_id?: string | null; position?: number;
};

export async function loadScenes(ctx: ToolContext): Promise<Scene[]> {
  const [treatments, versions] = await Promise.all([
    rows(ctx, 'treatments', 'id, title, position, became_type, became_id'),
    rows(ctx, 'treatment_versions', 'id, treatment_id, content, status, created_at'),
  ]);
  return treatments
    .sort((a, b) => Number(a.position) - Number(b.position))
    .map((t) => {
      const mine = versions.filter((v) => v.treatment_id === t.id);
      const live = mine.filter((v) => v.status === 'live').sort((a, b) => str(b.created_at).localeCompare(str(a.created_at)))[0] ?? mine[0];
      const content = str(live?.content);
      const first = content.split('\n').map((l) => l.trim().replace(/^#+\s*/, '').replace(/\*\*/g, '')).find((l) => l && !/^(Chapter|POV|Purpose|Events|Characters & reactions|Ends on|Draft):?/.test(l)) ?? '';
      return { ...t, title: str(t.title).trim() || first || 'Untitled scene', content, version_id: live?.id as string | undefined } as Scene;
    });
}

export const chapterLabel = (c: Row, all: Row[]) => {
  const inBook = all.filter((x) => x.book === c.book);
  return `${bookName(c.book as number)}, Act ${c.act}, Chapter ${inBook.indexOf(c) + 1}: ${str(c.title) || 'Untitled'}`;
};

// ---- read tools --------------------------------------------------------------------------

export async function searchLibrary(ctx: ToolContext, input: Row) {
  const query = str(input.query).trim();
  if (!query) throw new Error('query is required.');
  const kinds = Array.isArray(input.kinds) ? (input.kinds as string[]) : null;
  const embedding = await ctx.embedQuery(query);
  const { data, error } = await ctx.supabase.rpc('match_content_chunks', {
    p_project_id: ctx.projectId,
    p_query_embedding: embedding,
    p_match_count: kinds ? 40 : 15,
  });
  if (error) throw new Error(error.message);
  const hits = ((data ?? []) as Row[]).filter((m) => !kinds || kinds.includes(str(m.source_type))).slice(0, 15);
  if (!hits.length) return 'Nothing in the index matched. The index may not cover this yet; try keyword_search.';
  return hits.map((m, i) => `[${i + 1}] ${m.source_type} ${m.source_id} · ${m.source_title}\n${m.content}`).join('\n\n---\n\n');
}

export async function keywordSearch(ctx: ToolContext, input: Row) {
  const query = str(input.query).trim();
  if (!query) throw new Error('query is required.');
  const { data, error } = await ctx.supabase.rpc('search_everything', { p_project_id: ctx.projectId, p_query: query });
  if (error) throw new Error(error.message);
  const hits = (data ?? []) as Row[];
  if (!hits.length) return `No exact-word match for "${query}".`;
  return hits.slice(0, 25).map((h) => `- ${h.kind} ${h.id}${h.parent_id ? ` (in ${h.parent_id})` : ''} · ${h.title}\n  ${str(h.snippet).replace(/<\/?b>/g, '**')}`).join('\n') +
    (hits.length > 25 ? `\n[${hits.length - 25} more not shown; narrow the query.]` : '');
}

export async function listDocuments(ctx: ToolContext, input: Row) {
  const type = str(input.type).trim();
  const docs = await rows(ctx, 'documents', 'id, title, type, updated_at, content');
  const list = docs.filter((d) => !type || str(d.type) === type).sort((a, b) => str(a.title).localeCompare(str(b.title)));
  return list.map((d) => `- ${d.id}  [${d.type}] ${d.title}  (${str(d.content).length.toLocaleString()} chars)`).join('\n') || 'No documents.';
}

export async function readDocument(ctx: ToolContext, input: Row) {
  const docs = await rows(ctx, 'documents', 'id, title, type, content, updated_at');
  const d = resolve(docs, input.document, (r) => str(r.title), 'document');
  return `${d.title}  [${d.type}]  id ${d.id}  · ${str(d.content).length.toLocaleString()} chars\n\n${page(str(d.content), Number(input.offset))}`;
}

export async function outline(ctx: ToolContext) {
  const [chapters, scenes, events, docs] = await Promise.all([
    loadChapters(ctx), loadScenes(ctx),
    rows(ctx, 'storyboard_events', 'id, book').catch(() => [] as Row[]),
    rows(ctx, 'documents', 'title, type'),
  ]);
  const lines: string[] = [];
  let book = -1, act = -1;
  for (const c of chapters) {
    if (c.book !== book) { book = c.book as number; act = -1; lines.push(`\n${bookName(book)}  (${events.filter((e) => e.book === book).length} storyboard notes)`); }
    if (c.act !== act) { act = c.act as number; lines.push(`  Act ${act}`); }
    lines.push(`    - ${c.id}  ${c.title || 'Untitled'} (${c.status}, ${str(c.content).trim().split(/\s+/).filter(Boolean).length} words)`);
  }
  if (!chapters.length) lines.push('No chapters yet.');
  lines.push(`\nScenes: ${scenes.length} (${scenes.filter((s) => s.became_type === 'chapter').length} became chapters).`);
  const types: Record<string, number> = {};
  for (const d of docs) types[str(d.type)] = (types[str(d.type)] ?? 0) + 1;
  lines.push(`Documents: ${Object.entries(types).map(([t, n]) => `${n} ${t}`).join(', ')}.`);
  return lines.join('\n').trim();
}

export async function readChapter(ctx: ToolContext, input: Row) {
  const chapters = await loadChapters(ctx);
  const c = resolve(chapters, input.chapter, (r) => str(r.title), 'chapter');
  const notes = str(c.notes).trim();
  return `${chapterLabel(c, chapters)}  ·  id ${c.id}  ·  ${c.status}${notes ? `\nNotes: ${notes}` : ''}\n\n${page(str(c.content), Number(input.offset))}`;
}

export async function listScenes(ctx: ToolContext, input: Row) {
  const scenes = await loadScenes(ctx);
  const q = str(input.contains).toLowerCase().trim();
  const list = scenes.filter((s) => !q || (s.title + '\n' + s.content).toLowerCase().includes(q));
  return list.slice(0, 60).map((s) => `- ${s.id}  ${s.title}${s.became_type === 'chapter' ? `  → chapter ${s.became_id}` : ''}`).join('\n') +
    (list.length > 60 ? `\n[${list.length - 60} more; narrow with contains.]` : '') || 'No scenes match.';
}

export async function readScene(ctx: ToolContext, input: Row) {
  const scenes = await loadScenes(ctx);
  const s = resolve(scenes, input.scene, (r) => str(r.title), 'scene');
  return `${s.title}  ·  id ${s.id}${s.became_type ? `  ·  became ${s.became_type} ${s.became_id}` : ''}\n\n${page(s.content, Number(input.offset))}`;
}

export async function listPages(ctx: ToolContext, input: Row) {
  const pages = await rows(ctx, 'sticky_notes', '*');
  const q = str(input.contains).toLowerCase().trim();
  const list = pages
    .filter((p) => !q || str(p.content).toLowerCase().includes(q))
    .sort((a, b) => str(b.updated_at ?? b.created_at).localeCompare(str(a.updated_at ?? a.created_at)));
  return list.slice(0, 40).map((p) => {
    const first = str(p.content).split('\n').find((l) => l.trim()) ?? '';
    return `- ${p.id}  ${str(p.created_at).slice(0, 10)}  ${first.slice(0, 90)}${p.became_type ? `  → became ${p.became_type}` : ''}`;
  }).join('\n') || 'No pages.';
}

export async function readPage(ctx: ToolContext, input: Row) {
  const pages = await rows(ctx, 'sticky_notes', '*');
  const p = resolve(pages, input.page, (r) => str(r.content).split('\n')[0] ?? '', 'page');
  return `Page ${p.id} · written ${str(p.created_at).slice(0, 10)}${p.became_type ? ` · became ${p.became_type} ${p.became_id}` : ''}\n\n${page(str(p.content), Number(input.offset))}`;
}

export async function readStoryboard(ctx: ToolContext, input: Row) {
  const book = Number.isFinite(Number(input.book)) ? Number(input.book) - 1 : null;
  const [events, threads, links, cast, chapters] = await Promise.all([
    rows(ctx, 'storyboard_events', '*'), rows(ctx, 'storyboard_threads', '*'), rows(ctx, 'storyboard_links', '*'),
    rows(ctx, 'storyboard_cast', 'id, name').catch(() => [] as Row[]), loadChapters(ctx),
  ]);
  const books = [...new Set(events.map((e) => e.book as number))].filter((b) => book === null || b === book).sort((a, b) => a - b);
  if (!books.length) return book === null ? 'The storyboard is empty.' : `Nothing on ${bookName(book)}'s storyboard.`;
  const out: string[] = [];
  for (const b of books) {
    out.push(`${bookName(b)}`);
    const inBook = events.filter((e) => e.book === b).sort((x, y) => Number(x.position) - Number(y.position));
    inBook.forEach((e, i) => {
      const on = links.filter((k) => k.event_id === e.id).map((k) => str(threads.find((t) => t.id === k.thread_id)?.name)).filter(Boolean);
      const who = ((e.character_ids as string[] | null) ?? []).map((id) => str(cast.find((c) => c.id === id)?.name)).filter(Boolean);
      const ch = chapters.find((c) => c.id === e.chapter_id);
      out.push(`  ${i + 1}. ${e.id}  ${e.title || 'Untitled'}${e.summary ? ` — ${e.summary}` : ''}` +
        `${who.length ? `\n     in it: ${who.join(', ')}` : ''}${on.length ? `\n     threads: ${on.join(', ')}` : ''}` +
        `${ch ? `\n     became: ${chapterLabel(ch, chapters)}` : ''}${e.treatment_id ? `\n     scene: ${e.treatment_id}` : ''}`);
    });
  }
  return out.join('\n');
}

export async function readCharacter(ctx: ToolContext, input: Row) {
  const [cast, fields, docs] = await Promise.all([
    rows(ctx, 'storyboard_cast', '*'), rows(ctx, 'character_fields', '*').catch(() => [] as Row[]),
    rows(ctx, 'documents', 'id, title'),
  ]);
  if (!str(input.character).trim()) {
    return cast.map((c) => `- ${c.id}  ${c.name}${c.description ? ` — ${c.description}` : ''}`).join('\n') || 'No characters yet.';
  }
  const c = resolve(cast, input.character, (r) => str(r.name), 'character');
  const values = (c.fields as Record<string, string> | null) ?? {};
  const bible = docs.find((d) => d.id === c.document_id);
  const infobox = fields.sort((a, b) => Number(a.position) - Number(b.position))
    .map((f) => `  ${f.name}: ${values[f.id as string] || '—'}`).join('\n');
  return `${c.name}  ·  id ${c.id}\nLine on their card: ${c.description || '—'}\nBible: ${bible ? `${bible.title} (${bible.id}) — read it with read_document` : 'none linked'}\nInfobox:\n${infobox || '  (no fields defined)'}`;
}

// ---- checks: the deterministic half of validation -------------------------------------------

type Annotation = { type?: string; text?: string; label?: string; pairs?: { id: string; label?: string }[]; pairId?: string; pairLabel?: string; thread?: string };
const pairsOf = (a: Annotation) => a.pairs ?? (a.pairId ? [{ id: a.pairId, label: a.pairLabel }] : []);

export async function checkOpenPlants(ctx: ToolContext) {
  const chapters = await loadChapters(ctx);
  const paid = new Set<string>();
  for (const c of chapters) for (const a of (c.annotations as Annotation[] | null) ?? []) if (a.type === 'reveal') pairsOf(a).forEach((p) => paid.add(p.id));
  const out: string[] = [];
  for (const c of chapters) {
    for (const a of (c.annotations as Annotation[] | null) ?? []) {
      if (a.type !== 'plant') continue;
      const pairs = pairsOf(a);
      if (pairs.length && pairs.some((p) => paid.has(p.id))) continue;
      out.push(`- ${chapterLabel(c, chapters)}: "${str(a.text).slice(0, 160)}"${a.label ? ` (${a.label})` : ''} — ${pairs.length ? `grouping ${pairs.map((p) => p.label || p.id).join(', ')} has no reveal` : 'in no grouping'}`);
    }
  }
  return out.length ? `${out.length} plant(s) with no reveal paying them:\n${out.join('\n')}` : 'Every flagged plant has a reveal.';
}

const words = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(' ').filter((w) => w.length > 3);

/** index.html's isMatched(): a requirement is met by any provide sharing two of its words. */
export async function checkUnmetRequirements(ctx: ToolContext) {
  const [scenes, chapters] = await Promise.all([rows(ctx, 'scenes', '*'), loadChapters(ctx)]);
  const provides = scenes.flatMap((s) => ((s.provides as string[] | null) ?? []).map(words));
  const out: string[] = [];
  for (const s of scenes) {
    const deferred = new Set((s.deferred_requires as string[] | null) ?? []);
    for (const r of (s.requires as string[] | null) ?? []) {
      if (!r.trim() || deferred.has(r)) continue;
      const need = new Set(words(r));
      if (!need.size) continue;
      const met = provides.some((p) => p.filter((w) => need.has(w)).length >= Math.min(2, need.size));
      if (!met) {
        const ch = chapters.find((c) => c.id === s.chapter_id);
        out.push(`- "${r}" — needed by ${s.title || 'a scene'}${ch ? ` in ${chapterLabel(ch, chapters)}` : ''}`);
      }
    }
  }
  return out.length ? `${out.length} requirement(s) nothing provides (deferred ones excluded):\n${out.join('\n')}` : 'Every scene requirement is provided somewhere, or deferred.';
}

export async function checkIdleThreads(ctx: ToolContext, input: Row) {
  const gap = Math.max(2, Number(input.min_gap) || 8);
  const chapters = await loadChapters(ctx);
  const last = new Map<string, number>();
  chapters.forEach((c, i) => ((c.annotations as Annotation[] | null) ?? []).forEach((a) => { if (a.type === 'note' && a.thread) last.set(a.thread, i); }));
  const out = [...last].filter(([, i]) => chapters.length - 1 - i >= gap)
    .map(([t, i]) => `- ${t}: last touched in ${chapterLabel(chapters[i], chapters)} — ${chapters.length - 1 - i} chapters ago`);
  return last.size === 0 ? 'No mythic threads are tagged yet.' : out.length ? out.join('\n') : `Every thread has been touched within the last ${gap} chapters.`;
}

export async function checkPovGaps(ctx: ToolContext, input: Row) {
  const gap = Math.max(2, Number(input.min_gap) || 6);
  const [scenes, chapters] = await Promise.all([rows(ctx, 'scenes', 'chapter_id, pov'), loadChapters(ctx)]);
  const at = new Map<string, number[]>();
  for (const s of scenes) {
    const pov = str(s.pov).trim();
    const i = chapters.findIndex((c) => c.id === s.chapter_id);
    if (pov && i >= 0) at.set(pov, [...(at.get(pov) ?? []), i]);
  }
  const out: string[] = [];
  for (const [pov, list] of at) {
    const idx = [...new Set(list)].sort((a, b) => a - b);
    for (let k = 1; k < idx.length; k++) if (idx[k] - idx[k - 1] > gap) out.push(`- ${pov}: absent for ${idx[k] - idx[k - 1] - 1} chapters, between ${chapterLabel(chapters[idx[k - 1]], chapters)} and ${chapterLabel(chapters[idx[k]], chapters)}`);
    const since = chapters.length - 1 - idx[idx.length - 1];
    if (since > gap) out.push(`- ${pov}: not seen for the last ${since} chapters`);
  }
  return at.size === 0 ? 'No scene names a point of view yet.' : out.length ? out.join('\n') : `No point of view is absent for more than ${gap} chapters.`;
}

export async function checkUnusedPages(ctx: ToolContext, input: Row) {
  const days = Math.max(1, Number(input.older_than_days) || 14);
  const pages = await rows(ctx, 'sticky_notes', '*');
  const cutoff = Date.now() - days * 86_400_000;
  const idle = pages.filter((p) => !p.became_type && p.status !== 'reviewed' && Date.parse(str(p.created_at)) < cutoff);
  return idle.length
    ? `${idle.length} page(s) older than ${days} days, never read through and never turned into anything:\n` +
      idle.slice(0, 40).map((p) => `- ${p.id}  ${str(p.created_at).slice(0, 10)}  ${(str(p.content).split('\n').find((l) => l.trim()) ?? '').slice(0, 90)}`).join('\n')
    : `No page older than ${days} days is waiting.`;
}

export async function checkUnplacedScenes(ctx: ToolContext) {
  const [scenes, events] = await Promise.all([loadScenes(ctx), rows(ctx, 'storyboard_events', 'treatment_id').catch(() => [] as Row[])]);
  const pinned = new Set(events.map((e) => e.treatment_id).filter(Boolean));
  const idle = scenes.filter((s) => s.became_type !== 'chapter' && !pinned.has(s.id));
  return idle.length
    ? `${idle.length} scene(s) neither on a storyboard nor made into a chapter:\n` + idle.slice(0, 60).map((s) => `- ${s.id}  ${s.title}`).join('\n') + (idle.length > 60 ? `\n[${idle.length - 60} more]` : '')
    : 'Every scene is on a storyboard or has become a chapter.';
}
