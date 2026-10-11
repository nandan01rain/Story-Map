import AsyncStorage from '@react-native-async-storage/async-storage';
import { File, Paths } from 'expo-file-system';
import { StorageAccessFramework as SAF, writeAsStringAsync } from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { create } from 'zustand';

import { bookName, byBookOrder, chapterNumberInBook } from './storyData';
import { supabase } from './supabase';
import { type Chapter, useChapterStore } from '../store/chapterStore';
import { usePageStore } from '../store/pageStore';
import { useDocumentStore } from '../store/documentStore';
import { useProjectStore } from '../store/projectStore';
import { useStoryboardStore } from '../store/storyboardStore';
import { useTreatmentStore } from '../store/treatmentStore';

// A second copy of the whole project, somewhere Supabase is not.
//
// TWO ROUTES, because Android gives two and they fail differently.
//
//   1. A FOLDER, picked once through Android's own picker (the Storage Access Framework).
//      Every save mirrors into it. Best for a folder on the phone, on an SD card, or one a
//      sync app (OneDrive, Syncthing, FolderSync) watches.
//
//      NOT GOOGLE DRIVE. The Drive app's DocumentsProvider does not support
//      ACTION_OPEN_DOCUMENT_TREE: it appears in the picker for choosing a single file, but a
//      folder inside it cannot be granted as a tree and cannot be created there. This module
//      was first written (2026-09-21) assuming it could, and the phone said otherwise
//      (2026-09-24). Nothing in the picker route reaches Drive, and the wording must not
//      promise it.
//
//   2. A FILE, handed to the share sheet. One .json of everything, which Drive accepts
//      through "Save to Drive" like any other file, as do Gmail, Keep, WhatsApp and a cable.
//      Manual, and the reliable way to get a copy INTO Drive from Android.
//
// Both write the same snapshot: EVERY project-scoped table, not just the prose. The first
// version carried chapters and pages only, which would have kept the manuscript and lost the
// Master Bible -- the thing least replaceable by rewriting.
//
// It is a MIRROR, not a history: a file is overwritten in place, and a chapter deleted in the
// app stays in the folder until the writer removes it, deliberately -- a backup that deletes
// is not a backup.
//
// SAF has no "write to path": files are opaque content URIs, and creating a file whose name
// exists makes "name (1)". So every write lists the folder and looks for the name first.
// Names come back inside the URI's last segment, percent-encoded.

const FOLDER_KEY = 'backup-folder-uri';
const LAST_KEY = 'backup-last:';
const DOCS_MIRRORED_KEY = 'backup-docs-mirrored:';
const DEBOUNCE_MS = 20_000;
/** Bumped when the snapshot's shape changes, so a restore can tell what it is reading. */
export const SNAPSHOT_VERSION = 3;

export type Snapshot = {
  snapshotVersion: number;
  exportedAt: string;
  project: unknown;
  chapters: unknown[];
  pages: unknown[];
  documents: unknown[];
  documentProgressions: unknown[];
  scenes: unknown[];
  treatments: unknown[];
  treatmentVersions: unknown[];
  /** Since version 3. Absent from older snapshots, which restore reads as empty. */
  storyboardEvents?: unknown[];
  storyboardThreads?: unknown[];
  storyboardLinks?: unknown[];
  graphNodes: unknown[];
  graphEdges: unknown[];
  trash: unknown[];
  /** Tables the network or a missing migration prevented reading, so a restore knows. */
  incomplete: string[];
};

type BackupState = {
  folderUri: string | null;
  lastBackupAt: number | null;
  running: boolean;
  error: string | null;
  ready: boolean;
  load: () => Promise<void>;
  chooseFolder: () => Promise<{ error: string | null }>;
  clearFolder: () => Promise<void>;
  backupProject: (projectId: string) => Promise<{ error: string | null }>;
  /** Build the snapshot and hand it to the share sheet -- the route that reaches Drive. */
  shareSnapshot: (projectId: string) => Promise<{ error: string | null }>;
};

function safName(uri: string): string {
  const decoded = decodeURIComponent(uri);
  const i = decoded.lastIndexOf('/');
  return i >= 0 ? decoded.slice(i + 1) : decoded;
}

async function childByName(parentUri: string, name: string): Promise<string | null> {
  const children = await SAF.readDirectoryAsync(parentUri);
  return children.find((c) => safName(c) === name) ?? null;
}

