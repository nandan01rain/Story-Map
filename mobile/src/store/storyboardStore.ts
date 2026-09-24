import { create } from 'zustand';

import { uuid } from '../lib/outbox';
import { supabase } from '../lib/supabase';
import { positionBetween } from './treatmentStore';

// The storyboard: per book, a chain of events and the threads strung through them. See
// supabase/migrations/20260924_storyboard.sql for what each table is and is not.
//
// Direct to the server like progressions -- no outbox yet. Writes are applied locally first
// and rolled back if the server refuses, so a drag or a tap never waits on the network.
// `supported` goes false when the tables are missing (migration not run), and the screen
// says so instead of failing quietly.

export type StoryEvent = {
  id: string;
  project_id: string;
  book: number;
  position: number;
  title: string;
  summary: string;
  chapter_id: string | null;
};

export type StoryThread = {
  id: string;
  project_id: string;
  book: number;
  name: string;
  color: string;
  position: number;
};

export type StoryLink = {
  id: string;
  project_id: string;
  thread_id: string;
  event_id: string;
};

/** Swatches that read on both the day parchment and the night blue. */
export const THREAD_COLORS = ['#c69a3a', '#3f9b8a', '#c0583c', '#6f86d6', '#a266bf', '#6aa84f', '#d0708c', '#8a7a5c'];

// 42P01 from Postgres; PGRST205 is PostgREST's "not in the schema cache", which newer
// versions answer with instead of passing the Postgres error through.
function isMissingTable(code: string | undefined): boolean {
  return code === '42P01' || code === 'PGRST205';
}

type Result = { error: string | null };

type StoryboardState = {
  projectId: string | null;
  events: StoryEvent[];
  threads: StoryThread[];
  links: StoryLink[];
  loading: boolean;
  supported: boolean;
  error: string | null;
  fetch: (projectId: string) => Promise<void>;
  addEvent: (p: { projectId: string; userId: string; book: number; title: string; summary: string; chapterId: string | null }) => Promise<{ event: StoryEvent | null; error: string | null }>;
  updateEvent: (id: string, patch: Partial<Pick<StoryEvent, 'title' | 'summary' | 'chapter_id' | 'position'>>) => Promise<Result>;
  removeEvent: (id: string) => Promise<Result>;
  addThread: (p: { projectId: string; userId: string; book: number; name: string }) => Promise<{ thread: StoryThread | null; error: string | null }>;
  updateThread: (id: string, patch: Partial<Pick<StoryThread, 'name' | 'color'>>) => Promise<Result>;
  removeThread: (id: string) => Promise<Result>;
  /** Strings the event onto the thread, or takes it off if it is already there. */
  toggleLink: (p: { projectId: string; userId: string; threadId: string; eventId: string }) => Promise<Result>;
};

const byPosition = (a: { position: number }, b: { position: number }) => Number(a.position) - Number(b.position);

