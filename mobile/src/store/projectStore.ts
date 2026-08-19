import { create } from 'zustand';

import { supabase } from '../lib/supabase';

// Mirrors the PWA's loadProjectOptions()/rename/delete/create handlers (index.html,
// the project-screen IIFE) — same `projects` table, same columns, filtered by the
// signed-in user (RLS/manual filtering, see handoff doc §4 on the unverified-RLS caveat).
export type Project = {
  id: string;
  name: string;
  project_type: string;
  created_at: string;
};

type ProjectState = {
  projects: Project[];
  loading: boolean;
  error: string | null;
  fetchProjects: (userId: string) => Promise<void>;
  createProject: (userId: string, name: string) => Promise<{ project: Project | null; error: string | null }>;
  renameProject: (projectId: string, name: string) => Promise<{ error: string | null }>;
  deleteProject: (projectId: string) => Promise<{ error: string | null }>;
};

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  loading: false,
  error: null,
  fetchProjects: async (userId) => {
    set({ loading: true, error: null });
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });
    if (error) {
      set({ loading: false, error: error.message });
      return;
    }
    set({ loading: false, projects: data ?? [] });
  },
  createProject: async (userId, name) => {
    const { data, error } = await supabase
      .from('projects')
      .insert({ user_id: userId, name, project_type: 'writing' })
      .select()
      .single();
    if (error) return { project: null, error: error.message };
    set({ projects: [...get().projects, data] });
    return { project: data, error: null };
  },
  renameProject: async (projectId, name) => {
    const { error } = await supabase.from('projects').update({ name }).eq('id', projectId);
    if (error) return { error: error.message };
    set({ projects: get().projects.map((p) => (p.id === projectId ? { ...p, name } : p)) });
    return { error: null };
  },
  // Hard delete, no trash/recovery -- matches the PWA exactly (deleteConfirmBtn handler,
  // index.html): this cascades every chapter/scene/document/sticky-note in the project.
  deleteProject: async (projectId) => {
    const { error } = await supabase.from('projects').delete().eq('id', projectId);
    if (error) return { error: error.message };
    set({ projects: get().projects.filter((p) => p.id !== projectId) });
    return { error: null };
  },
}));
