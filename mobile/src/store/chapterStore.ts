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
  // Persists a new chapter order within a book -- ports the PWA's List view drag-to-
  // reorder (index.html, wireListDrag()), but extended to work across the whole book
  // rather than the PWA's within-act-only scope, per this session's explicit request
  // (that function's own comment explains why the PWA itself only built within-act: no
  // natural "one continuous position" existed without auto-expanding collapsed sections;
  // this app's List view now shows a book's whole chapter list at once when expanded, so
  // that constraint doesn't apply here the same way). Each entry's `act`/`order` is
  // computed by the caller (ChapterListScreen) -- order is renumbered within each
  // resulting act run, not a single book-wide sequence, so a chapter's position among its
  // *own* act-mates is still well-defined after a cross-act move.
  reorderChapters: (updates: { id: string; act: number; order: number }[]) => Promise<{ error: string | null }>;
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
  reorderChapters: async (updates) => {
    const results = await Promise.all(
      updates.map((u) => supabase.from('chapters').update({ act: u.act, order: u.order }).eq('id', u.id)),
    );
    const firstError = results.find((r) => r.error)?.error;
    if (firstError) return { error: firstError.message };
    const byId = new Map(updates.map((u) => [u.id, u]));
    set({
      chapters: get().chapters.map((c) => {
        const u = byId.get(c.id);
        return u ? { ...c, act: u.act, order: u.order } : c;
      }),
    });
    return { error: null };
  },
}));
