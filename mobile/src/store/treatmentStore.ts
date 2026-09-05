import { create } from 'zustand';

import { isOffline, readCache, writeCache } from '../lib/offlineCache';
import { enqueue, flush, uuid } from '../lib/outbox';
import { supabase } from '../lib/supabase';
import { pushVersion, type PageVersion } from './pageStore';

// Treatments -- the layer between pages and chapters.
//
// A treatment is a prose description of ONE scene: everything that happens in it, at
// plot-summary granularity, with the dialogue unwritten. Pages are undated deposits with no
// position; chapters are finished prose. Roughly twenty scenes for Book One have lived in
// chat transcripts and patch documents because there was nowhere in the database to put a
// finished description of an unwritten scene.
//
// Deliberately NOT attached to Book/Act/Chapter, and nothing here may acquire a chapter_id.
// Scenes get written before anyone knows which chapter they belong to; ordering is saga-wide
// and pacing is a later problem. The braid and spine-layout.mjs are untouched by this file.
//
// Two kinds of "version", kept apart on purpose:
//   * a treatment_versions ROW is an authorial version -- a reading of the scene the writer
//     chose to keep. Several may be `live` at once, and that is a resting state, not a
//     conflict to resolve.
//   * `history` on that row is the autosave trail: the text that was about to be
//     overwritten, on the same ~3-minute cadence as pages. It never appears in the version
//     list.

export type TreatmentStatus = 'live' | 'stale';

export type TreatmentVersion = {
  id: string;
  treatment_id: string;
  user_id: string;
  project_id: string;
  content: string;
  status: TreatmentStatus;
  history: PageVersion[];
  created_at: string;
  updated_at: string | null;
};

export type Treatment = {
  id: string;
  user_id: string;
  project_id: string;
  title: string | null;
  position: number;
  became_type: string | null;
  became_id: string | null;
  became_at: string | null;
  created_at: string;
  updated_at: string | null;
};

const TREATMENT_COLUMNS =
  'id, user_id, project_id, title, position, became_type, became_id, became_at, created_at, updated_at';
const VERSION_COLUMNS =
  'id, treatment_id, user_id, project_id, content, status, history, created_at, updated_at';

const UNDEFINED_COLUMN = '42703';
const UNDEFINED_TABLE = '42P01';

/** Sparse ordinals: a drag rewrites one row, not the whole list. */
const POSITION_GAP = 1000;

/** The first non-empty line, which is what the list shows when a treatment has no title. */
export function treatmentTitle(t: Treatment, live: TreatmentVersion | undefined): string {
  const named = (t.title || '').trim();
  if (named) return named;
  const first = (live?.content ?? '')
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l.length > 0);
  return first ?? '';
}

/**
 * A position strictly between two neighbours. numeric, not int, so there is always room --
 * a list dragged into a tight gap never needs a renumbering pass.
 */
export function positionBetween(before: number | null, after: number | null): number {
  if (before == null && after == null) return POSITION_GAP;
  if (before == null) return (after as number) - POSITION_GAP;
  if (after == null) return before + POSITION_GAP;
  return (before + after) / 2;
}

type TreatmentState = {
  treatments: Treatment[];
  versions: TreatmentVersion[];
  loading: boolean;
  error: string | null;
  /** True when 20260830b/c have not been run. The surface says so once, and does not throw. */
  missingSchema: boolean;
  fetchTreatments: (projectId: string) => Promise<void>;
  createTreatment: (
    userId: string,
    projectId: string,
    content?: string,
  ) => Promise<{ treatment: Treatment | null; version: TreatmentVersion | null; error: string | null }>;
  saveVersion: (versionId: string, content: string) => Promise<{ error: string | null }>;
  setVersionStatus: (versionId: string, status: TreatmentStatus) => Promise<{ error: string | null }>;
  addVersion: (
    treatmentId: string,
    content?: string,
  ) => Promise<{ version: TreatmentVersion | null; error: string | null }>;
  setTitle: (treatmentId: string, title: string) => Promise<{ error: string | null }>;
  reorder: (treatmentId: string, position: number) => Promise<{ error: string | null }>;
  markBecame: (treatmentId: string, becameType: string, becameId: string) => Promise<{ error: string | null }>;
  versionsOf: (treatmentId: string) => TreatmentVersion[];
  liveVersion: (treatmentId: string) => TreatmentVersion | undefined;
};

