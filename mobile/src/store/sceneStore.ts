import { create } from 'zustand';

import { supabase } from '../lib/supabase';

// Scenes are metadata-only children of a chapter (title/summary/POV/status) -- prose
// lives on the chapter, not here (CLAUDE.md's hierarchy section). POV autocomplete and
// the requires/provides plant-matching tag lists are Phase 3 scope (POV tracker,
// continuity checker) -- this store covers the fields the Chapter Drawer needs now.
export type Scene = {
  id: string;
  chapter_id: string;
  project_id: string;
  order: number;
  title: string;
  status: 'idea' | 'outline' | 'drafted' | 'final';
  summary: string;
  pov: string | null;
};

type SceneState = {
  scenes: Scene[];
  loading: boolean;
  error: string | null;
  fetchScenes: (chapterId: string) => Promise<void>;
  createScene: (chapterId: string, projectId: string, order: number) => Promise<{ error: string | null }>;
  updateScene: (sceneId: string, patch: Partial<Pick<Scene, 'title' | 'status' | 'summary' | 'pov'>>) => Promise<{ error: string | null }>;
  deleteScene: (sceneId: string) => Promise<{ error: string | null }>;
};

export const useSceneStore = create<SceneState>((set, get) => ({
  scenes: [],
  loading: false,
  error: null,
  fetchScenes: async (chapterId) => {
    set({ loading: true, error: null });
    const { data, error } = await supabase
      .from('scenes')
      .select('id, chapter_id, project_id, "order", title, status, summary, pov')
      .eq('chapter_id', chapterId)
      .order('order', { ascending: true });
    if (error) {
      set({ loading: false, error: error.message });
      return;
    }
    set({ loading: false, scenes: (data as Scene[]) ?? [] });
  },
  createScene: async (chapterId, projectId, order) => {
    const { data, error } = await supabase
      .from('scenes')
      .insert({
        chapter_id: chapterId,
        project_id: projectId,
        order,
        title: 'New scene',
        status: 'idea',
        summary: '',
        requires: [],
        provides: [],
        deferred_requires: [],
      })
      .select()
      .single();
    if (error) return { error: error.message };
    set({ scenes: [...get().scenes, data as Scene] });
    return { error: null };
  },
  updateScene: async (sceneId, patch) => {
    const { error } = await supabase.from('scenes').update(patch).eq('id', sceneId);
    if (error) return { error: error.message };
    set({ scenes: get().scenes.map((s) => (s.id === sceneId ? { ...s, ...patch } : s)) });
    return { error: null };
  },
  deleteScene: async (sceneId) => {
    const { error } = await supabase.from('scenes').delete().eq('id', sceneId);
    if (error) return { error: error.message };
    set({ scenes: get().scenes.filter((s) => s.id !== sceneId) });
    return { error: null };
  },
}));
