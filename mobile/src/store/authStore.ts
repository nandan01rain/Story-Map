import type { Session, User } from '@supabase/supabase-js';
import { create } from 'zustand';

import { supabase } from '../lib/supabase';

// Mirrors the current PWA's sbClient.auth.onAuthStateChange-driven flow (index.html,
// near the auth-screen IIFE): whichever screen is showing just reads `session` from
// here rather than each screen wiring its own listener.
type AuthState = {
  session: Session | null;
  user: User | null;
  initializing: boolean; // true until the first onAuthStateChange fires (session restore check)
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
};

export const useAuthStore = create<AuthState>((set) => {
  supabase.auth.onAuthStateChange((_event, session) => {
    set({ session, user: session?.user ?? null, initializing: false });
  });

  return {
    session: null,
    user: null,
    initializing: true,
    signIn: async (email, password) => {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return { error: error?.message ?? null };
    },
    signUp: async (email, password) => {
      const { error } = await supabase.auth.signUp({ email, password });
      return { error: error?.message ?? null };
    },
    signOut: async () => {
      await supabase.auth.signOut();
    },
    // Sends a real Supabase reset email. As in the PWA, there is still no page for that
    // email's link to land on, so the mail arrives but cannot yet complete the reset.
    resetPassword: async (email) => {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      return { error: error?.message ?? null };
    },
  };
});
