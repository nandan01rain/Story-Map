import { create } from 'zustand';

import { isOffline, readCache, writeCache } from '../lib/offlineCache';
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
  // The project list is the door to everything else: with no network and no cache here, the
  // editor and reader were unreachable however well they worked once inside. Same shape as
  // chapters -- paint the last-known-good list, replace it when the server answers, and say
  // nothing about a network that does not.
  fetchProjects: async (userId) => {
    set({ loading: get().projects.length === 0, error: null });
    if (get().projects.length === 0) {
      const cached = await readCache<Project[]>('projects:' + userId);
      if (cached) set({ projects: cached, loading: false });
    }
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });
    if (error) {
      set({ loading: false, error: isOffline(error) ? null : error.message });
      return;
    }
    const projects = data ?? [];
    set({ loading: false, projects });
    writeCache('projects:' + userId, projects);
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