export const useStoryboardStore = create<StoryboardState>((set, get) => ({
  projectId: null,
  events: [],
  threads: [],
  links: [],
  loading: false,
  supported: true,
  error: null,

  fetch: async (projectId) => {
    // A different project's board must never flash under this one's name.
    if (get().projectId !== projectId) set({ projectId, events: [], threads: [], links: [] });
    set({ loading: true, error: null });
    const [e, t, l] = await Promise.all([
      supabase.from('storyboard_events').select('id, project_id, book, position, title, summary, chapter_id').eq('project_id', projectId),
      supabase.from('storyboard_threads').select('id, project_id, book, name, color, position').eq('project_id', projectId),
      supabase.from('storyboard_links').select('id, project_id, thread_id, event_id').eq('project_id', projectId),
    ]);
    const failed = e.error ?? t.error ?? l.error;
    if (failed) {
      const missing = isMissingTable(failed.code);
      set({ loading: false, supported: !missing, error: missing ? null : failed.message });
      return;
    }
    if (get().projectId !== projectId) return;
    set({
      loading: false,
      supported: true,
      events: ((e.data ?? []) as StoryEvent[]).map((x) => ({ ...x, position: Number(x.position) })).sort(byPosition),
      threads: ((t.data ?? []) as StoryThread[]).map((x) => ({ ...x, position: Number(x.position) })).sort(byPosition),
      links: (l.data ?? []) as StoryLink[],
    });
  },

  addEvent: async ({ projectId, userId, book, title, summary, chapterId }) => {
    const inBook = get().events.filter((x) => x.book === book);
    const last = inBook.length ? inBook[inBook.length - 1].position : null;
    const event: StoryEvent = {
      id: uuid(),
      project_id: projectId,
      book,
      position: positionBetween(last, null),
      title,
      summary,
      chapter_id: chapterId,
    };
    set({ events: [...get().events, event].sort(byPosition) });
    const { error } = await supabase.from('storyboard_events').insert({ ...event, user_id: userId });
    if (error) {
      set({ events: get().events.filter((x) => x.id !== event.id) });
      return { event: null, error: error.message };
    }
    return { event, error: null };
  },

  updateEvent: async (id, patch) => {
    const before = get().events;
    set({ events: before.map((x) => (x.id === id ? { ...x, ...patch } : x)).sort(byPosition) });
    const { error } = await supabase
      .from('storyboard_events')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) {
      set({ events: before });
      return { error: error.message };
    }
    return { error: null };
  },

  // Deletes the event outright; the screen trashes it first (trashStore) so it can come back.
  removeEvent: async (id) => {
    const { events, links } = get();
    set({ events: events.filter((x) => x.id !== id), links: links.filter((k) => k.event_id !== id) });
    const { error } = await supabase.from('storyboard_events').delete().eq('id', id);
    if (error) {
      set({ events, links });
      return { error: error.message };
    }
    return { error: null };
  },

  addThread: async ({ projectId, userId, book, name }) => {
    const inBook = get().threads.filter((x) => x.book === book);
    const used = new Set(inBook.map((x) => x.color));
    const thread: StoryThread = {
      id: uuid(),
      project_id: projectId,
      book,
      name,
      color: THREAD_COLORS.find((c) => !used.has(c)) ?? THREAD_COLORS[inBook.length % THREAD_COLORS.length],
      position: positionBetween(inBook.length ? inBook[inBook.length - 1].position : null, null),
    };
    set({ threads: [...get().threads, thread].sort(byPosition) });
    const { error } = await supabase.from('storyboard_threads').insert({ ...thread, user_id: userId });
    if (error) {
      set({ threads: get().threads.filter((x) => x.id !== thread.id) });
      return { thread: null, error: error.message };
    }
    return { thread, error: null };
  },

  updateThread: async (id, patch) => {
    const before = get().threads;
    set({ threads: before.map((x) => (x.id === id ? { ...x, ...patch } : x)) });
    const { error } = await supabase
      .from('storyboard_threads')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) {
      set({ threads: before });
      return { error: error.message };
    }
    return { error: null };
  },

  // A thread is a grouping, not content: removing it unstrings its events and leaves every
  // event exactly where it was.
  removeThread: async (id) => {
    const { threads, links } = get();
    set({ threads: threads.filter((x) => x.id !== id), links: links.filter((k) => k.thread_id !== id) });
    const { error } = await supabase.from('storyboard_threads').delete().eq('id', id);
    if (error) {
      set({ threads, links });
      return { error: error.message };
    }
    return { error: null };
  },

  toggleLink: async ({ projectId, userId, threadId, eventId }) => {
    const links = get().links;
    const existing = links.find((k) => k.thread_id === threadId && k.event_id === eventId);
    if (existing) {
      set({ links: links.filter((k) => k.id !== existing.id) });
      const { error } = await supabase.from('storyboard_links').delete().eq('id', existing.id);
      if (error) {
        set({ links: [...get().links, existing] });
        return { error: error.message };
      }
      return { error: null };
    }
    const link: StoryLink = { id: uuid(), project_id: projectId, thread_id: threadId, event_id: eventId };
    set({ links: [...links, link] });
    const { error } = await supabase.from('storyboard_links').insert({ ...link, user_id: userId });
    if (error) {
      set({ links: get().links.filter((k) => k.id !== link.id) });
      return { error: error.message };
    }
    return { error: null };
  },
}));
