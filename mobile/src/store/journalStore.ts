import { File, Paths } from 'expo-file-system';
import { create } from 'zustand';

import { uuid } from '../lib/outbox';
import { positionBetween } from '../lib/sparseOrder';
import { supabase } from '../lib/supabase';
import { CHARACTER_BUCKET, useStoryboardStore } from './storyboardStore';

// The writing journal (2026-10-27): the writer's diary of making the saga. ONE journal for the
// account -- the same from the landing page and from inside every project. What a project needs
// from it is copied there (to its Pages); the journal page stays. Same rows as studio.html's
// Journal tab. A page is drawn and edited by journal/journal-kit.js in
// both apps -- here inside a WebView (lib/journalHtml.ts) -- so this store only loads, saves and
// stores pictures. Needs supabase/migrations/20261027_journal.sql.
//
// A SCANNED page is a photograph of a paper page, straightened and otherwise exactly as written:
// nothing is read off it or cleaned up, so mirror writing stays mirror writing.

export const JOURNAL_BUCKET = 'journal-images';

/** One thing on a page, in page units (600 x 840). The rest of its fields depend on `kind`. */
export type JournalItem = { id: string; kind: string; x: number; y: number; w: number; h: number; r?: number; z?: number; [k: string]: unknown };

export type JournalPage = {
  id: string;
  user_id: string;
  /** yyyy-mm-dd: the day the page is about, which the writer can change. */
  day: string;
  title: string;
  paper: string;
  /** A scanned page's picture in `journal-images`; null for a page made in the app. */
  scan_path: string | null;
  items: JournalItem[];
  position: number;
  /** Set aside rather than deleted: off the notebook, on a shelf of its own. */
  set_aside_at?: string | null;
  created_at?: string;
  updated_at?: string;
};

type Result = { error: string | null };

type JournalState = {
  userId: string | null;
  pages: JournalPage[];
  loading: boolean;
  /** The table is not there yet -- the migration has not been pasted. */
  missing: boolean;
  error: string | null;
  fetch: (userId: string) => Promise<void>;
  create: (p: { userId: string; fields?: Partial<JournalPage> }) => Promise<{ page: JournalPage | null; error: string | null }>;
  /** Changes the page in memory at once and writes it a moment later; repeated calls coalesce. */
  update: (id: string, patch: Partial<JournalPage>) => void;
  /** Writes anything still waiting. Called on leaving a page. */
  flush: () => Promise<Result>;
  /** On or off the shelf of pages set aside. Nothing in the journal is ever deleted. */
  setAside: (id: string, aside: boolean) => Promise<Result>;
  /** The page's words as a new page in a project's Pages; the journal page is untouched. */
  copyToProject: (p: { userId: string; projectId: string; text: string }) => Promise<Result>;
  /** A signed link to a picture in either private bucket. */
  urlFor: (bucket: string, path: string) => Promise<string | null>;
  /** Stores a picture (a file on the phone, or base64) and returns its path in the bucket. */
  upload: (p: { userId: string; uri?: string; base64?: string; ext: string; mimeType: string; prefix?: string }) => Promise<{ path: string | null; error: string | null }>;
  /** The writer's own uploaded pictures, newest first -- not the scans. */
  listUploads: (userId: string) => Promise<string[]>;
};

const byDay = (a: JournalPage, b: JournalPage) =>
  String(a.day).localeCompare(String(b.day)) || Number(a.position) - Number(b.position);

export const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const pending = new Map<string, Set<keyof JournalPage>>();
let timer: ReturnType<typeof setTimeout> | null = null;
const urlCache = new Map<string, { url: string; at: number }>();

function missingBucket(message: string) {
  return /bucket/i.test(message) ? 'The journal\'s picture store needs supabase/migrations/20261027_journal.sql pasted once.' : message;
}

