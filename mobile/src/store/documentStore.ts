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
  /**
   * ABSENT on rows from the library listing, which no longer carries the text (2026-10-11):
   * the reference set is 4.3 MB and the list was downloading all of it to show titles. A
   * document's text is fetched when it is opened (`fetchDocument`). Anything that writes a
   * whole document back must hold a fetched one, never a listing row.
   */
  content?: string;
  created_at?: string;
  updated_at: string;
};

// ONE set of labels for both apps (2026-10-11). Mobile used to write its own keys -- bible,
// character, reference, timeline -- while the PWA's type <select> offers the labels below and
// blanks any value it does not offer the moment a document is opened and saved there. These
// are the PWA's labels exactly, so a document typed on either app survives the other.
export const DOCUMENT_TYPES = [
  'Master Bible',
  'Character Bible',
  'Scene Reference',
  'Progression / Timeline',
  'Other',
] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

/** Short chip labels; the stored value is always the full label above. */
export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  'Master Bible': 'Master Bible',
  'Character Bible': 'Character',
  'Scene Reference': 'Reference',
  'Progression / Timeline': 'Timeline',
  Other: 'Other',
};

// What mobile wrote before the labels were unified, read as the label it meant.
const LEGACY_TYPES: Record<string, DocumentType> = {
  bible: 'Master Bible',
  character: 'Character Bible',
  reference: 'Scene Reference',
  timeline: 'Progression / Timeline',
  'Progression-Timeline': 'Progression / Timeline',
};

/** The canonical type of a stored value: legacy keys mapped, anything unknown is Other. */
export function documentType(stored: string | null | undefined): DocumentType {
  if (stored && (DOCUMENT_TYPES as readonly string[]).includes(stored)) return stored as DocumentType;
  return (stored && LEGACY_TYPES[stored]) || 'Other';
}

const LIST_COLUMNS = 'id, project_id, user_id, title, type, created_at, updated_at';

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
  /** One document WITH its text, straight from the server. */
  fetchDocument: (id: string) => Promise<{ document: StoryDocument | null; error: string | null }>;
};

export const useDocumentStore = create<DocumentState>((set, get) => ({
  documents: [],
  loading: false,
  error: null,

  fetchDocuments: async (projectId) => {
    set({ loading: true, error: null });
    const { data, error } = await supabase
      .from('documents')
      .select(LIST_COLUMNS)
      .eq('project_id', projectId)
      // created_at, not updated_at: the library keeps the order documents arrived in (the
      // reference set was loaded in its manifest order), and editing one no longer moves it.
      .order('created_at', { ascending: false });
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
    const { content: _content, ...meta } = data as StoryDocument;
    set({ documents: [meta as StoryDocument, ...get().documents] });
    return { document: data, error: null };
  },

  updateDocument: async (id, patch) => {
    const { error } = await supabase
      .from('documents')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) return { error: error.message };
    // The listing holds no text; keep it that way rather than parking a whole document in it.
    const { content: _content, ...meta } = patch;
    set({ documents: get().documents.map((d) => (d.id === id ? { ...d, ...meta } : d)) });
    return { error: null };
  },

  fetchDocument: async (id) => {
    const { data, error } = await supabase.from('documents').select('*').eq('id', id).single();
    if (error) return { document: null, error: error.message };
    return { document: data as StoryDocument, error: null };
  },
}));
