import { create } from 'zustand';

import { supabase } from '../lib/supabase';

// Mirrors the PWA's loadProjectOptions() (index.html) — same `projects` table,
// same columns, filtered by the signed-in user (RLS/manual filtering, see handoff
// doc §4 on the unverified-RLS caveat).
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
};

export const useProjectStore = create<ProjectState>((set) => ({
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
}));