export const useJournalStore = create<JournalState>((set, get) => ({
  userId: null,
  pages: [],
  loading: false,
  missing: false,
  error: null,

  fetch: async (userId) => {
    if (get().userId !== userId) set({ userId, pages: [] });
    set({ loading: true, error: null });
    const { data, error } = await supabase.from('journal_pages').select('*').eq('user_id', userId);
    if (error) {
      const missing = error.code === '42P01' || error.code === 'PGRST205';
      set({ loading: false, missing, error: missing ? null : error.message });
      return;
    }
    const pages = ((data ?? []) as JournalPage[])
      .map((p) => ({ ...p, items: Array.isArray(p.items) ? p.items : [], position: Number(p.position) }))
      .sort(byDay);
    set({ loading: false, missing: false, pages });
  },

  create: async ({ userId, fields }) => {
    const last = get().pages.filter((p) => !p.set_aside_at).pop();
    const page: JournalPage = {
      id: uuid(),
      user_id: userId,
      day: todayISO(),
      title: '',
      paper: last ? last.paper : 'lined',
      scan_path: null,
      items: [],
      position: positionBetween(last ? Number(last.position) : null, null),
      ...fields,
    };
    const { error } = await supabase.from('journal_pages').insert(page);
    if (error) return { page: null, error: error.message };
    set({ pages: [...get().pages, page].sort(byDay) });
    return { page, error: null };
  },

  update: (id, patch) => {
    set({ pages: get().pages.map((p) => (p.id === id ? { ...p, ...patch } : p)).sort(byDay) });
    const keys = pending.get(id) ?? new Set();
    (Object.keys(patch) as (keyof JournalPage)[]).forEach((k) => keys.add(k));
    pending.set(id, keys);
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void get().flush(), 700);
  },

  flush: async () => {
    if (timer) clearTimeout(timer);
    timer = null;
    let error: string | null = null;
    for (const [id, keys] of [...pending.entries()]) {
      pending.delete(id);
      const page = get().pages.find((p) => p.id === id);
      if (!page) continue;
      const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
      keys.forEach((k) => { row[k] = page[k]; });
      const res = await supabase.from('journal_pages').update(row).eq('id', id);
      if (res.error) {
        error = res.error.message;
        // Kept for the next try rather than lost.
        const again = pending.get(id) ?? new Set();
        keys.forEach((k) => again.add(k));
        pending.set(id, again);
      }
    }
    return { error };
  },

  setAside: async (id, aside) => {
    await get().flush();
    const at = aside ? new Date().toISOString() : null;
    const { error } = await supabase.from('journal_pages').update({ set_aside_at: at }).eq('id', id);
    if (error) return { error: error.message };
    set({ pages: get().pages.map((p) => (p.id === id ? { ...p, set_aside_at: at } : p)) });
    return { error: null };
  },

  copyToProject: async ({ userId, projectId, text }) => {
    const { error } = await supabase
      .from('sticky_notes')
      .insert({ id: uuid(), user_id: userId, project_id: projectId, content: text, rotation: 0 });
    return { error: error?.message ?? null };
  },

  urlFor: async (bucket, path) => {
    if (!path) return null;
    if (bucket === CHARACTER_BUCKET) return useStoryboardStore.getState().imageUrl(path);
    const key = bucket + ':' + path;
    const hit = urlCache.get(key);
    if (hit && Date.now() - hit.at < 50 * 60 * 1000) return hit.url;
    const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
    if (!data) return null;
    urlCache.set(key, { url: data.signedUrl, at: Date.now() });
    return data.signedUrl;
  },

  upload: async ({ userId, uri, base64, ext, mimeType, prefix = '' }) => {
    try {
      let body: Uint8Array;
      if (uri) {
        body = await new File(uri).bytes();
      } else {
        // No Blob from base64 in React Native: through a cache file, as restore does.
        const tmp = new File(Paths.cache, `journal-upload.${ext}`);
        if (tmp.exists) tmp.delete();
        tmp.create();
        tmp.write(base64 ?? '', { encoding: 'base64' });
        body = await tmp.bytes();
        tmp.delete();
      }
      const path = `${userId}/${prefix}${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
      const { error } = await supabase.storage.from(JOURNAL_BUCKET).upload(path, body, { contentType: mimeType });
      if (error) return { path: null, error: missingBucket(error.message) };
      return { path, error: null };
    } catch (e) {
      return { path: null, error: e instanceof Error ? e.message : 'Could not read the picture.' };
    }
  },

  listUploads: async (userId) => {
    const { data } = await supabase.storage
      .from(JOURNAL_BUCKET)
      .list(userId, { limit: 300, sortBy: { column: 'created_at', order: 'desc' } });
    return (data ?? [])
      .filter((f) => f.name && !f.name.startsWith('.') && !f.name.startsWith('scan-'))
      .map((f) => `${userId}/${f.name}`);
  },
}));
