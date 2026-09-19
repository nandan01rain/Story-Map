import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Keyboard,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Icon from '../components/Icon';
import type { SignedInStackParamList } from '../navigation/types';
import { BOOKS, wordCount } from '../lib/storyData';
import {
  loadDailyTarget,
  loadWritingPosition,
  resolveDailyBaseline,
  saveDailyTarget,
  saveWritingPosition,
  type DailyBaseline,
} from '../lib/writingPrefs';
import { type Chapter, useChapterStore } from '../store/chapterStore';
import { FONTS, type ThemeColors, useTheme, withOpacity } from '../theme';

type Props = NativeStackScreenProps<SignedInStackParamList, 'Writer'>;

// The CONTINUOUS writer: one book as one scrolling manuscript, every chapter an editable run
// of prose under its own heading, opening where the writer last left off the way the Reader
// does. It sits beside the per-chapter EditorScreen rather than replacing it -- that screen
// holds flags, pairing, threads and version history, and a heading here opens it. This one
// holds the thing a manuscript is for: the next sentence, with the previous chapter still
// above it.
//
// Saving is per chapter, on the same rule as EditorScreen: debounced 1.2s, the previously
// saved text snapshotted into `versions` (capped at 10) before it is overwritten, local-first
// through the store so it never waits on a network. Every dirty chapter is flushed on the way
// out -- through refs, because the lesson of 2026-09-19 is that an unmount effect sees the
// first render's state unless it is told otherwise, and the editor spent a week overwriting
// new text with old for exactly that reason.

const AUTOSAVE_DELAY_MS = 1200;
const SCROLL_SAVE_THROTTLE_MS = 600;
const MAX_VERSIONS = 10;

type Draft = { content: string; savedContent: string; timer: ReturnType<typeof setTimeout> | null };

