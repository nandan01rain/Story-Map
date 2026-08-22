import AsyncStorage from '@react-native-async-storage/async-storage';

// Local-only (AsyncStorage, not Supabase) reader state -- the PWA's own Reader persists
// its two bookmark systems and Font/Layout prefs per-account in Supabase; this is a
// lighter first pass scoped to this device only, not yet synced. Anchored by
// {chapterId, charOffset} rather than a page/flat-index -- pagination is device- and
// font-setting-dependent (see paginate.ts), so a raw page number would silently point at
// the wrong text the moment geometry changes; a character offset into chapter.content is
// stable regardless.
export type ReadingAnchor = { chapterId: string; charOffset: number };
export type PinnedBookmark = ReadingAnchor & { id: string; text: string; createdAt: number };
export type ReaderTextAlign = 'left' | 'center' | 'right' | 'justify';
// Kept to the app's own already-loaded fonts (theme.ts's FONTS) rather than pulling in
// Kindle-style generic serif families -- 'serif' is the branded default (Spectral,
// matching the rest of the app's prose), 'sans' and 'mono' reuse the other two families
// already bundled for the app's own chrome, so choosing one adds no new font weights.
export type ReaderFontFamily = 'serif' | 'sans' | 'mono';
export type ReaderPrefs = {
  fontScale: number;
  lineSpacingScale: number;
  dimOpacity: number;
  textAlign: ReaderTextAlign;
  fontFamily: ReaderFontFamily;
  /**
   * Whether plants, reveals and notes are tinted in the prose. Off by default: the marks are
   * for the moments you go looking for them, and a chapter permanently striped green and red
   * is a chapter you cannot read. loadReaderPrefs spreads over the defaults, so prefs saved
   * before this existed come back with it off rather than undefined.
   */
  showFlags: boolean;
};

export const DEFAULT_READER_PREFS: ReaderPrefs = {
  fontScale: 1,
  lineSpacingScale: 1,
  dimOpacity: 0,
  textAlign: 'left',
  fontFamily: 'serif',
  showFlags: false,
};

function movingKey(projectId: string, bookIndex: number) {
  return `reader-bookmark:${projectId}:${bookIndex}`;
}
function pinnedKey(projectId: string) {
  return `reader-pins:${projectId}`;
}
const PREFS_KEY = 'reader-prefs';

export async function loadMovingBookmark(projectId: string, bookIndex: number): Promise<ReadingAnchor | null> {
  const raw = await AsyncStorage.getItem(movingKey(projectId, bookIndex));
  return raw ? (JSON.parse(raw) as ReadingAnchor) : null;
}

export async function saveMovingBookmark(projectId: string, bookIndex: number, anchor: ReadingAnchor) {
  await AsyncStorage.setItem(movingKey(projectId, bookIndex), JSON.stringify(anchor));
}

export async function clearMovingBookmark(projectId: string, bookIndex: number) {
  await AsyncStorage.removeItem(movingKey(projectId, bookIndex));
}

export async function loadPinnedBookmarks(projectId: string): Promise<PinnedBookmark[]> {
  const raw = await AsyncStorage.getItem(pinnedKey(projectId));
  return raw ? (JSON.parse(raw) as PinnedBookmark[]) : [];
}

export async function addPinnedBookmark(projectId: string, entry: Omit<PinnedBookmark, 'id' | 'createdAt'>) {
  const existing = await loadPinnedBookmarks(projectId);
  const pin: PinnedBookmark = { ...entry, id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, createdAt: Date.now() };
  await AsyncStorage.setItem(pinnedKey(projectId), JSON.stringify([pin, ...existing]));
  return pin;
}

export async function loadReaderPrefs(): Promise<ReaderPrefs> {
  const raw = await AsyncStorage.getItem(PREFS_KEY);
  return raw ? { ...DEFAULT_READER_PREFS, ...JSON.parse(raw) } : DEFAULT_READER_PREFS;
}

export async function saveReaderPrefs(prefs: ReaderPrefs) {
  await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}
