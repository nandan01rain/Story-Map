import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { create } from 'zustand';

import { wordCount } from './storyData';
import { loadDailyTarget, resolveDailyBaseline, saveDailyTarget, todayKey } from './writingPrefs';
import { useChapterStore } from '../store/chapterStore';

// The day's words, the streak, and the reminder -- for the project that is open.
//
// This lives in a store with a subscriber on the chapters, not in the Writer screen, because
// the thing being measured is FINISHED PROSE wherever it was written: a paragraph typed in
// the per-chapter Editor, or a page promoted to a chapter, counts the same as one typed in
// the Writer. A screen that only knew about itself would break a streak on a day the writer
// simply used the other editor.
//
// What is stored, per project, on this device:
//   history  { 'YYYY-MM-DD': { words, target } }   the day's count and the target it faced
//   reminder { enabled, hour, minute }             when to ask, if the day's target is unmet
//
// STREAK RULE: consecutive days, ending today or yesterday, on which words >= target and the
// target was > 0. Today counts once it is met; until then the streak is whatever ran up to
// yesterday, and it is only BROKEN when yesterday was missed. A day with no target set is not
// a day that can be met or missed -- it neither extends nor breaks anything.
//
// REMINDER RULE: exactly one scheduled notification, for the next reminder time on a day
// whose target is not yet met. Met today before the time? It moves to tomorrow. Never opened
// the app? It fires, which is the point. It is rescheduled on every recount and on every
// foreground, so it never has to be right for longer than that.

export type DayRecord = { words: number; target: number };
export type WritingHistory = Record<string, DayRecord>;
export type ReminderPrefs = { enabled: boolean; hour: number; minute: number };

export const DEFAULT_REMINDER: ReminderPrefs = { enabled: false, hour: 20, minute: 0 };
const HISTORY_PREFIX = 'writer-daily-history:';
const REMINDER_PREFIX = 'writer-reminder:';
const REMINDER_TAG = 'daily-target';

type WritingStatsState = {
  projectId: string | null;
  today: string;
  todayWords: number;
  target: number;
  history: WritingHistory;
  reminder: ReminderPrefs;
  /** Consecutive met days ending today or yesterday. */
  streak: number;
  best: number;
  ready: boolean;
  /** Point the stats at a project. Called by the screens that know which is open. */
  setProject: (projectId: string) => Promise<void>;
  setTarget: (words: number) => Promise<void>;
  setReminder: (prefs: ReminderPrefs) => Promise<void>;
  /** Recompute from the chapters in the store. Cheap; runs on every chapter change. */
  recount: () => Promise<void>;
};

async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
async function writeJson(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Lost stats are re-derived tomorrow; nothing the writer typed depends on this.
  }
}

function dayBefore(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() - 1);
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${dt.getFullYear()}-${mm}-${dd}`;
}

function met(r: DayRecord | undefined): boolean {
  return !!r && r.target > 0 && r.words >= r.target;
}

export function computeStreak(history: WritingHistory, today: string): { streak: number; best: number } {
  // Current: walk back from today (if met) or yesterday.
  let cursor = met(history[today]) ? today : dayBefore(today);
  let streak = 0;
  while (met(history[cursor])) {
    streak += 1;
    cursor = dayBefore(cursor);
  }
  // Best: longest run anywhere in the history.
  let best = 0;
  for (const day of Object.keys(history)) {
    if (!met(history[day]) || met(history[dayBefore(day)])) continue; // only run starts
    let n = 0;
    let c = day;
    while (met(history[c])) {
      n += 1;
      c = nextDay(c);
    }
    if (n > best) best = n;
  }
  return { streak, best: Math.max(best, streak) };
}

function nextDay(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + 1);
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${dt.getFullYear()}-${mm}-${dd}`;
}

function projectWords(projectId: string): number {
  let n = 0;
  for (const c of useChapterStore.getState().chapters) {
    if (c.project_id === projectId) n += wordCount(c.content);
  }
  return n;
}