async function ensureDir(parentUri: string, name: string): Promise<string> {
  return (await childByName(parentUri, name)) ?? (await SAF.makeDirectoryAsync(parentUri, name));
}

async function writeFile(parentUri: string, name: string, mime: string, contents: string): Promise<void> {
  const existing = await childByName(parentUri, name);
  const uri = existing ?? (await SAF.createFileAsync(parentUri, name, mime));
  await writeAsStringAsync(uri, contents);
}

/** Characters Android's providers reject in names, replaced; length kept sane. */
function safeName(s: string): string {
  return s.replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim().slice(0, 80) || 'Untitled';
}

function chapterMarkdown(ch: Chapter, all: Chapter[]): string {
  const n = chapterNumberInBook(ch, all);
  const head = [
    `# ${ch.title}`,
    '',
    `${bookName(ch.book)} · Act ${ch.act}${n ? ` · Chapter ${n}` : ''}`,
    `Status: ${ch.status}`,
  ];
  if (ch.notes && ch.notes.trim()) head.push('', '## Notes', '', ch.notes.trim());
  head.push('', '---', '', ch.content ?? '');
  return head.join('\n');
}

/**
 * A row as it can be written back. `search` is a GENERATED column on documents, scenes,
 * chapters, pages, treatment versions and storyboard events, and Postgres refuses any write to
 * one -- so a snapshot carrying it could never be restored into those tables (found
 * 2026-10-11). It is derived from the text anyway, and regenerates on insert.
 */
export function withoutGenerated<T>(row: T): T {
  if (row && typeof row === 'object' && 'search' in (row as object)) {
    const { search: _search, ...rest } = row as Record<string, unknown>;
    return rest as T;
  }
  return row;
}

/** One table, or [] plus a note in `incomplete` when it cannot be read. */
async function table(name: string, projectId: string, incomplete: string[]): Promise<unknown[]> {
  const { data, error } = await supabase.from(name).select('*').eq('project_id', projectId);
  if (error) {
    incomplete.push(name);
    return [];
  }
  return (data ?? []).map(withoutGenerated);
}

type DocRow = { id: string; title: string; type: string; content: string; created_at: string; updated_at: string };
const DOC_COLUMNS = 'id, project_id, user_id, title, type, content, created_at, updated_at';

/**
 * Documents, fetched INCREMENTALLY. The reference set alone is 4.3 MB, and the mirror runs
 * after every pause in writing; downloading all of it each time would be most of a mobile
 * data plan. So a local copy is kept on the device, the server is asked only for each
 * document's id and updated_at, and only the new or changed ones are fetched in full.
 */
async function documentsIncremental(projectId: string, incomplete: string[]): Promise<DocRow[]> {
  const cacheFile = new File(Paths.document, `backup-documents-${projectId}.json`);
  let cache: Record<string, DocRow> = {};
  try {
    if (cacheFile.exists) cache = JSON.parse(await cacheFile.text()) as Record<string, DocRow>;
  } catch {
    cache = {};
  }

  const { data: list, error } = await supabase.from('documents').select('id, updated_at').eq('project_id', projectId);
  if (error || !list) {
    incomplete.push('documents');
    return Object.values(cache);
  }
  const changed = list.filter((d) => cache[d.id]?.updated_at !== d.updated_at).map((d) => d.id as string);
  for (let i = 0; i < changed.length; i += 20) {
    const { data, error: err } = await supabase.from('documents').select(DOC_COLUMNS).in('id', changed.slice(i, i + 20));
    if (err || !data) {
      incomplete.push('documents');
      break;
    }
    for (const row of data as DocRow[]) cache[row.id] = row;
  }
  // Only what still exists on the server; a deleted document leaves the cache (its readable
  // file stays in the folder -- a backup that deletes is not a backup).
  const alive = new Set(list.map((d) => d.id as string));
  const next: Record<string, DocRow> = {};
  for (const [id, row] of Object.entries(cache)) if (alive.has(id)) next[id] = row;
  try {
    if (!cacheFile.exists) cacheFile.create();
    cacheFile.write(JSON.stringify(next));
  } catch {
    // The cache only saves bandwidth next time; failing to write it costs nothing now.
  }
  return Object.values(next);
}

