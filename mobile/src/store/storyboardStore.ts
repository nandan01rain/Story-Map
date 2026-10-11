import { File } from 'expo-file-system';
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
  /** Every character involved in the scene (20261011c). */
  character_ids?: string[];
};

/** A prominent character, for colouring notes on the wall. Per project, not per book. */
export type StoryCast = {
  id: string;
  project_id: string;
  name: string;
  color: string;
  position: number;
  /** The flashcard's few lines (20261011c). */
  description?: string;
  /** Storage path in the private `character-images` bucket, if a picture was added. */
  image_path?: string | null;
  /** The character bible this character is written up in. */
  document_id?: string | null;
  /** Infobox values, keyed by CharacterField id. */
  fields?: Record<string, string>;
};

/** One infobox row, defined for the whole project and shown on every character. */
export type CharacterField = { id: string; project_id: string; name: string; position: number };

/** Sticky-note colours: pale, so handwriting stays readable on every one. */
export const CAST_COLORS = [
  '#f7c6d0', '#c8ecd9', '#c9dcf5', '#dccbf2', '#fbd3b0', '#b9e4e1', '#e3f0b5', '#f2d4ec',
  '#ffd6a5', '#fdffb6', '#caffbf', '#9bf6ff', '#a0c4ff', '#bdb2ff', '#ffc6ff', '#e8d5c4',
  '#f4a7a7', '#a7d7c5', '#d4c1ec', '#f9e2ae', '#c2e0f4', '#e6c8a0', '#cfd8dc', '#ffe0e9',
];
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
const CHARACTER_EVENT_COLUMNS = `${WALL_EVENT_COLUMNS}, character_ids`;
const WALL_FIELDS = ['x', 'y', 'treatment_id', 'cast_id', 'character_ids'] as const;
const BASE_CAST_COLUMNS = 'id, project_id, name, color, position';
const CHARACTER_CAST_COLUMNS = `${BASE_CAST_COLUMNS}, description, image_path, document_id, fields`;
const CHARACTER_FIELDS = ['description', 'image_path', 'document_id', 'fields'] as const;
export const CHARACTER_BUCKET = 'character-images';

type Result = { error: string | null };

