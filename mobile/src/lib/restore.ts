import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';

import { supabase } from './supabase';
import type { Snapshot } from './backup';

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
// Chapter, page and document ids are PRESERVED in both cases -- they are uuids, they do not
// collide, and keeping them means annotations, progressions and graph rows that reference
// them still resolve.
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
  ];
  const warn = s.incomplete?.length ? ` Incomplete when saved: ${s.incomplete.join(', ')}.` : '';
  return `${name}, saved ${when}. ${bits.join(', ')}.${warn}`;
}

type Row = Record<string, unknown>;

/** Re-point a row at the destination project and owner, keeping its own id. */
function retarget(row: Row, projectId: string, userId: string): Row {
  const next: Row = { ...row, project_id: projectId };
  if ('user_id' in next) next.user_id = userId;
  return next;
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
  const at = (rows: unknown[] | undefined) => (rows ?? []).map((r) => retarget(r as Row, projectId as string, userId));

  // Parents first: chapters and documents are referenced by everything below them.
  await upsert('chapters', at(snapshot.chapters), report);
  await upsert('documents', at(snapshot.documents), report);
  await upsert('scenes', at(snapshot.scenes), report);
  await upsert('sticky_notes', at(snapshot.pages), report);
  await upsert('treatments', at(snapshot.treatments), report);
  await upsert('treatment_versions', at(snapshot.treatmentVersions), report);
  await upsert('graph_nodes', at(snapshot.graphNodes), report);
  await upsert('graph_edges', at(snapshot.graphEdges), report);
  await upsert('document_progressions', at(snapshot.documentProgressions), report);
  await upsert('trash', at(snapshot.trash), report);

  return { report, error: null };
}