/** A document as a readable file: its title, its type, then its markdown exactly as stored. */
function documentMarkdown(doc: DocRow): string {
  return [`# ${doc.title}`, '', `Type: ${doc.type}`, `Last edited: ${doc.updated_at}`, '', '---', '', doc.content ?? ''].join('\n');
}

/**
 * Everything the project is. Chapters and pages come from the stores, which are cache-backed
 * and therefore correct offline and ahead of the server when the outbox has not flushed; the
 * rest are read straight from the database, and are listed in `incomplete` if that fails.
 */
export async function collectSnapshot(projectId: string): Promise<Snapshot> {
  const incomplete: string[] = [];
  const chapters = useChapterStore.getState().chapters.filter((c) => c.project_id === projectId);
  const pages = usePageStore.getState().pages.filter((p) => p.project_id === projectId);
  const project = useProjectStore.getState().projects.find((p) => p.id === projectId);

  const [
    documents,
    documentProgressions,
    scenes,
    treatments,
    treatmentVersions,
    storyboardEvents,
    storyboardThreads,
    storyboardLinks,
    graphNodes,
    graphEdges,
    trash,
  ] =
    await Promise.all([
      documentsIncremental(projectId, incomplete),
      table('document_progressions', projectId, incomplete),
      table('scenes', projectId, incomplete),
      table('treatments', projectId, incomplete),
      table('treatment_versions', projectId, incomplete),
      table('storyboard_events', projectId, incomplete),
      table('storyboard_threads', projectId, incomplete),
      table('storyboard_links', projectId, incomplete),
      table('graph_nodes', projectId, incomplete),
      table('graph_edges', projectId, incomplete),
      table('trash', projectId, incomplete),
    ]);

  return {
    snapshotVersion: SNAPSHOT_VERSION,
    exportedAt: new Date().toISOString(),
    project: project ?? { id: projectId },
    chapters,
    pages,
    documents,
    documentProgressions,
    scenes,
    treatments,
    treatmentVersions,
    storyboardEvents,
    storyboardThreads,
    storyboardLinks,
    graphNodes,
    graphEdges,
    trash,
    incomplete,
  };
}

