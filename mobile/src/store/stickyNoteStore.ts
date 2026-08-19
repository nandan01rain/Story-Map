import { create } from 'zustand';

import { supabase } from '../lib/supabase';

// Mirrors the PWA's "The Margin" (index.html) -- quick, unstructured idea capture,
// nothing more structured than free text. Same `sticky_notes` table (handoff doc §4):
// id, user_id, project_id, content, created_at, rotation. `rotation` is a small random
// tilt (degrees) the PWA gives each card so a board of them reads as scattered notes
// rather than a rigid list -- generated once at creation, not re-randomized on every load.
export type StickyNote = {
  id: string;
  user_id: string;
  project_id: string;
  content: string;
  created_at: string;
  rotation: number;
};

type StickyNoteState = {
  notes: StickyNote[];
  loading: boolean;
  error: string | null;
  fetchNotes: (projectId: string) => Promise<void>;
  createNote: (userId: string, projectId: string) => Promise<{ note: StickyNote | null; error: string | null }>;
  updateNote: (noteId: string, content: string) => Promise<{ error: string | null }>;
  deleteNote: (noteId: string) => Promise<{ error: string | null }>;
};

export const useStickyNoteStore = create<StickyNoteState>((set, get) => ({
  notes: [],
  loading: false,
  error: null,
  fetchNotes: async (projectId) => {
    set({ loading: true, error: null });
    const { data, error } = await supabase
      .from('sticky_notes')
      .select('id, user_id, project_id, content, created_at, rotation')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });
    if (error) {
      set({ loading: false, error: error.message });
      return;
    }
    set({ loading: false, notes: data ?? [] });
  },
  createNote: async (userId, projectId) => {
    const rotation = Math.round((Math.random() * 6 - 3) * 10) / 10; // -3deg..3deg, same range as the PWA
    const { data, error } = await supabase
      .from('sticky_notes')
      .insert({ user_id: userId, project_id: projectId, content: '', rotation })
      .select('id, user_id, project_id, content, created_at, rotation')
      .single();
    if (error) return { note: null, error: error.message };
    set({ notes: [data, ...get().notes] });
    return { note: data, error: null };
  },
  updateNote: async (noteId, content) => {
    const { error } = await supabase.from('sticky_notes').update({ content }).eq('id', noteId);
    if (error) return { error: error.message };
    set({ notes: get().notes.map((n) => (n.id === noteId ? { ...n, content } : n)) });
    return { error: null };
  },
  deleteNote: async (noteId) => {
    const { error } = await supabase.from('sticky_notes').delete().eq('id', noteId);
    if (error) return { error: error.message };
    set({ notes: get().notes.filter((n) => n.id !== noteId) });
    return { error: null };
  },
}));
