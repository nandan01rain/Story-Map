import { create } from 'zustand';

import { isOffline, readCache, writeCache } from '../lib/offlineCache';
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
};

export const useSceneStore = create<SceneState>((set, get) => ({
  scenes: [],
  loading: false,
  error: null,
  // Read-only offline: the chapter drawer paints the last scenes it saw for this chapter.
  // Scene WRITES still go straight to the server and fail visibly without one -- see the note
  // at the foot of offlineCache.ts; they have no outbox path yet.
  fetchScenes: async (chapterId) => {
    set({ loading: true, error: null });
    const cached = await readCache<Scene[]>('scenes:' + chapterId);
    if (cached) set({ scenes: cached, loading: false });
    const { data, error } = await supabase
      .from('scenes')
      .select('id, chapter_id, project_id, "order", title, status, summary, pov')
      .eq('chapter_id', chapterId)
      .order('order', { ascending: true });
    if (error) {
      set({ loading: false, error: isOffline(error) ? null : error.message });
      return;
    }
    const scenes = (data as Scene[]) ?? [];
    set({ loading: false, scenes });
    writeCache('scenes:' + chapterId, scenes);
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
}));
