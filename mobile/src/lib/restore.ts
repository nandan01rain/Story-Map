import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import { Alert } from 'react-native';

import { uuid } from './outbox';
import { supabase } from './supabase';
import { type Snapshot, pictureType, withoutGenerated } from './backup';
import { useProjectStore } from '../store/projectStore';
import { CHARACTER_BUCKET } from '../store/storyboardStore';

// Reading a backup back in. The half that makes the other half a plan rather than a hope.
//
// RESTORE IS ADDITIVE AND IDEMPOTENT, and never deletes. Every row keeps the id it had, so
// the whole thing is an upsert on the primary key: run it twice and the second run changes
// nothing; run it against a project that still half exists and the rows that survived are
// overwritten with the backup's copy rather than duplicated. Nothing in here removes a row
// that the backup does not contain -- a restore that deleted would turn a stale backup into
// data loss, which is the exact failure it exists to prevent.
//
// INTO A NEW PROJECT BY DEFAULT. Restoring over a live project is the dangerous shape, so
// the caller passes the destination explicitly: a new project row is minted and every
// foreign key rewritten to it, OR an existing project id is named and the rows go there.
//
// IDS ARE KEPT ONLY WHEN RESTORING A PROJECT INTO ITSELF; anywhere else every row gets a fresh
// id (2026-10-12). This file used to keep them in every case, on the reasoning that uuids do
// not collide -- but they do whenever the original project still exists, and an upsert on the
// primary key then UPDATES the original's row and re-points it at the new project: restoring a
// backup of a living project would have quietly emptied it into "(restored)". Fresh ids are
// written through every reference by value (see `remap`), so annotations, scene parents,
// progressions, graph rows, character colours and trash payloads still resolve.
//
// Order matters: parents before children, because the foreign keys are real.

export type RestoreReport = {
  project: string;
  counts: Record<string, number>;
  skipped: { table: string; reason: string }[];
};

export async function pickSnapshot(): Promise<{ snapshot: Snapshot | null; error: string | null }> {
  const res = await DocumentPicker.getDocumentAsync({ type: ['application/json', '*/*'], copyToCacheDirectory: true });
  if (res.canceled || !res.assets?.[0]) return { snapshot: null, error: null };
  try {
    const text = await new File(res.assets[0].uri).text();
    const parsed = JSON.parse(text) as Snapshot;
    if (!parsed || !Array.isArray(parsed.chapters)) {
      return { snapshot: null, error: "That file isn't a StoryMap backup." };
    }
    return { snapshot: parsed, error: null };
  } catch (e) {
    return { snapshot: null, error: e instanceof Error ? e.message : 'Could not read that file.' };
  }
}

/** A one-line description of what a file holds, for confirming before writing anything. */
export function describeSnapshot(s: Snapshot): string {
  const name = (s.project as { name?: string } | undefined)?.name ?? 'a project';
  const when = s.exportedAt ? new Date(s.exportedAt).toLocaleString() : 'an unknown date';
  const bits = [
    `${s.chapters?.length ?? 0} chapters`,
    `${s.documents?.length ?? 0} documents`,
    `${s.pages?.length ?? 0} pages`,
    `${s.treatments?.length ?? 0} treatments`,
    `${s.storyboardEvents?.length ?? 0} storyboard events`,
    `${s.characterImages?.length ?? 0} character pictures`,
  ];
  const warn = s.incomplete?.length ? ` Incomplete when saved: ${s.incomplete.join(', ')}.` : '';
  return `${name}, saved ${when}. ${bits.join(', ')}.${warn}`;
}

type Row = Record<string, unknown>;