type StoryboardState = {
  projectId: string | null;
  events: StoryEvent[];
  threads: StoryThread[];
  links: StoryLink[];
  cast: StoryCast[];
  /** The infobox rows every character shows (20261011c). */
  characterFields: CharacterField[];
  loading: boolean;
  supported: boolean;
  /**
   * False until 20261011b_storyboard_wall.sql has run: the wall still works, laid out in book
   * order, but positions, colours and scene links cannot be saved, and the screen says so.
   */
  wallSupported: boolean;
  /** False until 20261011c_characters.sql has run: no descriptions, pictures or involvement. */
  charactersSupported: boolean;
  /** Signed links to character pictures, by storage path. Valid an hour; refetched after. */
  imageUrls: Record<string, string>;
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
    patch: Partial<Pick<StoryEvent, 'title' | 'summary' | 'chapter_id' | 'position' | 'x' | 'y' | 'treatment_id' | 'cast_id' | 'character_ids'>>,
  ) => Promise<Result>;
  /** When a sketch becomes a chapter, every note summarising it points at that chapter too. */
  followSketchToChapter: (treatmentId: string, chapterId: string) => Promise<void>;
  addCast: (p: { projectId: string; userId: string; name: string }) => Promise<{ member: StoryCast | null; error: string | null }>;
  updateCast: (id: string, patch: Partial<Pick<StoryCast, 'name' | 'color' | 'description' | 'image_path' | 'document_id' | 'fields'>>) => Promise<Result>;
  addCharacterField: (p: { projectId: string; userId: string; name: string }) => Promise<Result>;
  renameCharacterField: (id: string, name: string) => Promise<Result>;
  removeCharacterField: (id: string) => Promise<Result>;
  /** One character's value for one infobox row. */
  setFieldValue: (castId: string, fieldId: string, value: string) => Promise<Result>;
  /** A viewable link for a character's picture, signing (and caching) it when needed. */
  imageUrl: (path: string | null | undefined) => Promise<string | null>;
  /** Upload a picked picture for a character and point the character at it. */
  setCastImage: (p: { userId: string; castId: string; uri: string; mimeType: string; ext: string }) => Promise<Result>;
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
  characterFields: [],
  loading: false,
  supported: true,
  wallSupported: true,
  charactersSupported: true,
  imageUrls: {},
  error: null,

  fetch: async (projectId) => {
    // A different project's board must never flash under this one's name.
    if (get().projectId !== projectId) set({ projectId, events: [], threads: [], links: [], cast: [] });
    set({ loading: true, error: null });
    type Res = { data: unknown[] | null; error: { code?: string; message: string } | null };
    const [first, t, l, firstCast] = await Promise.all([
      supabase.from('storyboard_events').select(CHARACTER_EVENT_COLUMNS).eq('project_id', projectId),
      supabase.from('storyboard_threads').select('id, project_id, book, name, color, position').eq('project_id', projectId),
      supabase.from('storyboard_links').select('id, project_id, thread_id, event_id').eq('project_id', projectId),
      supabase.from('storyboard_cast').select(CHARACTER_CAST_COLUMNS).eq('project_id', projectId),
    ]);
    // Each migration adds columns; read the richest shape the database has. 20261011c gives
    // characters and involvement, 20261011b the wall; without either, what the board had before.
    let e: Res = first;
    let c: Res = firstCast;
    let charactersSupported = true;
    let wallSupported = true;
    if (e.error && isMissingColumn(e.error.code)) {
      charactersSupported = false;
      e = await supabase.from('storyboard_events').select(WALL_EVENT_COLUMNS).eq('project_id', projectId);
      if (e.error && isMissingColumn(e.error.code)) {
        wallSupported = false;
        e = await supabase.from('storyboard_events').select(BASE_EVENT_COLUMNS).eq('project_id', projectId);
      }
    }
    if (c.error && isMissingColumn(c.error.code)) {
      charactersSupported = false;
      c = await supabase.from('storyboard_cast').select(BASE_CAST_COLUMNS).eq('project_id', projectId);
    }
    if (c.error) wallSupported = false;
    const f = charactersSupported
      ? await supabase.from('character_fields').select('id, project_id, name, position').eq('project_id', projectId)
      : { data: [], error: null };
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
      charactersSupported,
      characterFields: ((f.data ?? []) as CharacterField[]).map((x) => ({ ...x, position: Number(x.position) })).sort(byPosition),
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
    if (!get().wallSupported || !get().charactersSupported) {
      const rest: Record<string, unknown> = { ...patch };
      if (!get().wallSupported) for (const f of WALL_FIELDS) delete rest[f];
      if (!get().charactersSupported) delete rest.character_ids;
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
    if (!get().charactersSupported) {
      const rest: Record<string, unknown> = { ...patch };
      for (const f of CHARACTER_FIELDS) delete rest[f];
      if (Object.keys(rest).length === 0) return { error: 'Paste supabase/migrations/20261011c_characters.sql first.' };
      patch = rest as typeof patch;
    }
    const before = get().cast;
    set({ cast: before.map((x) => (x.id === id ? { ...x, ...patch } : x)) });
    const { error } = await supabase.from('storyboard_cast').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) {
      set({ cast: before });
      return { error: error.message };
    }
    return { error: null };
  },

  addCharacterField: async ({ projectId, userId, name }) => {
    if (!get().charactersSupported) return { error: 'Paste supabase/migrations/20261011c_characters.sql first.' };
    const list = get().characterFields;
    const field: CharacterField = {
      id: uuid(),
      project_id: projectId,
      name,
      position: positionBetween(list.length ? list[list.length - 1].position : null, null),
    };
    set({ characterFields: [...list, field] });
    const { error } = await supabase.from('character_fields').insert({ ...field, user_id: userId });
    if (error) {
      set({ characterFields: get().characterFields.filter((x) => x.id !== field.id) });
      return { error: error.message };
    }
    return { error: null };
  },

  renameCharacterField: async (id, name) => {
    const before = get().characterFields;
    set({ characterFields: before.map((x) => (x.id === id ? { ...x, name } : x)) });
    const { error } = await supabase.from('character_fields').update({ name }).eq('id', id);
    if (error) {
      set({ characterFields: before });
      return { error: error.message };
    }
    return { error: null };
  },

  // The row goes from every character; values already written under it stay in each
  // character's `fields`, unused, so re-adding a field of the same purpose starts clean.
  removeCharacterField: async (id) => {
    const before = get().characterFields;
    set({ characterFields: before.filter((x) => x.id !== id) });
    const { error } = await supabase.from('character_fields').delete().eq('id', id);
    if (error) {
      set({ characterFields: before });
      return { error: error.message };
    }
    return { error: null };
  },

  setFieldValue: async (castId, fieldId, value) => {
    const member = get().cast.find((x) => x.id === castId);
    if (!member) return { error: 'No such character.' };
    return get().updateCast(castId, { fields: { ...(member.fields ?? {}), [fieldId]: value } });
  },

  imageUrl: async (path) => {
    if (!path) return null;
    const cached = get().imageUrls[path];
    if (cached) return cached;
    const { data, error } = await supabase.storage.from(CHARACTER_BUCKET).createSignedUrl(path, 3600);
    if (error || !data) return null;
    set({ imageUrls: { ...get().imageUrls, [path]: data.signedUrl } });
    // Signed links expire; forget this one before it does so the next look signs afresh.
    setTimeout(() => {
      const { [path]: _gone, ...rest } = get().imageUrls;
      set({ imageUrls: rest });
    }, 50 * 60 * 1000);
    return data.signedUrl;
  },

  setCastImage: async ({ userId, castId, uri, mimeType, ext }) => {
    if (!get().charactersSupported) return { error: 'Paste supabase/migrations/20261011c_characters.sql first.' };
    try {
      // Read through expo-file-system rather than fetch(): React Native's fetch of a local file
      // has not reliably produced bytes, and this module ships in every build.
      const body = await new File(uri).bytes();
      // A fresh name per upload, so a cached link to the old picture can never show stale.
      const path = `${userId}/${castId}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from(CHARACTER_BUCKET).upload(path, body, { contentType: mimeType, upsert: true });
      if (error) return { error: error.message };
      const old = get().cast.find((x) => x.id === castId)?.image_path;
      const res = await get().updateCast(castId, { image_path: path });
      if (!res.error && old) void supabase.storage.from(CHARACTER_BUCKET).remove([old]);
      return res;
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Could not read that picture.' };
    }
  },

  // Removing a character un-colours their notes (on delete set null) and moves nothing.
  removeCast: async (id) => {
    const { cast, events } = get();
    set({
      cast: cast.filter((x) => x.id !== id),
      events: events.map((e) => ({
        ...e,
        cast_id: e.cast_id === id ? null : e.cast_id,
        character_ids: (e.character_ids ?? []).filter((c) => c !== id),
      })),
    });
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
