import { create } from 'zustand';

import { type SourceType, indexSource, indexStatus } from '../lib/assistant';
import { extractGraphForChapter } from '../lib/characterGraph';
import { supabase } from '../lib/supabase';

// The assistant's on/off switch, and the indexing it gates.
//
// Account-level, in Supabase Auth's user_metadata -- the same no-migration pattern the PWA
// uses for motion_enabled and auth_scene_mode. It follows the writer between devices, which
// a device-local flag would not, and this is a billing switch: it should not be possible to
// have it off on the phone and quietly on somewhere else.
//
// Off by default, and off means off: no embedding, no questions, no calls. Indexing is
// deliberately gated on the same flag rather than running on every chapter save, because
// embedding is itself a paid API call -- a toggle that still spends money in the background
// is not a toggle.
// Which engine each agent runs on. Per-agent because the two jobs have genuinely different
// requirements: validation is classification and runs constantly, so cheap is right;
// judgement is asked a few times a week and is where a stronger model actually shows.
export type AgentModels = { icarus: string; daedalus: string };

const DEFAULT_MODELS: AgentModels = {
  icarus: 'claude-haiku-4-5',
  daedalus: 'claude-opus-5',
};

type AssistantState = {
  enabled: boolean;
  models: AgentModels;
  hydrated: boolean;
  indexing: boolean;
  indexProgress: { done: number; total: number } | null;
  lastError: string | null;

  hydrate: () => Promise<void>;
  setEnabled: (enabled: boolean) => Promise<void>;
  setAgentModel: (agent: keyof AgentModels, modelId: string) => Promise<void>;
  indexProject: (projectId: string) => Promise<void>;
  indexChapter: (projectId: string, chapterId: string, title: string, content: string) => Promise<void>;
  extractGraph: (params: {
    projectId: string;
    chapterId: string;
    title: string;
    content: string;
    book: number;
    act: number;
  }) => Promise<void>;
};

export const useAssistantStore = create<AssistantState>((set, get) => ({
  enabled: false,
  models: DEFAULT_MODELS,
  hydrated: false,
  indexing: false,
  indexProgress: null,
  lastError: null,

  hydrate: async () => {
    const { data } = await supabase.auth.getUser();
    const stored = data?.user?.user_metadata?.assistant_models as Partial<AgentModels> | undefined;
    set({
      enabled: data?.user?.user_metadata?.assistant_enabled === true,
      models: { ...DEFAULT_MODELS, ...(stored ?? {}) },
      hydrated: true,
    });
  },

  setEnabled: async (enabled) => {
    set({ enabled, lastError: null });
    const { error } = await supabase.auth.updateUser({ data: { assistant_enabled: enabled } });
    if (error) {
      // Put it back rather than leaving the UI claiming a state the account does not have.
      set({ enabled: !enabled, lastError: error.message });
    }
  },

  setAgentModel: async (agent, modelId) => {
    const next = { ...get().models, [agent]: modelId };
    set({ models: next, lastError: null });
    const { error } = await supabase.auth.updateUser({ data: { assistant_models: next } });
    if (error) set({ lastError: error.message });
  },

  // First enable pays to embed the manuscript once. Afterwards only changed chunks cost
  // anything, because the function compares content hashes before embedding.
  indexProject: async (projectId) => {
    if (!get().enabled || get().indexing) return;
    set({ indexing: true, lastError: null, indexProgress: null });

    // Everything the writer keeps, not only chapters and documents (2026-10-12): the librarian
    // cannot find a drafted scene, a page, a storyboard beat or a character it was never shown.
    // Each kind is read separately and a missing table just contributes nothing, so this works
    // on whichever migrations the project has run. Needs 20261012_assistant_library.sql, which
    // lets content_chunks hold the new kinds.
    const read = async <T,>(q: PromiseLike<{ data: T[] | null }>) => (await q).data ?? [];
    const [chapters, documents, treatments, versions, pages, events, cast] = await Promise.all([
      read(supabase.from('chapters').select('id, title, content').eq('project_id', projectId)),
      read(supabase.from('documents').select('id, title, content').eq('project_id', projectId)),
      read(supabase.from('treatments').select('id, title').eq('project_id', projectId)),
      read(supabase.from('treatment_versions').select('treatment_id, content, status, created_at').eq('project_id', projectId)),
      read(supabase.from('sticky_notes').select('id, content').eq('project_id', projectId)),
      read(supabase.from('storyboard_events').select('id, book, title, summary').eq('project_id', projectId)),
      read(supabase.from('storyboard_cast').select('*').eq('project_id', projectId)),
    ]);
    const liveText = (id: string) =>
      versions
        .filter((v) => v.treatment_id === id)
        .sort((a, b) => (a.status === 'live' ? -1 : 1) - (b.status === 'live' ? -1 : 1) || String(b.created_at).localeCompare(String(a.created_at)))[0]?.content ?? '';
    type Source = { type: SourceType; id: string; title: string | null; content: string | null };
    const sources: Source[] = ([
      ...chapters.map((c) => ({ type: 'chapter' as const, ...c })),
      ...documents.map((d) => ({ type: 'document' as const, ...d })),
      ...treatments.map((t) => ({ type: 'scene' as const, id: t.id, title: t.title, content: liveText(t.id) })),
      ...pages.map((p) => ({ type: 'page' as const, id: p.id, title: (p.content ?? '').split('\n')[0]?.slice(0, 80) ?? '', content: p.content })),
      ...events.map((e) => ({ type: 'storyboard' as const, id: e.id, title: `Book ${Number(e.book) + 1} storyboard: ${e.title ?? ''}`, content: `${e.title ?? ''}\n${e.summary ?? ''}` })),
      ...cast.map((c) => ({
        type: 'character' as const, id: c.id, title: c.name,
        content: [c.name, c.description, ...Object.values((c.fields ?? {}) as Record<string, string>)].filter(Boolean).join('\n'),
      })),
    ] as Source[]).filter((s) => (s.content ?? '').trim().length > 0);

    set({ indexProgress: { done: 0, total: sources.length } });

    // Sequential on purpose: this is a paid API call per source, and firing a whole saga at
    // once is the fastest way to be rate-limited into a half-finished index.
    for (let i = 0; i < sources.length; i += 1) {
      const source = sources[i];
      const { error } = await indexSource({
        projectId,
        sourceType: source.type,
        sourceId: source.id,
        title: source.title ?? '',
        content: source.content ?? '',
      });
      if (error) {
        set({ indexing: false, lastError: error });
        return;
      }
      set({ indexProgress: { done: i + 1, total: sources.length } });
    }

    set({ indexing: false });
  },

  indexChapter: async (projectId, chapterId, title, content) => {
    if (!get().enabled) return;
    const { error } = await indexSource({
      projectId,
      sourceType: 'chapter',
      sourceId: chapterId,
      title,
      content,
    });
    if (error) set({ lastError: error });
  },

  // DEVIATION (spec §3.1): extraction is NOT hooked to the debounced autosave. Autosave
  // fires 1.2s after a keystroke, so a paragraph mid-typing changes hash on almost every
  // save and would be re-extracted continuously -- content hashing prevents wasted
  // embedding, not wasted model calls. This runs when the writer leaves the editor
  // instead, which is the first moment a paragraph is plausibly finished. Gated on the
  // assistant toggle for the same reason indexing is: it is a paid call.
  extractGraph: async (params) => {
    if (!get().enabled) return;
    const { error } = await extractGraphForChapter(params);
    if (error) set({ lastError: error });
  },
}));

export { indexStatus };
