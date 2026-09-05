import { create } from 'zustand';

import { isOffline, readCache, writeCache } from '../lib/offlineCache';
import { enqueue, flush, uuid } from '../lib/outbox';
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
    if (get().pages.length === 0) {
      const cached = await readCache<Page[]>('pages:' + projectId);
      if (cached) set({ pages: cached, loading: false });
    }
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
      set({ loading: false, error: isOffline(full.error) ? null : full.error.message });
      return;
    }
    // A fetch must not overwrite a page that is still waiting to be sent: the server's copy
    // is older than the one in hand, and replacing it would undo work that has not synced.
    const rows = (full.data ?? []).map(asPage);
    const local = new Map(get().pages.map((p) => [p.id, p]));
    const merged = rows.map((r) => {
      const mine = local.get(r.id);
      if (!mine) return r;
      const mineAt = Date.parse(mine.updated_at ?? mine.created_at);
      const theirs = Date.parse(r.updated_at ?? r.created_at);
      return mineAt > theirs ? mine : r;
    });
    // Anything local the server has never seen -- created in the air -- is kept.
    const seen = new Set(rows.map((r) => r.id));
    const unsent = get().pages.filter((p) => !seen.has(p.id));
    const pages = [...unsent, ...merged];
    set({ loading: false, legacySchema: false, pages });
    writeCache('pages:' + projectId, pages);
  },

  // A row is created on the first keystroke, not when the blank page opens -- so an opened-
  // and-abandoned page leaves nothing behind, and nothing ever has to be cleaned up later.
  // That is the only way "never delete a page" and "no empty clutter" hold at the same time.
  //
  // LOCAL FIRST. The id is minted here rather than by Postgres, which is what makes writing
  // on a plane possible at all: the page exists, has an identity, and can be edited and
  // reopened immediately, with the server told whenever there is a server to tell. Nothing
  // here awaits the network, so nothing here can be slowed or refused by its absence.
  createPage: async (userId, projectId, content = '') => {
    const legacy = get().legacySchema;
    // rotation is the old Margin board's per-card tilt. Kept because the PWA still draws
    // notes as tilted cards and a row created here has to look right over there too.
    const rotation = Math.round((Math.random() * 6 - 3) * 10) / 10;
    const now = new Date().toISOString();

    const page: Page = {
      id: uuid(),
      user_id: userId,
      project_id: projectId,
      content,
      created_at: now,
      updated_at: now,
      rotation,
      type: null,
      status: 'raw',
      versions: [],
      became_type: null,
      became_id: null,
      became_at: null,
    };

    const pages = [page, ...get().pages];
    set({ pages });
    writeCache('pages:' + projectId, pages);

    const row: Record<string, unknown> = {
      id: page.id, user_id: userId, project_id: projectId, content, rotation, created_at: now,
    };
    if (!legacy) {
      row.status = 'raw';
      row.versions = [];
      row.updated_at = now;
    }
    await enqueue({ table: 'sticky_notes', kind: 'insert', row: row as { id: string } });
    void flush();
    return { page, error: null };
  },

  // Autosave, and therefore the hottest path in the app. It touches local state and the
  // cache synchronously and queues the write; the outbox coalesces repeated edits to one
  // pending op per page, so six hours of typing is one write to send, not thousands.
  savePage: async (pageId, content) => {
    const current = get().pages.find((p) => p.id === pageId);
    if (!current || current.content === content) return { error: null };

    const legacy = get().legacySchema;
    const versions = legacy ? current.versions : pushVersion(current.versions, current.content);
    const updatedAt = new Date().toISOString();

    const pages = get().pages.map((p) =>
      p.id === pageId ? { ...p, content, versions, updated_at: legacy ? p.updated_at : updatedAt } : p,
    );
    set({ pages });
    const projectId = current.project_id;
    writeCache('pages:' + projectId, pages);

    const patch: Record<string, unknown> = legacy
      ? { id: pageId, content }
      : { id: pageId, content, versions, updated_at: updatedAt };
    await enqueue({ table: 'sticky_notes', kind: 'update', row: patch as { id: string } });
    void flush();
    return { error: null };
  },

  setType: async (pageId, type) => {
    if (get().legacySchema) return { error: 'Run 20260826_pages.sql first.' };
    const pages = get().pages.map((p) => (p.id === pageId ? { ...p, type } : p));
    set({ pages });
    const page = pages.find((p) => p.id === pageId);
    if (page) writeCache('pages:' + page.project_id, pages);
    await enqueue({ table: 'sticky_notes', kind: 'update', row: { id: pageId, type } });
    void flush();
    return { error: null };
  },

  setStatus: async (pageId, status) => {
    if (get().legacySchema) return { error: 'Run 20260826_pages.sql first.' };
    const pages = get().pages.map((p) => (p.id === pageId ? { ...p, status } : p));
    set({ pages });
    const page = pages.find((p) => p.id === pageId);
    if (page) writeCache('pages:' + page.project_id, pages);
    await enqueue({ table: 'sticky_notes', kind: 'update', row: { id: pageId, status } });
    void flush();
    return { error: null };
  },

  // Records where a page went. It does NOT move, empty or flag the page as spent: the
  // original text stays exactly as written and stays in the list, because the chapter it
  // became will be edited and the page is the record of what it first said.
  markBecame: async (pageId, becameType, becameId) => {
    if (get().legacySchema) return { error: null };
    const becameAt = new Date().toISOString();
    const pages = get().pages.map((p) =>
      p.id === pageId ? { ...p, became_type: becameType, became_id: becameId, became_at: becameAt } : p,
    );
    set({ pages });
    const page = pages.find((p) => p.id === pageId);
    if (page) writeCache('pages:' + page.project_id, pages);
    await enqueue({
      table: 'sticky_notes',
      kind: 'update',
      row: { id: pageId, became_type: becameType, became_id: becameId, became_at: becameAt },
    });
    void flush();
    return { error: null };
  },
}));
