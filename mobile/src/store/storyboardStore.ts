import { create } from 'zustand';

import { uuid } from '../lib/outbox';
import { supabase } from '../lib/supabase';
import { positionBetween } from '../lib/sparseOrder';

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
  /** Where the note hangs on the wall; null = never moved, laid out in book order. */
  x?: number | null;
  y?: number | null;
  /** The scene sketch this note summarises -- tapping the note opens it. */
  treatment_id?: string | null;
  /** Whose beat it is: the note wears that character's colour. */
  cast_id?: string | null;
};

/** A prominent character, for colouring notes on the wall. Per project, not per book. */
export type StoryCast = {
  id: string;
  project_id: string;
  name: string;
  color: string;
  position: number;
};

/** Sticky-note colours: pale, so handwriting stays readable on every one. */
export const CAST_COLORS = ['#f7c6d0', '#c8ecd9', '#c9dcf5', '#dccbf2', '#fbd3b0', '#b9e4e1', '#e3f0b5', '#f2d4ec'];
/** A note nobody's colour has been given to: a plain yellow sticky. */
export const NOTE_DEFAULT = '#fbe7a1';

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
// 42703 from Postgres, PGRST204 from PostgREST: a column this client asks for is not there.
function isMissingColumn(code: string | undefined): boolean {
  return code === '42703' || code === 'PGRST204';
}

const BASE_EVENT_COLUMNS = 'id, project_id, book, position, title, summary, chapter_id';
const WALL_EVENT_COLUMNS = `${BASE_EVENT_COLUMNS}, x, y, treatment_id, cast_id`;
const WALL_FIELDS = ['x', 'y', 'treatment_id', 'cast_id'] as const;

type Result = { error: string | null };

type StoryboardState = {
  projectId: string | null;
  events: StoryEvent[];
  threads: StoryThread[];
  links: StoryLink[];
  cast: StoryCast[];
  loading: boolean;
  supported: boolean;
  /**
   * False until 20261011b_storyboard_wall.sql has run: the wall still works, laid out in book
   * order, but positions, colours and scene links cannot be saved, and the screen says so.
   */
  wallSupported: boolean;
  error: string | null;
  fetch: (projectId: string) => Promise<void>;
  addEvent: (p: {
    projectId: string;
    userId: string;
    book: number;
    title: string;
    summary: string;
    chapterId: string | null;
    treatmentId?: string | null;
    castId?: string | null;
  }) => Promise<{ event: StoryEvent | null; error: string | null }>;
  updateEvent: (
    id: string,
    patch: Partial<Pick<StoryEvent, 'title' | 'summary' | 'chapter_id' | 'position' | 'x' | 'y' | 'treatment_id' | 'cast_id'>>,
  ) => Promise<Result>;
  /** When a sketch becomes a chapter, every note summarising it points at that chapter too. */
  followSketchToChapter: (treatmentId: string, chapterId: string) => Promise<void>;
  addCast: (p: { projectId: string; userId: string; name: string }) => Promise<{ member: StoryCast | null; error: string | null }>;
  updateCast: (id: string, patch: Partial<Pick<StoryCast, 'name' | 'color'>>) => Promise<Result>;
  removeCast: (id: string) => Promise<Result>;
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
  cast: [],
  loading: false,
  supported: true,
  wallSupported: true,
  error: null,

  fetch: async (projectId) => {
    // A different project's board must never flash under this one's name.
    if (get().projectId !== projectId) set({ projectId, events: [], threads: [], links: [], cast: [] });
    set({ loading: true, error: null });
    const [first, t, l, c] = await Promise.all([
      supabase.from('storyboard_events').select(WALL_EVENT_COLUMNS).eq('project_id', projectId),
      supabase.from('storyboard_threads').select('id, project_id, book, name, color, position').eq('project_id', projectId),
      supabase.from('storyboard_links').select('id, project_id, thread_id, event_id').eq('project_id', projectId),
      supabase.from('storyboard_cast').select('id, project_id, name, color, position').eq('project_id', projectId),
    ]);
    // The wall's columns arrive with 20261011b; without them, read what the board had before.
    let e: { data: unknown[] | null; error: { code?: string; message: string } | null } = first;
    let wallSupported = !c.error;
    if (e.error && isMissingColumn(e.error.code)) {
      wallSupported = false;
      e = await supabase.from('storyboard_events').select(BASE_EVENT_COLUMNS).eq('project_id', projectId);
    }
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
      wallSupported,
      cast: ((c.data ?? []) as StoryCast[]).map((x) => ({ ...x, position: Number(x.position) })).sort(byPosition),
      events: ((e.data ?? []) as StoryEvent[])
        .map((x) => ({ ...x, position: Number(x.position), x: x.x == null ? null : Number(x.x), y: x.y == null ? null : Number(x.y) }))
        .sort(byPosition),
      threads: ((t.data ?? []) as StoryThread[]).map((x) => ({ ...x, position: Number(x.position) })).sort(byPosition),
      links: (l.data ?? []) as StoryLink[],
    });
  },

  addEvent: async ({ projectId, userId, book, title, summary, chapterId, treatmentId = null, castId = null }) => {
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
      ...(get().wallSupported ? { x: null, y: null, treatment_id: treatmentId, cast_id: castId } : {}),
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
    // Without the wall's columns, those fields cannot be written; drop them rather than fail
    // the whole update (a title edit must still save).
    if (!get().wallSupported) {
      const rest: Record<string, unknown> = { ...patch };
      for (const f of WALL_FIELDS) delete rest[f];
      if (Object.keys(rest).length === 0) return { error: null };
      patch = rest as typeof patch;
    }
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

  followSketchToChapter: async (treatmentId, chapterId) => {
    if (!get().wallSupported) return;
    const ids = get().events.filter((x) => x.treatment_id === treatmentId).map((x) => x.id);
    for (const id of ids) await get().updateEvent(id, { chapter_id: chapterId });
    // Also any note on a book not loaded here: the server knows them all.
    await supabase.from('storyboard_events').update({ chapter_id: chapterId }).eq('treatment_id', treatmentId);
  },

  addCast: async ({ projectId, userId, name }) => {
    const cast = get().cast;
    const used = new Set(cast.map((x) => x.color));
    const member: StoryCast = {
      id: uuid(),
      project_id: projectId,
      name,
      color: CAST_COLORS.find((c) => !used.has(c)) ?? CAST_COLORS[cast.length % CAST_COLORS.length],
      position: positionBetween(cast.length ? cast[cast.length - 1].position : null, null),
    };
    set({ cast: [...cast, member] });
    const { error } = await supabase.from('storyboard_cast').insert({ ...member, user_id: userId });
    if (error) {
      set({ cast: get().cast.filter((x) => x.id !== member.id) });
      return { member: null, error: error.message };
    }
    return { member, error: null };
  },

  updateCast: async (id, patch) => {
    const before = get().cast;
    set({ cast: before.map((x) => (x.id === id ? { ...x, ...patch } : x)) });
    const { error } = await supabase.from('storyboard_cast').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) {
      set({ cast: before });
      return { error: error.message };
    }
    return { error: null };
  },

  // Removing a character un-colours their notes (on delete set null) and moves nothing.
  removeCast: async (id) => {
    const { cast, events } = get();
    set({ cast: cast.filter((x) => x.id !== id), events: events.map((e) => (e.cast_id === id ? { ...e, cast_id: null } : e)) });
    const { error } = await supabase.from('storyboard_cast').delete().eq('id', id);
    if (error) {
      set({ cast, events });
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
