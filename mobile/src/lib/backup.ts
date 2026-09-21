import AsyncStorage from '@react-native-async-storage/async-storage';
import { StorageAccessFramework as SAF, writeAsStringAsync } from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import { create } from 'zustand';

import { bookName, chapterNumberInBook } from './storyData';
import { type Chapter, useChapterStore } from '../store/chapterStore';
import { usePageStore } from '../store/pageStore';
import { useProjectStore } from '../store/projectStore';

// A second copy of the manuscript, in files, somewhere Supabase is not.
//
// The writer picks a folder ONCE through Android's own picker (the Storage Access Framework).
// The Google Drive app exposes its folders to that picker, so a Drive folder can be chosen
// directly and Drive's own app does the syncing -- no OAuth client, no token that dies in an
// hour, no Google Cloud project, and nothing that stops working offline. OneDrive or a plain
// local folder work the same way. What the app holds is a persistent permission on that one
// folder, which survives restarts.
//
// What is written, per project, under <folder>/<Project name>/:
//   project.json                        every chapter and page, whole -- the restore copy
//   Book One/03 - The Red Coat.md       one markdown file per chapter, for reading anywhere
//
// It runs after every save, debounced, and on demand. It is a MIRROR, not a history: a file
// is overwritten in place, and a chapter deleted in the app stays in the folder until the
// writer removes it -- deliberately, since a backup that deletes is not a backup.
//
// SAF has no "write to path": files are addressed by opaque content URIs, and creating a file
// whose name exists makes "name (1)". So every write first lists the folder and looks for the
// name, writing into the existing file if it is there. Names come back inside the URI's last
// segment, percent-encoded, with the tree's own prefix -- decodeURIComponent and the part
// after the last '/' is the file name.

const FOLDER_KEY = 'backup-folder-uri';
const LAST_KEY = 'backup-last:';
const DEBOUNCE_MS = 20_000;

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
    const pages = usePageStore.getState().pages.filter((p) => p.project_id === projectId);
    const project = useProjectStore.getState().projects.find((p) => p.id === projectId);
    const projectName = safeName(project?.name ?? projectId);

    set({ running: true, error: null });
    try {
      const projectDir = await ensureDir(folderUri, projectName);

      // The whole thing, for restoring.
      const snapshot = {
        exportedAt: new Date().toISOString(),
        project: project ?? { id: projectId, name: projectName },
        chapters,
        pages,
      };
      await writeFile(projectDir, 'project.json', 'application/json', JSON.stringify(snapshot, null, 2));

      // One readable file per chapter, in its book's folder.
      const byBook = new Map<number, Chapter[]>();
      for (const ch of chapters) {
        if (!byBook.has(ch.book)) byBook.set(ch.book, []);
        byBook.get(ch.book)!.push(ch);
      }
      for (const [book, list] of byBook) {
        const bookDir = await ensureDir(projectDir, safeName(bookName(book)));
        list.sort((a, b) => a.act - b.act || a.order - b.order);
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
// that ran on every keystroke would be writing the same file dozens of times a minute.
let timer: ReturnType<typeof setTimeout> | null = null;
let lastProjectId: string | null = null;
export function watchForBackup(projectId: string) {
  lastProjectId = projectId;
}
useChapterStore.subscribe(() => {
  const { folderUri, ready } = useBackup.getState();
  if (!ready || !folderUri || !lastProjectId) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    if (lastProjectId) void useBackup.getState().backupProject(lastProjectId);
  }, DEBOUNCE_MS);
});