// ---- the reminder --------------------------------------------------------------------------

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

async function ensureChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('writing', {
    name: 'Writing reminders',
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: null,
  });
}

/** True if the writer allowed notifications; asks once if not yet decided. */
export async function ensureNotificationPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted;
}

async function cancelReminder() {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  for (const n of all) {
    if (n.content.data?.tag === REMINDER_TAG) await Notifications.cancelScheduledNotificationAsync(n.identifier);
  }
}

/**
 * One notification, at the next reminder time on a day whose target is not yet met. Cancels
 * whatever was scheduled before, so calling this often is safe and is how it stays right.
 */
async function scheduleReminder(prefs: ReminderPrefs, target: number, todayMet: boolean, projectId: string) {
  await cancelReminder();
  if (!prefs.enabled || target <= 0) return;
  const granted = await Notifications.getPermissionsAsync();
  if (!granted.granted) return;
  await ensureChannel();

  const now = new Date();
  const next = new Date(now);
  next.setHours(prefs.hour, prefs.minute, 0, 0);
  if (todayMet || next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1);

  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'The page is waiting',
      body: `You set ${target.toLocaleString()} words a day. Today's are still to write.`,
      data: { tag: REMINDER_TAG, projectId },
      ...(Platform.OS === 'android' ? { channelId: 'writing' } : {}),
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: next },
  });
}

// ---- the store -----------------------------------------------------------------------------

export const useWritingStats = create<WritingStatsState>((set, get) => ({
  projectId: null,
  today: todayKey(),
  todayWords: 0,
  target: 0,
  history: {},
  reminder: DEFAULT_REMINDER,
  streak: 0,
  best: 0,
  ready: false,

  setProject: async (projectId) => {
    if (get().projectId === projectId && get().ready) return;
    const [target, history, reminder] = await Promise.all([
      loadDailyTarget(projectId),
      readJson<WritingHistory>(HISTORY_PREFIX + projectId, {}),
      readJson<ReminderPrefs>(REMINDER_PREFIX + projectId, DEFAULT_REMINDER),
    ]);
    set({ projectId, target, history, reminder, ready: true, today: todayKey() });
    await get().recount();
  },

  setTarget: async (words) => {
    const { projectId } = get();
    if (!projectId) return;
    await saveDailyTarget(projectId, words);
    set({ target: words });
    await get().recount();
  },

  setReminder: async (prefs) => {
    const { projectId } = get();
    if (!projectId) return;
    await writeJson(REMINDER_PREFIX + projectId, prefs);
    set({ reminder: prefs });
    await get().recount();
  },

  recount: async () => {
    const { projectId, target, reminder } = get();
    if (!projectId) return;
    const today = todayKey();
    const total = projectWords(projectId);
    const baseline = await resolveDailyBaseline(projectId, total);
    const todayWords = Math.max(0, total - baseline.words);

    // Record today. The target stored with the day is the one it FACED, so raising the target
    // tomorrow does not retroactively unmake yesterday.
    const history = { ...get().history, [today]: { words: todayWords, target } };
    const { streak, best } = computeStreak(history, today);
    set({ today, todayWords, history, streak, best });
    await writeJson(HISTORY_PREFIX + projectId, history);

    await scheduleReminder(reminder, target, met(history[today]), projectId);
  },
}));

// Recount whenever the chapters change -- which is every autosave from either editor. The
// recount is a word count over the project, so it is throttled; a keystroke does not need
// the streak to update within the same frame.
let recountTimer: ReturnType<typeof setTimeout> | null = null;
useChapterStore.subscribe(() => {
  if (!useWritingStats.getState().ready) return;
  if (recountTimer) clearTimeout(recountTimer);
  recountTimer = setTimeout(() => {
    recountTimer = null;
    void useWritingStats.getState().recount();
  }, 1500);
});
