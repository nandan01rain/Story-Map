import { create } from 'zustand';

import { supabase } from '../lib/supabase';

// Mirrors the PWA's chapters table shape (handoff doc §4) and loadData() (index.html).
export type Annotation = {
  id: string;
  type: 'plant' | 'reveal' | 'note';
  text: string; // the exact flagged substring -- annotations relocate by searching for
  // this on every render rather than tracking a fixed offset (handoff doc §3.5). Linked-
  // plant matching and thread-based Mythic Threads are Phase 3 scope, not modeled yet.
  label: string;
  thread?: string;
};

export type Version = {
  content: string;
  savedAt: number;
  words: number;
};

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
  annotations: Annotation[];
  versions: Version[];
};

type ChapterState = {
  chapters: Chapter[];
  loading: boolean;
  error: string | null;
  fetchChapters: (projectId: string) => Promise<void>;
  updateChapter: (
    chapterId: string,
    patch: Partial<Pick<Chapter, 'title' | 'book' | 'act' | 'status' | 'notes' | 'content' | 'annotations' | 'versions'>>,
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
      .select('id, project_id, book, act, "order", title, status, content, notes, annotations, versions')
      .eq('project_id', projectId)
      .order('order', { ascending: true });
    if (error) {
      set({ loading: false, error: error.message });
      return;
    }
    const rows = (data ?? []).map((r) => ({
      ...r,
      annotations: r.annotations ?? [],
      versions: r.versions ?? [],
    })) as Chapter[];
    set({ loading: false, chapters: rows });
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
