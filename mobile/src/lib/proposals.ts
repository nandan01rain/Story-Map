import { supabase } from './supabase';
import { wordCount } from './storyData';
import { useChapterStore } from '../store/chapterStore';
import { usePageStore } from '../store/pageStore';
import { useStoryboardStore } from '../store/storyboardStore';
import { useTreatmentStore } from '../store/treatmentStore';

// The proposal queue, from the writer's side (2026-10-12).
//
// The assistants write nothing. What they want changed waits in assistant_proposals
// (supabase/migrations/20261012_assistant_library.sql) until the writer looks at it. ACCEPT
// applies it through the same stores the writer's own edits use -- so the outbox, the caches,
// the version history and the backup mirror all see it exactly as they would see a keystroke --
// after re-checking it against the text as it is NOW: a passage edited since the proposal was
// made, or quoted twice by then, makes the proposal stale rather than landing on the wrong words.
// REJECT records the decision. Nothing is deleted: the row keeps what was proposed and, once
// accepted, what it replaced.

export type ProposalKind = 'edit_text' | 'new_scene' | 'storyboard_note' | 'link_scene_chapter' | 'character_fields';

export type Proposal = {
  id: string;
  project_id: string;
  agent: 'icarus' | 'daedalus';
  kind: ProposalKind;
  target_type: string | null;
  target_id: string | null;
  summary: string;
  rationale: string;
  payload: Record<string, unknown>;
  status: 'pending' | 'accepted' | 'rejected' | 'stale';
  created_at: string;
  decided_at: string | null;
};

const MAX_VERSIONS = 10;
const str = (v: unknown) => (typeof v === 'string' ? v : '');

export async function fetchProposals(projectId: string): Promise<{ proposals: Proposal[]; error: string | null }> {
  const { data, error } = await supabase
    .from('assistant_proposals')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) {
    return { proposals: [], error: /assistant_proposals/.test(error.message)
      ? 'Proposals need supabase/migrations/20261012_assistant_library.sql run once.'
      : error.message };
  }
  return { proposals: (data ?? []) as Proposal[], error: null };
}

async function decide(id: string, status: Proposal['status'], payload?: Record<string, unknown>) {
  const { error } = await supabase
    .from('assistant_proposals')
    .update({ status, decided_at: new Date().toISOString(), ...(payload ? { payload } : {}) })
    .eq('id', id);
  return error?.message ?? null;
}

export const rejectProposal = (p: Proposal) => decide(p.id, 'rejected');

function countOf(haystack: string, needle: string) {
  let n = 0, i = 0;
  while ((i = haystack.indexOf(needle, i)) !== -1) { n++; i += needle.length; }
  return n;
}

