import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';

// Same hosted Supabase project as the existing PWA (supabase-config.js at the repo
// root) — this app reads/writes the exact same tables/rows, no backend changes needed.
// The anon key is the public client key, safe to ship in client code (same as the PWA).
const SUPABASE_URL = 'https://lqjhxogravonkfpmtxtm.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxxamh4b2dyYXZvbmtmcG10eHRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU5MTEyODUsImV4cCI6MjEwMTQ4NzI4NX0.i3DVWh2PGWidBKD7IzJP6qRBabcwl9eASsLlbGQ6QRs';

// Every request gets a deadline. Without one, a network that is connected but not passing
// traffic -- a train tunnel, a captive portal, a phone that thinks it has wifi -- leaves
// fetch waiting on the OS, which can be minutes. Every store flag that waits on that request
// waits with it, and a screen gated on the flag shows a spinner for as long as it takes. The
// Reader opened from the Editor did exactly that (2026-09-19). A genuinely absent network
// fails fast on its own; this is for the network that is present and useless.
//
// Reads and writes get different deadlines because they fail differently. A read gates a
// screen, so 12s is the most a spinner may hold before the cache-first path takes over --
// longer than any real request, short enough to be a pause rather than a hang. A write is
// the outbox replaying in the background, where nothing is waiting on it and a whole chapter
// over a slow link can legitimately take longer; cutting it at 12s would leave a big row
// retried and aborted forever, never lost but never sent. 40s gives it room. An aborted
// request surfaces as an error whose message names the abort and carries no code, which is
// what both isOffline() and the outbox already treat as "the network, try later".
const READ_DEADLINE_MS = 12_000;
const WRITE_DEADLINE_MS = 40_000;
const fetchWithDeadline: typeof fetch = (input, init) => {
  const method = (init?.method ?? 'GET').toUpperCase();
  const deadline = method === 'GET' || method === 'HEAD' ? READ_DEADLINE_MS : WRITE_DEADLINE_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), deadline);
  // Honour a caller's own signal too, if one is ever passed.
  init?.signal?.addEventListener('abort', () => controller.abort());
  return fetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  global: { fetch: fetchWithDeadline },
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // no browser URL to parse a session out of on native
  },
});

// Supabase's auto-refresh runs on a plain setInterval, which React Native suspends while
// the app is backgrounded. Left unmanaged, the access token expires unnoticed and the
// next resume/reload refreshes with an already-rotated refresh token, which the server
// rejects -- the client then clears the stored session and the user lands back on the
// sign-in screen. Driving it from AppState (start on foreground, stop on background) is
// the supported native setup and is what keeps a signed-in session alive across reloads.
supabase.auth.startAutoRefresh();
AppState.addEventListener('change', (state) => {
  if (state === 'active') supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});
