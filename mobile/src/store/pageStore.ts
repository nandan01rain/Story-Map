import { create } from 'zustand';

import { supabase } from '../lib/supabase';

// Pages -- stage-one raw capture. Same `sticky_notes` table the PWA and this app's old
// Margin board have always used (handoff §4), widened by 20260826_pages.sql. A page IS a
// sticky note that got long: text the writer deposited without first deciding what it was.
//
// The rule this file exists to enforce: NOTHING HERE DELETES OR CONSUMES A PAGE. Promotion
// copies. Status is a marker. An edit snapshots the text it is about to overwrite. The
// interface above this is meant to feel casual and disposable; the storage underneath it
// must never actually be.

/**
 * A hint, never a gate. Null is the expected case -- the writer is never prompted for this
 * and nothing may block on it. It exists so that a classification made later can override
 * whatever stage two would otherwise infer.
 */
export const PAGE_TYPES = ['prose', 'note', 'reference', 'canon', 'filler'] as const;
export type PageType = (typeof PAGE_TYPES)[number];

/** A marker, never a location. `reviewed` hides nothing by itself. */
export type PageStatus = 'raw' | 'reviewed';

export type PageVersion = { savedAt: string; content: string };

export type Page = {
  id: string;
  user_id: string;
  project_id: string;
  content: string;
  created_at: string;
  updated_at: string | null;
  rotation: number;
  type: PageType | null;
  status: PageStatus;
  versions: PageVersion[];
  became_type: string | null;
  became_id: string | null;
  became_at: string | null;
};

const BASE_COLUMNS = 'id, user_id, project_id, content, created_at, rotation';
const PAGE_COLUMNS = `${BASE_COLUMNS}, type, status, updated_at, versions, became_type, became_id, became_at`;

// Postgres "column does not exist". The repo has a standing habit of migrations written and
// not run (CLAUDE.md lists several), and a writer who cannot reach a month of drafted pages
// because a SQL file is sitting unapplied is exactly the loss this build exists to prevent.
// So: try the full shape, fall back to the shape that has always existed, and say so.
const UNDEFINED_COLUMN = '42703';

/** Fills in the page fields for a row read back from a pre-migration table. */
function asPage(row: Record<string, unknown>): Page {
  const defaults = {
    rotation: 0,
    type: null,
    status: 'raw' as PageStatus,
    updated_at: null,
    became_type: null,
    became_id: null,
    became_at: null,
  };
  return { ...defaults, ...row, versions: (row.versions as PageVersion[] | null) ?? [] } as Page;
}

/**
 * Snapshot the text about to be overwritten -- but not once per autosave tick, which would
 * be one snapshot every 800ms of typing and no history worth reading.
 *
 * Two rules. A snapshot is taken only if the last one is at least SNAPSHOT_INTERVAL_MS old,
 * so a long writing run leaves a trail rather than a flood. And when the list is full the
 * OLDEST IS NEVER DROPPED -- the first thing the page ever said is the version most worth
 * having -- so the discard comes from the middle instead.
 */
const SNAPSHOT_INTERVAL_MS = 3 * 60 * 1000;
const MAX_VERSIONS = 20;

export function pushVersion(versions: PageVersion[], previousContent: string): PageVersion[] {
  if (!previousContent.trim()) return versions;
  if (versions[0]?.content === previousContent) return versions;
  const lastAt = versions[0] ? Date.parse(versions[0].savedAt) : 0;
  if (Date.now() - lastAt < SNAPSHOT_INTERVAL_MS) return versions;

  const next = [{ savedAt: new Date().toISOString(), content: previousContent }, ...versions];
  if (next.length <= MAX_VERSIONS) return next;
  // Keep the newest MAX_VERSIONS-1 and the original; drop the second-oldest.
  return [...next.slice(0, MAX_VERSIONS - 1), next[next.length - 1]];
}

/** The first non-empty line, which is all the list and search ever show as a page's name. */
export function pageTitle(page: Pick<Page, 'content'>): string {
  const first = (page.content ?? '')
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l.length > 0);
  return first ?? '';
}

type PageState = {
  pages: Page[];
  loading: boolean;
  error: string | null;
  /** True when the live table predates 20260826_pages.sql. Content still saves; extras don't. */
  legacySchema: boolean;
  fetchPages: (projectId: string) => Promise<void>;
  createPage: (userId: string, projectId: string, content?: string) => Promise<{ page: Page | null; error: string | null }>;
  savePage: (pageId: string, content: string) => Promise<{ error: string | null }>;
  setType: (pageId: string, type: PageType | null) => Promise<{ error: string | null }>;
  setStatus: (pageId: string, status: PageStatus) => Promise<{ error: string | null }>;
  markBecame: (pageId: string, becameType: string, becameId: string) => Promise<{ error: string | null }>;
};

