import { useEffect, useSyncExternalStore } from 'react';
import { create } from 'zustand';

import { indexSource, indexStatus } from '../lib/assistant';
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

    const [{ data: chapters }, { data: documents }] = await Promise.all([
      supabase.from('chapters').select('id, title, content').eq('project_id', projectId),
      supabase.from('documents').select('id, title, content').eq('project_id', projectId),
    ]);

    const sources = [
      ...(chapters ?? []).map((c) => ({ type: 'chapter' as const, ...c })),
      ...(documents ?? []).map((d) => ({ type: 'document' as const, ...d })),
    ].filter((s) => (s.content ?? '').trim().length > 0);

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
}));

// Hydrates once per app run, so a screen can read `enabled` without each one wiring its own
// fetch.
export function useAssistantEnabled(): boolean {
  const enabled = useAssistantStore((s) => s.enabled);
  const hydrated = useAssistantStore((s) => s.hydrated);
  useEffect(() => {
    if (!hydrated) useAssistantStore.getState().hydrate();
  }, [hydrated]);
  return enabled;
}

export { indexStatus };