/** Apply, or explain why not. A proposal that no longer fits is marked stale, never forced. */
export async function acceptProposal(p: Proposal, userId: string): Promise<{ error: string | null }> {
  const pl = p.payload;
  const stale = async (why: string) => {
    await decide(p.id, 'stale', { ...pl, stale_reason: why });
    return { error: why };
  };

  if (p.kind === 'edit_text') {
    const find = str(pl.find), replace = str(pl.replace);
    if (p.target_type === 'document') {
      const { data, error } = await supabase.from('documents').select('content').eq('id', p.target_id).single();
      if (error || !data) return stale('That document no longer exists.');
      const content = str(data.content);
      if (countOf(content, find) !== 1) return stale('The passage has changed since this was proposed.');
      const next = content.replace(find, replace);
      const { error: e2 } = await supabase.from('documents').update({ content: next, updated_at: new Date().toISOString() }).eq('id', p.target_id);
      if (e2) return { error: e2.message };
      // Documents keep no version history of their own, so the proposal keeps what it replaced.
      return { error: await decide(p.id, 'accepted', { ...pl, replaced_content: content }) };
    }
    if (p.target_type === 'chapter') {
      const store = useChapterStore.getState();
      if (!store.chapters.some((c) => c.id === p.target_id)) await store.fetchChapters(p.project_id);
      const ch = useChapterStore.getState().chapters.find((c) => c.id === p.target_id);
      if (!ch) return stale('That chapter no longer exists.');
      if (countOf(ch.content, find) !== 1) return stale('The passage has changed since this was proposed.');
      // The text it replaces goes into the chapter's own history, as a writer's edit would.
      const versions = ch.content.trim()
        ? [{ content: ch.content, savedAt: Date.now(), words: wordCount(ch.content) }, ...ch.versions].slice(0, MAX_VERSIONS)
        : ch.versions;
      const { error } = await useChapterStore.getState().updateChapter(ch.id, { content: ch.content.replace(find, replace), versions });
      if (error) return { error };
      return { error: await decide(p.id, 'accepted') };
    }
    if (p.target_type === 'scene') {
      const versionId = str(pl.version_id);
      const { data, error } = await supabase.from('treatment_versions').select('content').eq('id', versionId).single();
      if (error || !data) return stale('That scene version no longer exists.');
      const content = str(data.content);
      if (countOf(content, find) !== 1) return stale('The passage has changed since this was proposed.');
      const ts = useTreatmentStore.getState();
      if (!ts.versions.some((v) => v.id === versionId)) await ts.fetchTreatments(p.project_id);
      const { error: e2 } = await useTreatmentStore.getState().saveVersion(versionId, content.replace(find, replace));
      if (e2) return { error: e2 };
      return { error: await decide(p.id, 'accepted', { ...pl, replaced_content: content }) };
    }
    return stale('Unknown target.');
  }

  if (p.kind === 'new_scene') {
    const fromPage = str(pl.from_page) || null;
    const { treatment, error } = await useTreatmentStore.getState().createTreatment(userId, p.project_id, str(pl.content));
    if (error || !treatment) return { error: error ?? 'The scene could not be made.' };
    if (fromPage) {
      const pages = usePageStore.getState();
      if (!pages.pages.some((x) => x.id === fromPage)) await pages.fetchPages(p.project_id);
      await usePageStore.getState().markBecame(fromPage, 'treatment', treatment.id);
    }
    return { error: await decide(p.id, 'accepted', { ...pl, created_id: treatment.id }) };
  }

  if (p.kind === 'storyboard_note') {
    const board = useStoryboardStore.getState();
    if (board.projectId !== p.project_id) await board.fetch(p.project_id);
    const { event, error } = await useStoryboardStore.getState().addEvent({
      projectId: p.project_id, userId, book: Number(pl.book) || 0,
      title: str(pl.title), summary: str(pl.summary),
      chapterId: str(pl.chapter_id) || null, treatmentId: str(pl.scene_id) || null,
    });
    if (error || !event) return { error: error ?? 'The note could not be pinned.' };
    return { error: await decide(p.id, 'accepted', { ...pl, created_id: event.id }) };
  }

  if (p.kind === 'link_scene_chapter') {
    const sceneId = str(pl.scene_id), chapterId = str(pl.chapter_id);
    const ts = useTreatmentStore.getState();
    if (!ts.treatments.some((t) => t.id === sceneId)) await ts.fetchTreatments(p.project_id);
    if (!useTreatmentStore.getState().treatments.some((t) => t.id === sceneId)) return stale('That scene no longer exists.');
    const { error } = await useTreatmentStore.getState().markBecame(sceneId, 'chapter', chapterId);
    if (error) return { error };
    // The scene's storyboard notes follow it into the manuscript, as when the writer does it.
    await useStoryboardStore.getState().followSketchToChapter(sceneId, chapterId);
    return { error: await decide(p.id, 'accepted') };
  }

  if (p.kind === 'character_fields') {
    const board = useStoryboardStore.getState();
    if (board.projectId !== p.project_id) await board.fetch(p.project_id);
    const member = useStoryboardStore.getState().cast.find((c) => c.id === p.target_id);
    if (!member) return stale('That character no longer exists.');
    const before = { description: member.description ?? null, fields: { ...(member.fields ?? {}) } };
    // A field name not yet in the infobox becomes a row for every character, as the writer's
    // "+ Add a field" does.
    const wanted = (pl.fields ?? {}) as Record<string, string>;
    for (const name of Object.keys(wanted)) {
      const exists = useStoryboardStore.getState().characterFields.some((f) => f.name.toLowerCase() === name.toLowerCase());
      if (!exists) {
        const { error } = await useStoryboardStore.getState().addCharacterField({ projectId: p.project_id, userId, name });
        if (error) return { error };
      }
    }
    const byName = new Map(useStoryboardStore.getState().characterFields.map((f) => [f.name.toLowerCase(), f.id]));
    const fields = { ...(member.fields ?? {}) };
    for (const [name, value] of Object.entries(wanted)) {
      const id = byName.get(name.toLowerCase());
      if (id) fields[id] = value;
    }
    const patch: { fields: Record<string, string>; description?: string } = { fields };
    if (str(pl.description)) patch.description = str(pl.description);
    const { error } = await useStoryboardStore.getState().updateCast(member.id, patch);
    if (error) return { error };
    return { error: await decide(p.id, 'accepted', { ...pl, replaced: before }) };
  }

  return stale('This kind of proposal is not known to this version of the app.');
}