export default function WriterScreen({ route, navigation }: Props) {
  const { projectId } = route.params;
  const chapters = useChapterStore((s) => s.chapters);
  const fetchChapters = useChapterStore((s) => s.fetchChapters);
  const updateChapter = useChapterStore((s) => s.updateChapter);
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  useLayoutEffect(() => {
    navigation.setOptions({ title: '' });
  }, [navigation]);

  useEffect(() => {
    if (chapters.length === 0) fetchChapters(projectId);
  }, [projectId, chapters.length, fetchChapters]);

  const projectChapters = useMemo(() => chapters.filter((c) => c.project_id === projectId), [chapters, projectId]);

  const byBook = useMemo(() => {
    const map = new Map<number, Chapter[]>();
    for (const ch of projectChapters) {
      if (!map.has(ch.book)) map.set(ch.book, []);
      map.get(ch.book)!.push(ch);
    }
    for (const list of map.values()) list.sort((a, b) => a.act - b.act || a.order - b.order);
    return map;
  }, [projectChapters]);
  const bookIndices = useMemo(() => [...byBook.keys()].sort((a, b) => a - b), [byBook]);

  // ---- position: which book, and where in it -------------------------------------------
  const [bookIndex, setBookIndex] = useState<number | null>(null);
  const [positionLoaded, setPositionLoaded] = useState(false);
  const restoreScrollY = useRef<number | null>(null);
  const restored = useRef(false);
  const scrollRef = useRef<ScrollView>(null);
  const lastScrollY = useRef(0);
  const scrollSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadWritingPosition(projectId).then((pos) => {
      if (cancelled) return;
      if (pos) {
        setBookIndex(pos.bookIndex);
        restoreScrollY.current = pos.scrollY;
      }
      setPositionLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  // No saved position: open on the first book that has chapters, once we know which that is.
  useEffect(() => {
    if (!positionLoaded || bookIndex !== null || bookIndices.length === 0) return;
    setBookIndex(bookIndices[0]);
  }, [positionLoaded, bookIndex, bookIndices]);

  const bookChapters = bookIndex === null ? [] : (byBook.get(bookIndex) ?? []);

  // ---- drafts: one per chapter in the open book ----------------------------------------
  // Held in a ref and mirrored into state: the ref is what saves and flushes read, so they
  // are never behind; the state is what the inputs render from.
  const drafts = useRef<Map<string, Draft>>(new Map());
  const [contents, setContents] = useState<Map<string, string>>(new Map());
  // Per-chapter word counts, so a keystroke recounts one chapter rather than the book.
  const [wordsByChapter, setWordsByChapter] = useState<Map<string, number>>(new Map());

  // Seed a draft for any chapter that has none, and ADOPT the store's copy for a chapter
  // whose draft is clean but behind it -- that is what coming back from the per-chapter
  // Editor looks like. A draft with unsaved text keeps it: the store's copy is the older one.
  useEffect(() => {
    let changed = false;
    const nextContents = new Map(contents);
    const nextWords = new Map(wordsByChapter);
    for (const ch of projectChapters) {
      const d = drafts.current.get(ch.id);
      if (!d) {
        drafts.current.set(ch.id, { content: ch.content, savedContent: ch.content, timer: null });
        nextContents.set(ch.id, ch.content);
        nextWords.set(ch.id, wordCount(ch.content));
        changed = true;
      } else if (d.content === d.savedContent && ch.content !== d.savedContent) {
        d.content = ch.content;
        d.savedContent = ch.content;
        nextContents.set(ch.id, ch.content);
        nextWords.set(ch.id, wordCount(ch.content));
        changed = true;
      } else if (!nextWords.has(ch.id)) {
        nextWords.set(ch.id, wordCount(d.content));
        changed = true;
      }
    }
    if (changed) {
      setContents(nextContents);
      setWordsByChapter(nextWords);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectChapters]);

  const totalWords = useMemo(() => {
    let n = 0;
    for (const v of wordsByChapter.values()) n += v;
    return n;
  }, [wordsByChapter]);

  // ---- saving --------------------------------------------------------------------------
  const persist = useCallback(
    (chapterId: string) => {
      const d = drafts.current.get(chapterId);
      const ch = useChapterStore.getState().chapters.find((c) => c.id === chapterId);
      if (!d || !ch || d.content === d.savedContent) return;
      // Same rule as EditorScreen's snapshotIfChanged: keep what is about to be overwritten,
      // skip an empty prior, cap the history.
      const prior = d.savedContent;
      const versions =
        prior && prior.trim()
          ? [{ content: prior, savedAt: Date.now(), words: wordCount(prior) }, ...ch.versions].slice(0, MAX_VERSIONS)
          : ch.versions;
      d.savedContent = d.content;
      void updateChapter(chapterId, { content: d.content, versions });
    },
    [updateChapter],
  );

  const scheduleSave = useCallback(
    (chapterId: string) => {
      const d = drafts.current.get(chapterId);
      if (!d) return;
      if (d.timer) clearTimeout(d.timer);
      d.timer = setTimeout(() => {
        d.timer = null;
        persist(chapterId);
      }, AUTOSAVE_DELAY_MS);
    },
    [persist],
  );

  const flushAll = useCallback(() => {
    for (const [id, d] of drafts.current) {
      if (d.timer) {
        clearTimeout(d.timer);
        d.timer = null;
      }
      persist(id);
    }
  }, [persist]);

  const flushAllRef = useRef(flushAll);
  flushAllRef.current = flushAll;
  useEffect(() => {
    return () => {
      flushAllRef.current();
    };
  }, []);

  function handleChange(chapterId: string, text: string) {
    const d = drafts.current.get(chapterId);
    if (!d) return;
    d.content = text;
    setContents((prev) => {
      const next = new Map(prev);
      next.set(chapterId, text);
      return next;
    });
    setWordsByChapter((prev) => {
      const next = new Map(prev);
      next.set(chapterId, wordCount(text));
      return next;
    });
    scheduleSave(chapterId);
  }

  // ---- daily target --------------------------------------------------------------------
  const [target, setTarget] = useState(0);
  const [baseline, setBaseline] = useState<DailyBaseline | null>(null);
  const [targetSheetOpen, setTargetSheetOpen] = useState(false);
  const [targetInput, setTargetInput] = useState('');

  useEffect(() => {
    loadDailyTarget(projectId).then(setTarget);
  }, [projectId]);

  // The baseline is taken once the project's prose is actually counted -- the first time
  // every chapter has a word count -- and never re-taken within the day: a later recount is
  // the writer writing, which is the thing being measured.
  const allCounted = projectChapters.length > 0 && projectChapters.every((c) => wordsByChapter.has(c.id));
  useEffect(() => {
    if (baseline || !allCounted) return;
    resolveDailyBaseline(projectId, totalWords).then(setBaseline);
  }, [baseline, allCounted, projectId, totalWords]);

  const todayWords = baseline ? Math.max(0, totalWords - baseline.words) : 0;
  const progress = target > 0 ? Math.min(1, todayWords / target) : 0;

  function openTargetSheet() {
    setTargetInput(target > 0 ? String(target) : '');
    setTargetSheetOpen(true);
  }
  function commitTarget() {
    const n = parseInt(targetInput.replace(/[^\d]/g, ''), 10);
    const next = Number.isFinite(n) && n > 0 ? n : 0;
    setTarget(next);
    void saveDailyTarget(projectId, next);
    setTargetSheetOpen(false);
  }

  // ---- scroll position: restore once, then record as it moves --------------------------
  function onContentSizeChange() {
    if (restored.current || restoreScrollY.current === null || bookChapters.length === 0) return;
    restored.current = true;
    scrollRef.current?.scrollTo({ y: restoreScrollY.current, animated: false });
  }

  function onScroll(e: { nativeEvent: { contentOffset: { y: number } } }) {
    lastScrollY.current = e.nativeEvent.contentOffset.y;
    if (scrollSaveTimer.current) return;
    scrollSaveTimer.current = setTimeout(() => {
      scrollSaveTimer.current = null;
      if (bookIndex !== null) {
        void saveWritingPosition(projectId, { bookIndex, scrollY: lastScrollY.current });
      }
    }, SCROLL_SAVE_THROTTLE_MS);
  }

  function switchBook(index: number) {
    if (index === bookIndex) return;
    flushAll();
    restored.current = true; // a chosen book opens at its top, not at the old book's offset
    setBookIndex(index);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
    void saveWritingPosition(projectId, { bookIndex: index, scrollY: 0 });
  }

  // ---- keyboard: pad the foot so the end of a chapter can be scrolled above it ---------
  // Measured rather than assumed, for the reason EditorScreen gives: edge-to-edge means the
  // window does not resize for the keyboard, so the scroll view keeps its full height with
  // the keys drawn over its lower part.
  const [keyboardPad, setKeyboardPad] = useState(0);
  const scrollAreaRef = useRef<View>(null);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', (e) => {
      const node = scrollAreaRef.current;
      if (!node) return;
      node.measureInWindow((_x, y, _w, h) => {
        setKeyboardPad(Math.max(0, y + h - e.endCoordinates.screenY));
      });
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardPad(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const bookLabel = bookIndex === null ? '' : (BOOKS[bookIndex] ?? `Book ${bookIndex + 1}`);

  return (
    <View style={styles.screen}>
      {/* The day's line. Tap the words to set or change the target. */}
      <View style={styles.dayBar}>
        <View style={styles.bookPick}>
          <Text style={styles.bookLabel}>{bookLabel}</Text>
        </View>
        <Pressable onPress={openTargetSheet} hitSlop={8} style={styles.dayWords}>
          <Text style={styles.dayCount}>
            {todayWords.toLocaleString()}
            {target > 0 ? ` / ${target.toLocaleString()}` : ''}
          </Text>
          <Text style={styles.dayLabel}>{target > 0 ? 'words today' : 'today · set a target'}</Text>
        </Pressable>
      </View>
      {target > 0 && (
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }, progress >= 1 && styles.progressDone]} />
        </View>
      )}

      {/* Books, as chips. One row; the open one is gold. */}
      {bookIndices.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.bookRow}>
          {bookIndices.map((i) => (
            <Pressable key={i} onPress={() => switchBook(i)} style={[styles.bookChip, i === bookIndex && styles.bookChipActive]}>
              <Text style={[styles.bookChipText, i === bookIndex && styles.bookChipTextActive]}>{BOOKS[i] ?? `Book ${i + 1}`}</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      <View ref={scrollAreaRef} style={styles.scrollArea} collapsable={false}>
        <ScrollView
          ref={scrollRef}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          onScroll={onScroll}
          scrollEventThrottle={100}
          onContentSizeChange={onContentSizeChange}
          contentContainerStyle={[styles.manuscript, { paddingBottom: keyboardPad + insets.bottom + 120 }]}
        >
          {bookChapters.length === 0 ? (
            <Text style={styles.empty}>{positionLoaded ? 'No chapters in this book yet.' : ''}</Text>
          ) : (
            bookChapters.map((ch, i) => (
              <View key={ch.id} style={styles.chapterBlock}>
                <Pressable
                  style={styles.chapterHead}
                  onPress={() => {
                    flushAll();
                    navigation.navigate('Editor', { chapterId: ch.id });
                  }}
                >
                  <Text style={styles.chapterNumber}>{`Chapter ${i + 1}`}</Text>
                  <Text style={styles.chapterTitle} numberOfLines={2}>{ch.title}</Text>
                  <View style={styles.chapterMeta}>
                    <Text style={styles.chapterWords}>{(wordsByChapter.get(ch.id) ?? 0).toLocaleString()} words</Text>
                    <Icon name="pencil" size={13} color={colors.textFaint} />
                  </View>
                </Pressable>
                <TextInput
                  style={styles.prose}
                  multiline
                  scrollEnabled={false}
                  value={contents.get(ch.id) ?? ''}
                  onChangeText={(t) => handleChange(ch.id, t)}
                  placeholder="…"
                  placeholderTextColor={colors.textFaint}
                  textAlignVertical="top"
                  autoCorrect
                  autoCapitalize="sentences"
                />
              </View>
            ))
          )}
        </ScrollView>
      </View>

      <Modal visible={targetSheetOpen} transparent animationType="fade" onRequestClose={() => setTargetSheetOpen(false)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setTargetSheetOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.sheetTitle}>Daily target</Text>
            <Text style={styles.sheetHint}>
              Finished prose only -- words across every chapter in this project, counted from the first time you open the
              writer each day. Pages don't count; they're for ideas.
            </Text>
            <TextInput
              style={styles.sheetInput}
              value={targetInput}
              onChangeText={setTargetInput}
              keyboardType="number-pad"
              placeholder="e.g. 1000"
              placeholderTextColor={colors.textFaint}
              autoFocus
              onSubmitEditing={commitTarget}
            />
            <View style={styles.sheetActions}>
              <Pressable
                onPress={() => {
                  setTargetInput('');
                  setTarget(0);
                  void saveDailyTarget(projectId, 0);
                  setTargetSheetOpen(false);
                }}
              >
                <Text style={styles.sheetSecondary}>Clear</Text>
              </Pressable>
              <Pressable onPress={commitTarget} style={styles.sheetPrimary}>
                <Text style={styles.sheetPrimaryText}>Set</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg },
    dayBar: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingTop: 10,
      paddingBottom: 8,
    },
    bookPick: { flexShrink: 1 },
    bookLabel: { color: colors.gold, fontFamily: FONTS.heading, fontSize: 13, letterSpacing: 2 },
    dayWords: { alignItems: 'flex-end' },
    dayCount: { color: colors.text, fontFamily: FONTS.headingBold, fontSize: 16, letterSpacing: 1 },
    dayLabel: { color: colors.textFaint, fontFamily: FONTS.body, fontSize: 11, marginTop: 1 },
    progressTrack: { height: 2, backgroundColor: colors.borderDim, marginHorizontal: 20 },
    progressFill: { height: 2, backgroundColor: colors.gold },
    progressDone: { backgroundColor: colors.gold, opacity: 1 },
    bookRow: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
    bookChip: {
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.borderDim,
    },
    bookChipActive: { borderColor: colors.gold, backgroundColor: withOpacity(colors.gold, 0.1) },
    bookChipText: { color: colors.textDim, fontFamily: FONTS.heading, fontSize: 11, letterSpacing: 1 },
    bookChipTextActive: { color: colors.gold },
    scrollArea: { flex: 1 },
    manuscript: { paddingHorizontal: 22, paddingTop: 8 },
    empty: { color: colors.textFaint, fontFamily: FONTS.body, fontSize: 15, textAlign: 'center', marginTop: 60 },
    chapterBlock: { marginBottom: 34 },
    chapterHead: {
      alignItems: 'center',
      paddingTop: 22,
      paddingBottom: 14,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.borderDim,
      marginBottom: 6,
    },
    chapterNumber: { color: colors.gold, fontFamily: FONTS.heading, fontSize: 11, letterSpacing: 3 },
    chapterTitle: {
      color: colors.text,
      fontFamily: FONTS.headingBold,
      fontSize: 18,
      letterSpacing: 1,
      textAlign: 'center',
      marginTop: 6,
    },
    chapterMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
    chapterWords: { color: colors.textFaint, fontFamily: FONTS.body, fontSize: 12 },
    prose: {
      color: colors.text,
      fontFamily: FONTS.literary,
      fontSize: 17,
      lineHeight: 28,
      padding: 0,
      minHeight: 120,
    },
    sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 28 },
    sheet: { backgroundColor: colors.panel, borderRadius: 14, padding: 20, borderWidth: 1, borderColor: colors.border },
    sheetTitle: { color: colors.gold, fontFamily: FONTS.heading, fontSize: 14, letterSpacing: 2 },
    sheetHint: { color: colors.textDim, fontFamily: FONTS.body, fontSize: 13, lineHeight: 19, marginTop: 8 },
    sheetInput: {
      marginTop: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      color: colors.text,
      fontFamily: FONTS.headingBold,
      fontSize: 22,
      paddingVertical: 6,
    },
    sheetActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 18 },
    sheetSecondary: { color: colors.textFaint, fontFamily: FONTS.body, fontSize: 14 },
    sheetPrimary: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 8, backgroundColor: colors.gold },
    sheetPrimaryText: { color: colors.bg, fontFamily: FONTS.headingBold, fontSize: 13, letterSpacing: 1 },
  });
}
