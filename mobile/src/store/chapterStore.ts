import { create } from 'zustand';

import { supabase } from '../lib/supabase';

// Mirrors the PWA's chapters table shape (handoff doc §4) and loadData() (index.html).
// `annotations`/`versions` are jsonb arrays; not modeled here yet -- the editor task
// (#4) will extend this type when it needs them.
export type Chapter = {
  id: string;
  project_id: string;
  book: number;
  act: number;
  order: number;
  title: string;
  status: 'idea' | 'outline' | 'drafted' | 'final';
  content: string;
  notes: string;
};

type ChapterState = {
  chapters: Chapter[];
  loading: boolean;
  error: string | null;
  fetchChapters: (projectId: string) => Promise<void>;
  updateChapter: (
    chapterId: string,
    patch: Partial<Pick<Chapter, 'title' | 'book' | 'act' | 'status' | 'notes'>>,
  ) => Promise<{ error: string | null }>;
  deleteChapter: (chapterId: string) => Promise<{ error: string | null }>;
};

export const useChapterStore = create<ChapterState>((set, get) => ({
  chapters: [],
  loading: false,
  error: null,
  fetchChapters: async (projectId) => {
    set({ loading: true, error: null });
    const { data, error } = await supabase
      .from('chapters')
      .select('id, project_id, book, act, "order", title, status, content, notes')
      .eq('project_id', projectId)
      .order('order', { ascending: true });
    if (error) {
      set({ loading: false, error: error.message });
      return;
    }
    set({ loading: false, chapters: (data as Chapter[]) ?? [] });
  },
  updateChapter: async (chapterId, patch) => {
    const { error } = await supabase.from('chapters').update(patch).eq('id', chapterId);
    if (error) return { error: error.message };
    set({ chapters: get().chapters.map((c) => (c.id === chapterId ? { ...c, ...patch } : c)) });
    return { error: null };
  },
  // Hard delete for now -- the PWA soft-deletes to a trash table (handoff doc §5); trash
  // is Phase 3 scope (see plan), this matches the interim behavior of "delete removes it
  // from view" without yet building the recovery path.
  deleteChapter: async (chapterId) => {
    const { error } = await supabase.from('chapters').delete().eq('id', chapterId);
    if (error) return { error: error.message };
    set({ chapters: get().chapters.filter((c) => c.id !== chapterId) });
    return { error: null };
  },
}));
