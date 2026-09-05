import { create } from 'zustand';

import { isOffline, readCache, writeCache } from '../lib/offlineCache';
import { supabase } from '../lib/supabase';

// Mirrors the PWA's chapters table shape (handoff doc §4) and loadData() (index.html).
// The three flag types plus 'highlight'. A highlight is stored the same way -- an
// annotation carrying the exact substring -- but it is a reading mark, not a story flag:
// it has no label, never appears in the Flags list or its count, and exists only to tint
// the text in the Reader.
export type FlagType = 'plant' | 'reveal' | 'note';

export type Annotation = {
  id: string;
  type: FlagType | 'highlight';
  text: string; // the exact flagged substring -- annotations relocate by searching for
  // this on every render rather than tracking a fixed offset (handoff doc §3.5).
  label: string;
  /**
   * Which setup/payoff groupings this flag belongs to, each with the grouping's own title.
   * An array because the relationship is many-to-many in both directions AND a single flag
   * can take part in more than one grouping.
   */
  pairs?: { id: string; label: string }[];
  /** @deprecated Superseded by `pairs`. Still read so older annotations keep working. */
  pairId?: string;
  /** @deprecated Superseded by `pairs`. */
  pairLabel?: string;
  /** Narrows a note from its whole chapter to one scene. */
  sceneId?: string;
  /**
   * Mythic thread: the name of the mythological parallel this note draws, e.g. "Sita-Zia".
   * Only meaningful on a note -- a thread IS a note, the subset the writer has marked as
   * echoing a known arc or setting.
   */
  thread?: string;
  /** Whose arc the parallel belongs to. A graph character node id. */
  characterId?: string;
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
  // Creates a chapter directly from List view (a book's "+" button), not via the full
  // editor flow -- title + act only, everything else defaults the same way a fresh row
  // would (idea status, empty prose/notes, no annotations/versions yet).
  createChapter: (
    projectId: string,
    book: number,
    act: number,
    title: string,
  ) => Promise<{ chapter: Chapter | null; error: string | null }>;
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

    // Paint from the last-known-good copy first, so the list is readable before the network
    // is asked anything -- and remains readable if it never answers.
    if (get().chapters.length === 0) {
      const cached = await readCache<Chapter[]>('chapters:' + projectId);
      if (cached) set({ chapters: cached, loading: false });
    }

    const { data, error } = await supabase
      .from('chapters')
      .select('id, project_id, book, act, "order", title, status, content, notes, annotations, versions')
      .eq('project_id', projectId)
      .order('order', { ascending: true });
    if (error) {
      // Offline keeps whatever the cache gave us and says nothing; a real database error is
      // still an error worth surfacing.
      set({ loading: false, error: isOffline(error) ? null : error.message });
      return;
    }
    const rows = (data ?? []).map((r) => ({
      ...r,
      annotations: r.annotations ?? [],
      versions: r.versions ?? [],
    })) as Chapter[];
    set({ loading: false, chapters: rows });
    writeCache('chapters:' + projectId, rows);
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
  // Hard delete, unrecoverable. The UI goes through trashStore instead; this stays for
  // callers that genuinely mean "gone", and there are none today.
  deleteChapter: async (chapterId) => {
    const { error } = await supabase.from('chapters').delete().eq('id', chapterId);
    if (error) return { error: error.message };
    set({ chapters: get().chapters.filter((c) => c.id !== chapterId) });
    return { error: null };
  },
  // New chapters land at the TOP of their act -- an order strictly lower than every
  // existing chapter in that act, so nothing else needs renumbering (matches how
  // ChapterListScreen's own reorder already treats `order` as an act-scoped sort key,
  // not a book-wide sequence).
  createChapter: async (projectId, book, act, title) => {
    const actOrders = get()
      .chapters.filter((c) => c.project_id === projectId && c.book === book && c.act === act)
      .map((c) => c.order);
    const order = actOrders.length > 0 ? Math.min(...actOrders) - 1 : 0;
    const { data, error } = await supabase
      .from('chapters')
      .insert({
        project_id: projectId,
        book,
        act,
        order,
        title: title.trim() || 'Untitled chapter',
        status: 'idea',
        content: '',
        notes: '',
        annotations: [],
        versions: [],
      })
      .select('id, project_id, book, act, "order", title, status, content, notes, annotations, versions')
      .single();
    if (error) return { chapter: null, error: error.message };
    const chapter = { ...data, annotations: data.annotations ?? [], versions: data.versions ?? [] } as Chapter;
    set({ chapters: [...get().chapters, chapter] });
    return { chapter, error: null };
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