export const useBackup = create<BackupState>((set, get) => ({
  folderUri: null,
  lastBackupAt: null,
  running: false,
  error: null,
  ready: false,

  load: async () => {
    try {
      const folderUri = await AsyncStorage.getItem(FOLDER_KEY);
      set({ folderUri, ready: true });
    } catch {
      set({ ready: true });
    }
  },

  chooseFolder: async () => {
    if (Platform.OS !== 'android') return { error: 'Folder backup is Android-only for now.' };
    try {
      const res = await SAF.requestDirectoryPermissionsAsync();
      if (!res.granted) return { error: 'No folder was chosen.' };
      await AsyncStorage.setItem(FOLDER_KEY, res.directoryUri);
      set({ folderUri: res.directoryUri, error: null });
      return { error: null };
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Could not open the folder picker.' };
    }
  },

  clearFolder: async () => {
    await AsyncStorage.removeItem(FOLDER_KEY);
    set({ folderUri: null, lastBackupAt: null });
  },

  backupProject: async (projectId) => {
    const { folderUri, running } = get();
    if (!folderUri) return { error: 'No backup folder chosen.' };
    if (running) return { error: null };
    const chapters = useChapterStore.getState().chapters.filter((c) => c.project_id === projectId);
    if (chapters.length === 0) return { error: null }; // nothing loaded is not nothing written
    const project = useProjectStore.getState().projects.find((p) => p.id === projectId);
    const projectName = safeName(project?.name ?? projectId);

    set({ running: true, error: null });
    try {
      const projectDir = await ensureDir(folderUri, projectName);
      const snapshot = await collectSnapshot(projectId);
      await writeFile(projectDir, 'project.json', 'application/json', JSON.stringify(snapshot, null, 2));

      // One readable file per document, in Documents/, written only when it has changed since
      // the last mirror -- the first run writes all of them, later runs only what was edited.
      const docs = snapshot.documents as DocRow[];
      if (docs.length > 0) {
        const mirroredKey = DOCS_MIRRORED_KEY + projectId;
        let mirrored: Record<string, string> = {};
        try {
          mirrored = JSON.parse((await AsyncStorage.getItem(mirroredKey)) ?? '{}');
        } catch {
          mirrored = {};
        }
        const pending = docs.filter((d) => mirrored[d.id] !== d.updated_at);
        if (pending.length > 0) {
          const docsDir = await ensureDir(projectDir, 'Documents');
          // Names must be stable to overwrite in place, and unique: a repeated title gets the
          // start of its id.
          const seen = new Map<string, number>();
          for (const d of docs) seen.set(safeName(d.title), (seen.get(safeName(d.title)) ?? 0) + 1);
          for (const d of pending) {
            const base = safeName(d.title);
            const name = (seen.get(base) ?? 0) > 1 ? `${base} (${d.id.slice(0, 6)}).md` : `${base}.md`;
            await writeFile(docsDir, name, 'text/markdown', documentMarkdown(d));
            mirrored[d.id] = d.updated_at;
          }
          await AsyncStorage.setItem(mirroredKey, JSON.stringify(mirrored));
        }
      }

      // One readable file per chapter, in its book's folder.
      const byBook = new Map<number, Chapter[]>();
      for (const ch of chapters) {
        if (!byBook.has(ch.book)) byBook.set(ch.book, []);
        byBook.get(ch.book)!.push(ch);
      }
      for (const [book, list] of byBook) {
        const bookDir = await ensureDir(projectDir, safeName(bookName(book)));
        list.sort(byBookOrder);
        for (const ch of list) {
          const n = chapterNumberInBook(ch, chapters) ?? 0;
          const name = `${String(n).padStart(2, '0')} - ${safeName(ch.title)}.md`;
          await writeFile(bookDir, name, 'text/markdown', chapterMarkdown(ch, chapters));
        }
      }

      const now = Date.now();
      await AsyncStorage.setItem(LAST_KEY + projectId, String(now));
      set({ running: false, lastBackupAt: now });
      return { error: null };
    } catch (e) {
      // The folder may have been deleted, or the permission revoked in Files. Say so and
      // keep the setting: the writer can re-pick from the same card.
      const message = e instanceof Error ? e.message : 'Backup failed.';
      set({ running: false, error: message });
      return { error: message };
    }
  },

  shareSnapshot: async (projectId) => {
    set({ running: true, error: null });
    try {
      const snapshot = await collectSnapshot(projectId);
      const project = useProjectStore.getState().projects.find((p) => p.id === projectId);
      const stamp = new Date().toISOString().slice(0, 10);
      const file = new File(Paths.cache, `${safeName(project?.name ?? 'StoryMap')} ${stamp}.json`);
      if (file.exists) file.delete();
      file.create();
      file.write(JSON.stringify(snapshot, null, 2));
      if (!(await Sharing.isAvailableAsync())) {
        set({ running: false });
        return { error: 'The file was written, but this device has no way to share it.' };
      }
      await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Save a backup' });
      const now = Date.now();
      await AsyncStorage.setItem(LAST_KEY + projectId, String(now));
      set({ running: false, lastBackupAt: now });
      return { error: null };
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Could not build the backup file.';
      set({ running: false, error: message });
      return { error: message };
    }
  },
}));

export async function loadLastBackup(projectId: string): Promise<number | null> {
  try {
    const raw = await AsyncStorage.getItem(LAST_KEY + projectId);
    return raw ? Number(raw) : null;
  } catch {
    return null;
  }
}

// After every save, debounced: the outbox coalesces autosaves the same way, and a backup
// that ran on every keystroke would be writing the same files dozens of times a minute.
let timer: ReturnType<typeof setTimeout> | null = null;
let lastProjectId: string | null = null;
export function watchForBackup(projectId: string) {
  lastProjectId = projectId;
}
function scheduleMirror() {
  const { folderUri, ready } = useBackup.getState();
  if (!ready || !folderUri || !lastProjectId) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    if (lastProjectId) void useBackup.getState().backupProject(lastProjectId);
  }, DEBOUNCE_MS);
}
// Every store that holds the writer's work, not only chapters (2026-10-11): editing a
// document, a page, a treatment or the storyboard used to leave the mirror untouched until a
// chapter happened to change.
useChapterStore.subscribe(scheduleMirror);
usePageStore.subscribe(scheduleMirror);
useDocumentStore.subscribe(scheduleMirror);
useTreatmentStore.subscribe(scheduleMirror);
useStoryboardStore.subscribe(scheduleMirror);