/** Re-point a row at the destination project and owner, keeping its own id. */
function retarget(row: Row, projectId: string, userId: string): Row {
  // Older snapshots carry the generated `search` column, which Postgres will not accept.
  const next: Row = { ...withoutGenerated(row), project_id: projectId };
  if ('user_id' in next) next.user_id = userId;
  return next;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Every table a snapshot carries, parents before children (the foreign keys are real). */
const TABLES: [table: string, key: keyof Snapshot][] = [
  ['chapters', 'chapters'],
  ['documents', 'documents'],
  ['scenes', 'scenes'],
  ['sticky_notes', 'pages'],
  ['treatments', 'treatments'],
  ['treatment_versions', 'treatmentVersions'],
  ['character_fields', 'characterFields'],
  ['storyboard_cast', 'storyboardCast'],
  ['storyboard_events', 'storyboardEvents'],
  // Threads and events before the links that join them.
  ['storyboard_threads', 'storyboardThreads'],
  ['storyboard_links', 'storyboardLinks'],
  ['graph_nodes', 'graphNodes'],
  ['graph_edges', 'graphEdges'],
  ['document_progressions', 'documentProgressions'],
  ['trash', 'trash'],
];

/** A fresh uuid for every row id in the snapshot, and the new project's for the old one's. */
function freshIds(snapshot: Snapshot, projectId: string): Map<string, string> {
  const ids = new Map<string, string>();
  const old = (snapshot.project as { id?: string } | undefined)?.id;
  if (old) ids.set(old, projectId);
  for (const [, key] of TABLES) {
    for (const row of (snapshot[key] as Row[] | undefined) ?? []) {
      const id = row?.id;
      if (typeof id === 'string' && UUID.test(id) && !ids.has(id)) ids.set(id, uuid());
    }
  }
  return ids;
}

/**
 * Swap every old id for its new one wherever it appears: a column, inside jsonb (annotations'
 * chapter links, a character's field values keyed by field id, a trashed row's payload), or in
 * an array (who is in a scene). Only a WHOLE string that is a known id is replaced, and they are
 * uuids, so nothing else can match by accident.
 */
function remap(value: unknown, ids: Map<string, string>): unknown {
  if (typeof value === 'string') return ids.get(value) ?? value;
  if (Array.isArray(value)) return value.map((v) => remap(v, ids));
  if (value && typeof value === 'object') {
    const out: Row = {};
    for (const [k, v] of Object.entries(value as Row)) out[ids.get(k) ?? k] = remap(v, ids);
    return out;
  }
  return value;
}

async function pictureExists(path: string): Promise<boolean> {
  const { error } = await supabase.storage.from(CHARACTER_BUCKET).createSignedUrl(path, 60);
  return !error;
}

/**
 * Put each character's picture back BEFORE the character rows are written, and point the row
 * at it. The bytes come from the backup when it carries them (share-sheet files since snapshot
 * version 4); otherwise the picture is copied inside Storage, which works while the original
 * still exists. One that cannot be had either way is dropped from the row and named in the
 * report rather than left pointing at nothing. Paths start with the writer's own id -- the
 * bucket's policy is by first folder.
 */
async function restorePictures(
  snapshot: Snapshot,
  castRows: Row[],
  ids: Map<string, string> | null,
  userId: string,
  report: RestoreReport,
): Promise<void> {
  const bytes = new Map((snapshot.characterImages ?? []).map((img) => [ids?.get(img.castId) ?? img.castId, img]));
  for (const row of castRows) {
    const oldPath = row.image_path;
    if (typeof oldPath !== 'string' || !oldPath) continue;
    if (!ids && oldPath.startsWith(`${userId}/`) && (await pictureExists(oldPath))) continue;

    const { ext, contentType } = pictureType(oldPath);
    const path = `${userId}/${row.id as string}-${Date.now()}.${ext}`;
    const img = bytes.get(row.id as string);
    let error: string | null = null;
    if (img) {
      try {
        const tmp = new File(Paths.cache, `restore-picture.${ext}`);
        if (tmp.exists) tmp.delete();
        tmp.create();
        tmp.write(img.base64, { encoding: 'base64' });
        const body = await tmp.bytes();
        tmp.delete();
        const res = await supabase.storage.from(CHARACTER_BUCKET).upload(path, body, { contentType, upsert: true });
        error = res.error?.message ?? null;
      } catch (e) {
        error = e instanceof Error ? e.message : 'Could not write the picture.';
      }
    } else {
      error = (await supabase.storage.from(CHARACTER_BUCKET).copy(oldPath, path)).error?.message ?? null;
    }
    if (error) {
      row.image_path = null;
      report.skipped.push({ table: `picture of ${(row.name as string) || 'a character'}`, reason: error });
    } else {
      row.image_path = path;
      report.counts['character pictures'] = (report.counts['character pictures'] ?? 0) + 1;
    }
  }
}

async function upsert(table: string, rows: Row[], report: RestoreReport): Promise<void> {
  if (rows.length === 0) return;
  // Chunked: a saga's worth of chapters in one request is a large body, and one failure in
  // a chunk should not cost the rest.
  const size = 100;
  let written = 0;
  for (let i = 0; i < rows.length; i += size) {
    const { error } = await supabase.from(table).upsert(rows.slice(i, i + size), { onConflict: 'id' });
    if (error) {
      report.skipped.push({ table, reason: error.message });
      return;
    }
    written += Math.min(size, rows.length - i);
  }
  report.counts[table] = written;
}

/**
 * Write a snapshot into a project. `destination` null mints a new one, named after the
 * backup with a suffix so it never silently merges into the original.
 */
export async function restoreSnapshot(
  snapshot: Snapshot,
  userId: string,
  destination: string | null,
): Promise<{ report: RestoreReport | null; error: string | null }> {
  let projectId = destination;
  const sourceName = (snapshot.project as { name?: string } | undefined)?.name ?? 'Restored project';

  if (!projectId) {
    const { data, error } = await supabase
      .from('projects')
      .insert({ user_id: userId, name: `${sourceName} (restored)`, project_type: 'writing' })
      .select()
      .single();
    if (error || !data) return { report: null, error: error?.message ?? 'Could not create the project.' };
    projectId = data.id as string;
  }

  const report: RestoreReport = { project: projectId, counts: {}, skipped: [] };
  const sourceId = (snapshot.project as { id?: string } | undefined)?.id;
  const ids = projectId === sourceId ? null : freshIds(snapshot, projectId);
  const at = (rows: unknown[] | undefined) =>
    (rows ?? []).map((r) => retarget((ids ? remap(r, ids) : r) as Row, projectId as string, userId));

  const rows = new Map(TABLES.map(([table, key]) => [table, at(snapshot[key] as unknown[] | undefined)]));
  await restorePictures(snapshot, rows.get('storyboard_cast') ?? [], ids, userId, report);
  for (const [table] of TABLES) await upsert(table, rows.get(table) ?? [], report);

  return { report, error: null };
}

/**
 * The whole restore conversation: pick a file, confirm against what it actually holds, write
 * it into a NEW project, report. Shared by Profile and the project drawer so the two cannot
 * drift into saying different things about the same operation.
 */
export async function promptRestore(userId: string, setBusy: (busy: boolean) => void = () => {}): Promise<void> {
  const { snapshot, error } = await pickSnapshot();
  if (error) {
    Alert.alert('Could not read that file', error);
    return;
  }
  if (!snapshot) return;
  Alert.alert('Restore this backup?', `${describeSnapshot(snapshot)}

It will be restored into a NEW project. Nothing you have now is changed or deleted.`, [
    { text: 'Cancel', style: 'cancel' },
    {
      text: 'Restore',
      onPress: async () => {
        setBusy(true);
        const { report, error: err } = await restoreSnapshot(snapshot, userId, null);
        setBusy(false);
        if (err || !report) {
          Alert.alert('Restore failed', err ?? 'Nothing was written.');
          return;
        }
        void useProjectStore.getState().fetchProjects(userId);
        const wrote = Object.entries(report.counts).map(([t, n]) => `${n} ${t}`).join(', ') || 'nothing';
        const missed = report.skipped.length ? `

Not restored: ${report.skipped.map((x) => x.table).join(', ')}.` : '';
        Alert.alert('Restored', `Wrote ${wrote}. It is in your project list as a new project.${missed}`);
      },
    },
  ]);
}