export const useTreatmentStore = create<TreatmentState>((set, get) => ({
  treatments: [],
  versions: [],
  loading: false,
  error: null,
  missingSchema: false,

  fetchTreatments: async (projectId) => {
    set({ loading: true, error: null });
    if (get().treatments.length === 0) {
      const cached = await readCache<{ treatments: Treatment[]; versions: TreatmentVersion[] }>(
        'treatments:' + projectId,
      );
      if (cached) set({ treatments: cached.treatments, versions: cached.versions, loading: false });
    }
    const t = await supabase
      .from('treatments')
      .select(TREATMENT_COLUMNS)
      .eq('project_id', projectId)
      .order('position', { ascending: true });

    // The degraded path is live code, not a formality: this repo has a standing habit of
    // migrations written and not run, and a screen that throws is worse than one that
    // explains itself.
    if (t.error) {
      const missing = t.error.code === UNDEFINED_TABLE || t.error.code === UNDEFINED_COLUMN;
      // Offline is not a missing table: keep the cache and stay quiet.
      if (isOffline(t.error)) {
        set({ loading: false });
        return;
      }
      set({ loading: false, missingSchema: missing, error: missing ? null : t.error.message });
      return;
    }

    const v = await supabase
      .from('treatment_versions')
      .select(VERSION_COLUMNS)
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });
    if (v.error) {
      const missing = v.error.code === UNDEFINED_TABLE || v.error.code === UNDEFINED_COLUMN;
      set({ loading: false, missingSchema: missing, error: missing ? null : v.error.message });
      return;
    }

    const treatments = (t.data ?? []) as Treatment[];
    const versions = ((v.data ?? []) as TreatmentVersion[]).map((row) => ({
      ...row,
      history: row.history ?? [],
    }));
    set({ loading: false, missingSchema: false, treatments, versions });
    writeCache('treatments:' + projectId, { treatments, versions });
  },

  // Created on the first keystroke, not when a blank editor opens -- so an opened-and-
  // abandoned treatment leaves nothing behind and nothing ever needs cleaning up.
  // Two rows, both minted here. Order matters in the queue: the version references the
  // treatment, so the treatment is enqueued first and the outbox's ordering guarantee does
  // the rest -- a failure stops the run rather than sending the child on its own.
  createTreatment: async (userId, projectId, content = '') => {
    const last = get().treatments[get().treatments.length - 1];
    const position = last ? Number(last.position) + POSITION_GAP : POSITION_GAP;
    const now = new Date().toISOString();

    const treatment: Treatment = {
      id: uuid(), user_id: userId, project_id: projectId, title: null, position,
      became_type: null, became_id: null, became_at: null, created_at: now, updated_at: now,
    };
    const version: TreatmentVersion = {
      id: uuid(), treatment_id: treatment.id, user_id: userId, project_id: projectId,
      content, status: 'live', history: [], created_at: now, updated_at: now,
    };

    const treatments = [...get().treatments, treatment];
    const versions = [version, ...get().versions];
    set({ treatments, versions });
    writeCache('treatments:' + projectId, { treatments, versions });

    await enqueue({ table: 'treatments', kind: 'insert', row: {
      id: treatment.id, user_id: userId, project_id: projectId, position, created_at: now,
    } });
    await enqueue({ table: 'treatment_versions', kind: 'insert', row: {
      id: version.id, treatment_id: treatment.id, user_id: userId, project_id: projectId,
      content, status: 'live', history: [], created_at: now,
    } });
    void flush();
    return { treatment, version, error: null };
  },

  saveVersion: async (versionId, content) => {
    const current = get().versions.find((v) => v.id === versionId);
    if (!current || current.content === content) return { error: null };

    const history = pushVersion(current.history ?? [], current.content);
    const updatedAt = new Date().toISOString();
    const versions = get().versions.map((v) =>
      v.id === versionId ? { ...v, content, history, updated_at: updatedAt } : v,
    );
    set({ versions });
    writeCache('treatments:' + current.project_id, { treatments: get().treatments, versions });

    await enqueue({ table: 'treatment_versions', kind: 'update', row: {
      id: versionId, content, history, updated_at: updatedAt,
    } });
    void flush();
    return { error: null };
  },

  // A marker, never a deletion. A stale version stays in the table, stays searchable and
  // stays retrievable; only the default view stops showing it.
  setVersionStatus: async (versionId, status) => {
    const versions = get().versions.map((v) => (v.id === versionId ? { ...v, status } : v));
    set({ versions });
    const v = versions.find((x) => x.id === versionId);
    if (v) writeCache('treatments:' + v.project_id, { treatments: get().treatments, versions });
    await enqueue({ table: 'treatment_versions', kind: 'update', row: { id: versionId, status } });
    void flush();
    return { error: null };
  },

  addVersion: async (treatmentId, content = '') => {
    const t = get().treatments.find((x) => x.id === treatmentId);
    if (!t) return { version: null, error: 'No such treatment.' };
    const now = new Date().toISOString();
    const version: TreatmentVersion = {
      id: uuid(), treatment_id: treatmentId, user_id: t.user_id, project_id: t.project_id,
      content, status: 'live', history: [], created_at: now, updated_at: now,
    };
    const versions = [version, ...get().versions];
    set({ versions });
    writeCache('treatments:' + t.project_id, { treatments: get().treatments, versions });
    await enqueue({ table: 'treatment_versions', kind: 'insert', row: {
      id: version.id, treatment_id: treatmentId, user_id: t.user_id, project_id: t.project_id,
      content, status: 'live', history: [], created_at: now,
    } });
    void flush();
    return { version, error: null };
  },

  setTitle: async (treatmentId, title) => {
    const treatments = get().treatments.map((t) => (t.id === treatmentId ? { ...t, title } : t));
    set({ treatments });
    const t = treatments.find((x) => x.id === treatmentId);
    if (t) writeCache('treatments:' + t.project_id, { treatments, versions: get().versions });
    await enqueue({ table: 'treatments', kind: 'update', row: { id: treatmentId, title } });
    void flush();
    return { error: null };
  },

  reorder: async (treatmentId, position) => {
    const treatments = get()
      .treatments.map((t) => (t.id === treatmentId ? { ...t, position } : t))
      .sort((a, b) => Number(a.position) - Number(b.position));
    set({ treatments });
    const t = treatments.find((x) => x.id === treatmentId);
    if (t) writeCache('treatments:' + t.project_id, { treatments, versions: get().versions });
    await enqueue({ table: 'treatments', kind: 'update', row: { id: treatmentId, position } });
    void flush();
    return { error: null };
  },

  // Records where the words went. The treatment is untouched and stays in the list: the
  // chapter will be rewritten, and the treatment is the record of what it first described.
  markBecame: async (treatmentId, becameType, becameId) => {
    const becameAt = new Date().toISOString();
    const treatments = get().treatments.map((t) =>
      t.id === treatmentId ? { ...t, became_type: becameType, became_id: becameId, became_at: becameAt } : t,
    );
    set({ treatments });
    const t = treatments.find((x) => x.id === treatmentId);
    if (t) writeCache('treatments:' + t.project_id, { treatments, versions: get().versions });
    await enqueue({ table: 'treatments', kind: 'update', row: {
      id: treatmentId, became_type: becameType, became_id: becameId, became_at: becameAt,
    } });
    void flush();
    return { error: null };
  },

  versionsOf: (treatmentId) => get().versions.filter((v) => v.treatment_id === treatmentId),

  // The one shown in the editor. Newest live version; falls back to the newest of any status
  // so a treatment whose versions were all set aside still opens to something.
  liveVersion: (treatmentId) => {
    const mine = get().versions.filter((v) => v.treatment_id === treatmentId);
    return mine.find((v) => v.status === 'live') ?? mine[0];
  },
}));
