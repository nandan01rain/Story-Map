import AsyncStorage from '@react-native-async-storage/async-storage';

// A last-known-good copy of whatever a store last fetched.
//
// The app has always been a thin client over Supabase: every screen read live, nothing was
// kept, so with no network every list was empty even once the app got past its own splash.
// This is the smallest thing that makes the non-AI features usable on a train.
//
// What it is NOT: an offline database. There is no query layer here and no merge. A store
// paints from the cache immediately, then replaces it wholesale when the network answers.
// That is honest for reading and deliberately insufficient for writing -- see the note on
// writes at the bottom of this file.

const PREFIX = 'storymap:cache:v1:';

export async function readCache<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    // A corrupt or unreadable cache must never be worse than no cache.
    return null;
  }
}

export async function writeCache<T>(key: string, value: T): Promise<void> {
  try {
    await AsyncStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // Out of space, or a value that will not serialise. Losing the cache costs a refetch;
    // throwing here would cost the fetch that just succeeded.
  }
}

/**
 * True when an error from PostgREST is the network being absent rather than the server
 * objecting to something. Supabase surfaces a fetch failure with no `code`, which is exactly
 * how it differs from a real database error like `42703` -- and the difference matters: a
 * missing table should surface, a missing train tunnel should not.
 */
export function isOffline(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code) return false;
  const m = (error.message || '').toLowerCase();
  return m.includes('network') || m.includes('fetch') || m.includes('timeout') || m === 'failed to fetch';
}

// ---------------------------------------------------------------------------------------
// WRITES ARE NOT CACHED, ON PURPOSE.
//
// It would be easy to let an edit succeed locally and sync later, and it would be wrong to do
// it casually: this app's first principle is that nothing the writer types is ever lost, and a
// queue that drops or double-applies is a worse failure than an edit that visibly refuses.
// Until there is a real outbox with idempotent replay, a save without a network must FAIL
// VISIBLY. Reading offline is safe; writing offline is a design problem, not a flag.
// ---------------------------------------------------------------------------------------
