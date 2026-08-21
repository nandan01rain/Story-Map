import { create } from 'zustand';

import { supabase } from '../lib/supabase';

// The PWA's Documents library (Master Bible, character bibles, scene references,
// timelines) -- same `documents` table, same columns (handoff doc §4). Mobile had no
// Documents surface at all until now; the Drive import is what made one necessary, since
// imported files have to land somewhere the user can actually read and edit them.
export type StoryDocument = {
  id: string;
  project_id: string;
  user_id: string;
  title: string;
  type: string;
  content: string;
  updated_at: string;
};

// Free text in the PWA, but these four cover everything it actually creates, and a fixed
// set makes the list groupable and the import screen able to tag a whole batch at once.
export const DOCUMENT_TYPES = ['bible', 'character', 'reference', 'timeline'] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];
export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  bible: 'Master Bible',
  character: 'Character',
  reference: 'Reference',
  timeline: 'Timeline',
};

type DocumentState = {
  documents: StoryDocument[];
  loading: boolean;
  error: string | null;
  fetchDocuments: (projectId: string) => Promise<void>;
  createDocument: (
    projectId: string,
    userId: string,
    title: string,
    type: string,
    content: string,
  ) => Promise<{ document: StoryDocument | null; error: string | null }>;
  updateDocument: (id: string, patch: Partial<StoryDocument>) => Promise<{ error: string | null }>;
  deleteDocument: (id: string) => Promise<{ error: string | null }>;
};

export const useDocumentStore = create<DocumentState>((set, get) => ({
  documents: [],
  loading: false,
  error: null,

  fetchDocuments: async (projectId) => {
    set({ loading: true, error: null });
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('project_id', projectId)
      .order('updated_at', { ascending: false });
    if (error) {
      set({ loading: false, error: error.message });
      return;
    }
    set({ loading: false, documents: data ?? [] });
  },

  createDocument: async (projectId, userId, title, type, content) => {
    const { data, error } = await supabase
      .from('documents')
      .insert({ project_id: projectId, user_id: userId, title, type, content })
      .select()
      .single();
    if (error) return { document: null, error: error.message };
    set({ documents: [data, ...get().documents] });
    return { document: data, error: null };
  },

  updateDocument: async (id, patch) => {
    const { error } = await supabase
      .from('documents')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) return { error: error.message };
    set({ documents: get().documents.map((d) => (d.id === id ? { ...d, ...patch } : d)) });
    return { error: null };
  },

  deleteDocument: async (id) => {
    const { error } = await supabase.from('documents').delete().eq('id', id);
    if (error) return { error: error.message };
    set({ documents: get().documents.filter((d) => d.id !== id) });
    return { error: null };
  },
}));
