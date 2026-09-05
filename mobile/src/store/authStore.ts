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

export const useAuthStore = create<AuthState>((set, get) => {
  supabase.auth.onAuthStateChange((_event, session) => {
    set({ session, user: session?.user ?? null, initializing: false });
  });

  // THE OFFLINE LAUNCH HANG.
  //
  // The navigator shows a spinner while `initializing` is true, and that only clears when
  // onAuthStateChange fires. Supabase restores the stored session fine, but an access token
  // lasts about an hour, so a cold start usually tries to REFRESH it -- and that needs the
  // network. With no network the request does not fail quickly; it hangs until the platform
  // gives up, and the app sits on its splash the whole time looking broken.
  //
  // So: a deadline. If nothing has answered in 2.5s, stop waiting and let the app in with
  // whatever session storage already holds. This does not fake a session -- if there is
  // genuinely none, the sign-in screen is the correct destination and it appears sooner.
  // When the refresh does eventually answer, onAuthStateChange still fires and corrects.
  setTimeout(() => {
    if (!get().initializing) return;
    supabase.auth
      .getSession()
      .then(({ data }) => set({
        session: data.session ?? null,
        user: data.session?.user ?? null,
        initializing: false,
      }))
      .catch(() => set({ initializing: false }));
  }, 2500);

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