export const usePageStore = create<PageState>((set, get) => ({
  pages: [],
  loading: false,
  error: null,
  legacySchema: false,

  fetchPages: async (projectId) => {
    set({ loading: true, error: null });
    const full = await supabase
      .from('sticky_notes')
      .select(PAGE_COLUMNS)
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (full.error && full.error.code === UNDEFINED_COLUMN) {
      const base = await supabase
        .from('sticky_notes')
        .select(BASE_COLUMNS)
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });
      if (base.error) {
        set({ loading: false, error: base.error.message });
        return;
      }
      set({ loading: false, legacySchema: true, pages: (base.data ?? []).map(asPage) });
      return;
    }
    if (full.error) {
      set({ loading: false, error: full.error.message });
      return;
    }
    set({ loading: false, legacySchema: false, pages: (full.data ?? []).map(asPage) });
  },

  // A row is created on the first keystroke, not when the blank page opens -- so an opened-
  // and-abandoned page leaves nothing behind, and nothing ever has to be cleaned up later.
  // That is the only way "never delete a page" and "no empty clutter" hold at the same time.
  createPage: async (userId, projectId, content = '') => {
    const legacy = get().legacySchema;
    // rotation is the old Margin board's per-card tilt. Kept because the PWA still draws
    // notes as tilted cards and a row created here has to look right over there too.
    const rotation = Math.round((Math.random() * 6 - 3) * 10) / 10;
    const row: Record<string, unknown> = { user_id: userId, project_id: projectId, content, rotation };
    if (!legacy) {
      row.status = 'raw';
      row.versions = [];
      row.updated_at = new Date().toISOString();
    }
    const { data, error } = await supabase
      .from('sticky_notes')
      .insert(row)
      .select(legacy ? BASE_COLUMNS : PAGE_COLUMNS)
      .single();
    if (error) return { page: null, error: error.message };
    // The select list is chosen at runtime, which defeats supabase-js's select-string types.
    const page = asPage(data as unknown as Record<string, unknown>);
    set({ pages: [page, ...get().pages] });
    return { page, error: null };
  },

  savePage: async (pageId, content) => {
    const current = get().pages.find((p) => p.id === pageId);
    if (!current || current.content === content) return { error: null };

    const legacy = get().legacySchema;
    const versions = legacy ? current.versions : pushVersion(current.versions, current.content);
    const updatedAt = new Date().toISOString();
    const patch: Record<string, unknown> = legacy
      ? { content }
      : { content, versions, updated_at: updatedAt };

    const { error } = await supabase.from('sticky_notes').update(patch).eq('id', pageId);
    if (error) return { error: error.message };
    set({
      pages: get().pages.map((p) =>
        p.id === pageId ? { ...p, content, versions, updated_at: legacy ? p.updated_at : updatedAt } : p,
      ),
    });
    return { error: null };
  },

  setType: async (pageId, type) => {
    if (get().legacySchema) return { error: 'Run 20260826_pages.sql first.' };
    const { error } = await supabase.from('sticky_notes').update({ type }).eq('id', pageId);
    if (error) return { error: error.message };
    set({ pages: get().pages.map((p) => (p.id === pageId ? { ...p, type } : p)) });
    return { error: null };
  },

  setStatus: async (pageId, status) => {
    if (get().legacySchema) return { error: 'Run 20260826_pages.sql first.' };
    const { error } = await supabase.from('sticky_notes').update({ status }).eq('id', pageId);
    if (error) return { error: error.message };
    set({ pages: get().pages.map((p) => (p.id === pageId ? { ...p, status } : p)) });
    return { error: null };
  },

  // Records where a page went. It does NOT move, empty or flag the page as spent: the
  // original text stays exactly as written and stays in the list, because the chapter it
  // became will be edited and the page is the record of what it first said.
  markBecame: async (pageId, becameType, becameId) => {
    if (get().legacySchema) return { error: null };
    const becameAt = new Date().toISOString();
    const { error } = await supabase
      .from('sticky_notes')
      .update({ became_type: becameType, became_id: becameId, became_at: becameAt })
      .eq('id', pageId);
    if (error) return { error: error.message };
    set({
      pages: get().pages.map((p) =>
        p.id === pageId ? { ...p, became_type: becameType, became_id: becameId, became_at: becameAt } : p,
      ),
    });
    return { error: null };
  },
}));
