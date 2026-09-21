import { create } from 'zustand';

import { supabase } from '../lib/supabase';
import { uuid } from '../lib/outbox';

// Progressions: what a document says AS OF a chapter. See supabase/migrations/
// 20260921_progressions.sql for what one is and why it is anchored to a chapter.
//
// Direct to the server, like documents themselves: the bibles have no offline path yet, and
// a progression without its document is nothing. `supported` goes false when the table is
// missing (migration not run), and the screen says so instead of failing quietly.

export type Progression = {
  id: string;
  document_id: string;
  project_id: string;
  from_chapter_id: string | null;
  note: string;
  created_at: string;
};

const UNDEFINED_TABLE = '42P01';

type ProgressionState = {
  byDocument: Record<string, Progression[]>;
  supported: boolean;
  fetchForDocument: (documentId: string) => Promise<void>;
  add: (params: { documentId: string; projectId: string; userId: string; fromChapterId: string | null; note: string }) => Promise<{ error: string | null }>;
  update: (id: string, patch: Partial<Pick<Progression, 'from_chapter_id' | 'note'>>) => Promise<{ error: string | null }>;
  remove: (id: string) => Promise<{ error: string | null }>;
};

export const useProgressionStore = create<ProgressionState>((set, get) => ({
  byDocument: {},
  supported: true,

  fetchForDocument: async (documentId) => {
    const { data, error } = await supabase
      .from('document_progressions')
      .select('id, document_id, project_id, from_chapter_id, note, created_at')
      .eq('document_id', documentId)
      .order('created_at', { ascending: true });
    if (error) {
      if (error.code === UNDEFINED_TABLE) set({ supported: false });
      return;
    }
    set({ supported: true, byDocument: { ...get().byDocument, [documentId]: (data as Progression[]) ?? [] } });
  },

  add: async ({ documentId, projectId, userId, fromChapterId, note }) => {
    const row: Progression & { user_id: string } = {
      id: uuid(),
      document_id: documentId,
      project_id: projectId,
      from_chapter_id: fromChapterId,
      note,
      created_at: new Date().toISOString(),
      user_id: userId,
    };
    const { error } = await supabase.from('document_progressions').insert(row);
    if (error) return { error: error.message };
    const { user_id: _u, ...p } = row;
    set({ byDocument: { ...get().byDocument, [documentId]: [...(get().byDocument[documentId] ?? []), p] } });
    return { error: null };
  },

  update: async (id, patch) => {
    const { error } = await supabase
      .from('document_progressions')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) return { error: error.message };
    const next: Record<string, Progression[]> = {};
    for (const [doc, list] of Object.entries(get().byDocument)) {
      next[doc] = list.map((p) => (p.id === id ? { ...p, ...patch } : p));
    }
    set({ byDocument: next });
    return { error: null };
  },

  remove: async (id) => {
    const { error } = await supabase.from('document_progressions').delete().eq('id', id);
    if (error) return { error: error.message };
    const next: Record<string, Progression[]> = {};
    for (const [doc, list] of Object.entries(get().byDocument)) next[doc] = list.filter((p) => p.id !== id);
    set({ byDocument: next });
    return { error: null };
  },
}));
