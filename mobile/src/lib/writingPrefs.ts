import AsyncStorage from '@react-native-async-storage/async-storage';

// Local-only state for the continuous writer (WriterScreen) -- the sibling of readerPrefs.ts,
// scoped to this device the same way and for the same reasons.
//
// Two things live here, and they are kept apart because they mean different things:
//
// 1. WHERE THE WRITER LEFT OFF: which book, and the scroll offset within it. An offset is
//    only exact while the manuscript above it is the same length, so text added on another
//    device lands this a paragraph or two off -- close enough to be where you were, which is
//    all the Reader's moving bookmark promises too. Anchoring to a chapter and a character
//    offset would be exact and is the obvious refinement if a paragraph off ever matters.
//
// 2. THE DAILY TARGET AND ITS BASELINE. "Words today" is not a count of keystrokes -- it is
//    the project's total finished prose now, minus what it was when today began. That makes
//    it honest in both directions: cutting a paragraph counts against the day, and words
//    written in the per-chapter editor count for it, because both are the same prose. The
//    baseline is taken the first time the writer opens on a new calendar day. It counts
//    CHAPTERS ONLY -- pages are for any idea and are not the thing the target is for.

export type WritingPosition = { bookIndex: number; scrollY: number };
export type DailyBaseline = { date: string; words: number };

function positionKey(projectId: string) {
  return `writer-position:${projectId}`;
}
function targetKey(projectId: string) {
  return `writer-daily-target:${projectId}`;
}
function baselineKey(projectId: string) {
  return `writer-daily-baseline:${projectId}`;
}

/** Local calendar date, so "today" turns over at the writer's midnight, not UTC's. */
export function todayKey(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export async function loadWritingPosition(projectId: string): Promise<WritingPosition | null> {
  try {
    const raw = await AsyncStorage.getItem(positionKey(projectId));
    return raw ? (JSON.parse(raw) as WritingPosition) : null;
  } catch {
    return null;
  }
}

export async function saveWritingPosition(projectId: string, pos: WritingPosition): Promise<void> {
  try {
    await AsyncStorage.setItem(positionKey(projectId), JSON.stringify(pos));
  } catch {
    // Losing the position costs a scroll, not a word.
  }
}

export async function loadDailyTarget(projectId: string): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(targetKey(projectId));
    const n = raw ? Number(raw) : 0;
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

export async function saveDailyTarget(projectId: string, words: number): Promise<void> {
  try {
    await AsyncStorage.setItem(targetKey(projectId), String(Math.max(0, Math.floor(words))));
  } catch {
    // Same: a lost target is re-entered, nothing else.
  }
}

/**
 * The word count today started from. Returns the stored baseline if it is today's; otherwise
 * records `currentWords` as today's baseline and returns that -- so the first open of a new
 * day always reads "0 today", whatever was written yesterday.
 */
export async function resolveDailyBaseline(projectId: string, currentWords: number): Promise<DailyBaseline> {
  const today = todayKey();
  try {
    const raw = await AsyncStorage.getItem(baselineKey(projectId));
    const stored = raw ? (JSON.parse(raw) as DailyBaseline) : null;
    if (stored && stored.date === today) return stored;
  } catch {
    // Fall through to a fresh baseline.
  }
  const fresh = { date: today, words: currentWords };
  try {
    await AsyncStorage.setItem(baselineKey(projectId), JSON.stringify(fresh));
  } catch {
    // Unrecorded, the day restarts from the next open. Better than throwing at the writer.
  }
  return fresh;
}
