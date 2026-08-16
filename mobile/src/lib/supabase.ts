import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// Same hosted Supabase project as the existing PWA (supabase-config.js at the repo
// root) — this app reads/writes the exact same tables/rows, no backend changes needed.
// The anon key is the public client key, safe to ship in client code (same as the PWA).
const SUPABASE_URL = 'https://lqjhxogravonkfpmtxtm.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxxamh4b2dyYXZvbmtmcG10eHRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU5MTEyODUsImV4cCI6MjEwMTQ4NzI4NX0.i3DVWh2PGWidBKD7IzJP6qRBabcwl9eASsLlbGQ6QRs';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // no browser URL to parse a session out of on native
  },
});
