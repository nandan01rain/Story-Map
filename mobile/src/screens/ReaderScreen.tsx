import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Slider from '@react-native-community/slider';
import * as Clipboard from 'expo-clipboard';
import * as NavigationBar from 'expo-navigation-bar';
import { StatusBar } from 'expo-status-bar';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import Icon from '../components/Icon';
import SlidePanel, { EdgeSwipeZone } from '../components/SlidePanel';
import { buildLineWords, buildPagesFromLines, type ChapterPage, type LineWord } from '../lib/paginate';
import { useSlidePanel } from '../lib/useSlidePanel';
import {
  DEFAULT_READER_PREFS,
  type ReaderFontFamily,
  type ReaderPrefs,
  type ReaderTextAlign,
  addPinnedBookmark,
  loadMovingBookmark,
  loadReaderPrefs,
  saveMovingBookmark,
  saveReaderPrefs,
} from '../lib/readerPrefs';
import { BOOKS, tokenizeWords } from '../lib/storyData';
import type { SignedInStackParamList } from '../navigation/types';
import { type Annotation, type Chapter, useChapterStore } from '../store/chapterStore';
import { FONTS, type ThemeColors, useTheme, withOpacity } from '../theme';

type Props = NativeStackScreenProps<SignedInStackParamList, 'Reader'>;

const BASE_FONT_SIZE = 16.5;
const BASE_LINE_HEIGHT = 27;
const PAGE_PAD_H = 24;
// Asymmetric now: the chapter heading sits lower on the page and is set noticeably
// larger, so the prose column has to start further down to clear it.
const PAGE_PAD_TOP = 96;
const PAGE_PAD_BOTTOM = 52;
const HEADING_TOP = 46;
const HEADING_FONT_SIZE = 23;
const SELECTION_TINT = 'rgba(198,154,58,0.45)';
// Marker ink: a warmer, more yellow wash than the selection tint so a highlight still
// reads as a highlight while text is selected on top of it.
const HIGHLIGHT_TINT = 'rgba(242,201,76,0.34)';
const HIGHLIGHT_INK = '#f2c94c';
// The character web's own plant and reveal colours, so a line flagged green there is the
// same green here. Lighter than the web's, because there it tints a shape on a dark canvas
// and here it sits behind body text that still has to be read comfortably.
const PLANT_TINT = 'rgba(90,164,105,0.30)';
const REVEAL_TINT = 'rgba(192,80,77,0.28)';
const PLANT_INK = '#5aa469';
const REVEAL_INK = '#c0504d';
const TINT_BLEED = { paddingHorizontal: 5, marginHorizontal: -5, paddingVertical: 2, marginVertical: -2 };
// Shared empty set for pages outside the current chapter, so they don't each allocate one.
const EMPTY_TOKENS: Set<number> = new Set();
/** The three kinds of mark drawn under the prose, each as a set of token indices. */
type MarkedTokens = { highlight: Set<number>; plant: Set<number>; reveal: Set<number> };
// Shared, so a page from a chapter other than the current one does not allocate three sets
// per render just to say "nothing marked here".
const EMPTY_MARKS: MarkedTokens = { highlight: EMPTY_TOKENS, plant: EMPTY_TOKENS, reveal: EMPTY_TOKENS };
// Stable identities so memoized pages aren't re-rendered by a fresh literal each pass.
const EMPTY_LINE_WORDS: LineWord[][] = [];
const CAROUSEL_ITEM_RATIO = 0.74;
const CAROUSEL_GAP = 12;
// How many pages either side of the current one actually get rendered. Both pagers used
// to render every page in the book at once, which is what made toggling chrome (a full
// re-mount of one pager) visibly jitter; a fixed-size window keeps that switch cheap
// while spacer views preserve the full scroll extent so page offsets stay exact.
const FULLSCREEN_WINDOW = 2;
const CAROUSEL_WINDOW = 3;
const SELECT_LONG_PRESS_MS = 320;
// Filters out the sub-pixel width/height jitter Android's own nav-bar hide/show
// animation produces (see the useFocusEffect below) -- without this, that jitter was
// re-triggering the pagination-reset effect over and over, which is what made the
// screen get stuck permanently "loading" after returning from EditorScreen.
const DIMENSION_CHANGE_THRESHOLD = 10;
/** One annotation located in the current chapter's tokens. */
type ReaderSpan = {
  id: string;
  type: 'highlight' | 'plant' | 'reveal';
  label: string;
  /** Present on flags that belong to a plant/reveal pair; the pair's own title. */
  pairLabel: string;
  text: string;
  start: number;
  end: number;
};

const FONT_FAMILY_OPTIONS: { key: ReaderFontFamily; label: string; family: string }[] = [
  { key: 'serif', label: 'Serif', family: FONTS.literary },
  { key: 'sans', label: 'Sans', family: FONTS.body },
  { key: 'mono', label: 'Mono', family: FONTS.mono },
];
const ALIGN_OPTIONS: { key: ReaderTextAlign; icon: string }[] = [
  { key: 'left', icon: 'align-left' },
  { key: 'center', icon: 'align-center' },
  { key: 'right', icon: 'align-right' },
  { key: 'justify', icon: 'align-justify' },
];

// Finds the jumped-to text in the chapter. An exact match is the normal case; the
// fallbacks cover a selection whose whitespace does not survive the round trip -- a
// selection dragged across a line break carries a newline the reader's copy may have as a
// space, and trailing whitespace is easy to pick up and invisible to the person selecting.
function findJumpOffset(content: string, needle: string): number {
  const exact = content.indexOf(needle);
  if (exact !== -1) return exact;

  const trimmed = needle.trim();
  if (trimmed && trimmed !== needle) {
    const trimmedIdx = content.indexOf(trimmed);
    if (trimmedIdx !== -1) return trimmedIdx;
  }
  if (!trimmed) return -1;

  // Last resort: match ignoring how whitespace is written, by walking the same characters
  // through the content with any run of whitespace allowed to stand in for any other.
  const pattern = trimmed
    .replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`)
    .replace(/\s+/g, String.raw`\s+`);
  const match = new RegExp(pattern).exec(content);
  return match ? match.index : -1;
}

function resolveFontFamily(f: ReaderFontFamily): string {
  return FONT_FAMILY_OPTIONS.find((o) => o.key === f)?.family ?? FONTS.literary;
}

type FlatPage = {
  chapterId: string;
  chapterTitle: string;
  pageInChapter: number;
  totalInChapter: number;
  bookPageNumber: number; // 1-based position across the WHOLE book, not just this chapter
} & ChapterPage;

type WordRect = { line: number; x: number; width: number };

// Real page-level pagination (not one page per chapter): each chapter's prose is split
// into fixed-height visual pages via a hidden, off-screen Text per chapter using RN's
// onTextLayout line metrics (see lib/paginate.ts). Pages from every chapter in the
// current book flatten into one continuous swipeable sequence -- a real book, not a
// chapter browser.
//
// Two view modes: chrome-hidden is a single edge-to-edge page (immersive, no app chrome
// at all -- see the useFocusEffect below for hiding the OS status/nav bars too);
// chrome-visible shows the top/bottom chrome AND switches page rendering to a peeking
// three-up carousel. A single tap toggles between the two. Both pagers stay mounted and
// cross-fade/scale into each other so that toggle reads as one continuous zoom rather
// than one view being torn down and another built.
//
// Selection is a long-press that turns into a drag: holding a word selects it, and
// continuing to drag without lifting extends the selection word by word under the finger.
// That works because a page is drawn one line at a time with each word as its own
// positioned element (paginate.ts's buildLineWords), so every word has a real measured
// rectangle to hit-test against -- the earlier single-Text page had no per-word geometry,
// which is why selection could only ever be a tap on one word and why dragging fell
// through to the pager and turned the page instead.
export default function ReaderScreen({ route, navigation }: Props) {
  const { projectId, projectName, chapterId, jumpToText } = route.params;
  const rawDims = useWindowDimensions();
  const [dims, setDims] = useState({ width: rawDims.width, height: rawDims.height });
  useEffect(() => {
    if (
      Math.abs(rawDims.width - dims.width) > DIMENSION_CHANGE_THRESHOLD ||
      Math.abs(rawDims.height - dims.height) > DIMENSION_CHANGE_THRESHOLD
    ) {
      setDims({ width: rawDims.width, height: rawDims.height });
    }
  }, [rawDims.width, rawDims.height, dims.width, dims.height]);
  const { width, height } = dims;

  const { chapters, loading, fetchChapters, updateChapter } = useChapterStore();
  const fullscreenScrollRef = useRef<ScrollView>(null);
  const carouselScrollRef = useRef<ScrollView>(null);
  const chromeAnim = useRef(new Animated.Value(0)).current;

  const [bookIndex, setBookIndex] = useState<number | null>(null);
  const [chromeVisible, setChromeVisible] = useState(false);
  const [tocView, setTocView] = useState<'books' | 'chapters'>('books');
  const [fontSheetOpen, setFontSheetOpen] = useState(false);
  const [pageIndex, setPageIndex] = useState(0);
  const [pagesByChapter, setPagesByChapter] = useState<Map<string, ChapterPage[]>>(new Map());
  // Interactive selection: one word, or a range dragged out between two words.
  const [selAnchor, setSelAnchor] = useState<number | null>(null);
  const [selFocus, setSelFocus] = useState<number | null>(null);
  const [popupPos, setPopupPos] = useState<{ x: number; y: number } | null>(null);
  // Read-only highlight for a page landed on via EditorScreen's "View in Reader" --
  // separate from selAnchor/selFocus so arriving here never triggers the action popup.
  const [highlightRange, setHighlightRange] = useState<{ start: number; end: number } | null>(null);
  const [prefs, setPrefs] = useState<ReaderPrefs>(DEFAULT_READER_PREFS);
  const [bookmarkedFlatIndex, setBookmarkedFlatIndex] = useState<number | null>(null);
  const [positionRequest, setPositionRequest] = useState(0);
  const lastHandledRequest = useRef(-1);
  const pendingChapterJump = useRef<string | null>(null);
  const wordRects = useRef<Map<number, WordRect>>(new Map());
  // Whether the in-flight long-press actually landed on a word. Held in a ref because the
  // gesture's own callbacks need it mid-drag, before any state update has re-rendered.
  const selectingRef = useRef(false);
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const tocPanelWidth = Math.min(width * 0.78, 360);
  const tocPanel = useSlidePanel(tocPanelWidth);

  // Immersive fullscreen for the whole time this screen is focused (not tied to the
  // in-app chrome toggle) -- OS status bar and, on Android, the nav/home-button bar too.
  // A swipe from the screen edge still reveals them momentarily (Android's own default
  // immersive behavior for a hidden nav bar), not a genuinely inescapable state.
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS === 'android') {
        NavigationBar.setVisibilityAsync('hidden');
      }
      return () => {
        if (Platform.OS === 'android') NavigationBar.setVisibilityAsync('visible');
      };
    }, []),
  );

  useEffect(() => {
    loadReaderPrefs().then(setPrefs);
  }, []);

  const fontSize = BASE_FONT_SIZE * prefs.fontScale;
  const lineHeight = BASE_LINE_HEIGHT * prefs.fontScale * prefs.lineSpacingScale;
  const proseFontFamily = resolveFontFamily(prefs.fontFamily);

  const pageContentWidth = width - PAGE_PAD_H * 2;
  const pageContentHeight = height - PAGE_PAD_TOP - PAGE_PAD_BOTTOM;
  const linesPerPage = Math.max(1, Math.floor(pageContentHeight / lineHeight));

  const carouselItemWidth = Math.round(width * CAROUSEL_ITEM_RATIO);
  const carouselSideInset = (width - carouselItemWidth) / 2;
  const carouselStride = carouselItemWidth + CAROUSEL_GAP;

  useEffect(() => {
    if (chapters.length === 0) fetchChapters(projectId);
  }, [projectId, chapters.length, fetchChapters]);

  const byBook = useMemo(() => {
    const map = new Map<number, Chapter[]>();
    for (const ch of chapters) {
      if (!map.has(ch.book)) map.set(ch.book, []);
      map.get(ch.book)!.push(ch);
    }
    for (const list of map.values()) list.sort((a, b) => a.act - b.act || a.order - b.order);
    return map;
  }, [chapters]);

  // If a specific chapter was requested (e.g. from EditorScreen's "Reader" button),
  // jump straight into its book. Otherwise -- opened from the menu's plain "Read" item
  // -- show the table of contents first and let the user pick, rather than guessing.
  useEffect(() => {
    if (bookIndex !== null || chapters.length === 0) return;
    if (chapterId) {
      const found = chapters.find((c) => c.id === chapterId);
      if (found) {
        setBookIndex(found.book);
        return;
      }
    }
    tocPanel.open();
  }, [chapters, chapterId]);

  // Once a book is open, the contents panel is a chapter list for THAT book -- that's the
  // useful question from inside a book, and it's what the ☰/▦ buttons and the edge swipe
  // all land on. Getting back to the whole-saga book list is an explicit step from there.
  useEffect(() => {
    if (bookIndex !== null) setTocView('chapters');
  }, [bookIndex]);

  const bookChapters = bookIndex === null ? [] : (byBook.get(bookIndex) ?? []);

  // Reset pagination whenever the book, geometry, or font/spacing prefs change --
  // pagination is a function of exact pixel line-height and glyph widths, so any of
  // those (including which font family is in use) invalidates it.
  useEffect(() => {
    setPagesByChapter(new Map());
  }, [bookIndex, pageContentWidth, pageContentHeight, fontSize, lineHeight, proseFontFamily]);

  function handleMeasured(cId: string, lines: { text: string }[], content: string) {
    setPagesByChapter((prev) => {
      if (prev.has(cId)) return prev;
      const pages = buildPagesFromLines(content, lines, linesPerPage);
      const next = new Map(prev);
      next.set(cId, pages);
      return next;
    });
  }

  const allMeasured = bookChapters.length > 0 && bookChapters.every((c) => pagesByChapter.has(c.id));

  const flatPages: FlatPage[] = useMemo(() => {
    if (!allMeasured) return [];
    const list: FlatPage[] = [];
    for (const chapter of bookChapters) {
      const chapterPages = pagesByChapter.get(chapter.id) ?? [];
      chapterPages.forEach((p, i) =>
        list.push({
          ...p,
          chapterId: chapter.id,
          chapterTitle: chapter.title,
          pageInChapter: i + 1,
          totalInChapter: chapterPages.length,
          bookPageNumber: 0, // filled in below once the whole list is built
        }),
      );
    }
    list.forEach((p, i) => {
      p.bookPageNumber = i + 1;
    });
    return list;
  }, [allMeasured, bookChapters, pagesByChapter]);

  const current = flatPages[pageIndex];
  const currentChapter = current ? chapters.find((c) => c.id === current.chapterId) : undefined;

  // Every chapter in the book, tokenized once -- the pages either side of the current one
  // are drawn word-by-word too (same line rows, so the layout doesn't shift when one
  // becomes current), and they can belong to a different chapter than the current page.
  const tokensByChapter = useMemo(() => {
    const map = new Map<string, ReturnType<typeof tokenizeWords>>();
    for (const chapter of bookChapters) map.set(chapter.id, tokenizeWords(chapter.content));
    return map;
  }, [bookChapters]);

  const currentChapterTokens = currentChapter ? tokensByChapter.get(currentChapter.id) ?? [] : [];

  const fullscreenFrom = Math.max(0, pageIndex - FULLSCREEN_WINDOW);
  const fullscreenTo = Math.min(flatPages.length - 1, pageIndex + FULLSCREEN_WINDOW);

  // Line/word breakdown for exactly the pages currently rendered, computed once per
  // window rather than on every render of every page.
  const windowLineWords = useMemo(() => {
    const map = new Map<string, LineWord[][]>();
    for (let i = fullscreenFrom; i <= fullscreenTo; i++) {
      const p = flatPages[i];
      if (p) map.set(`${p.chapterId}-${p.pageInChapter}`, buildLineWords(p, tokensByChapter.get(p.chapterId) ?? []));
    }
    return map;
  }, [flatPages, fullscreenFrom, fullscreenTo, tokensByChapter]);

  const currentLineWords = (current && windowLineWords.get(`${current.chapterId}-${current.pageInChapter}`)) || [];

  // Load this book's moving bookmark and resolve it to a flatPages index once pagination
  // is ready, so the "jump back" card knows how far the current view has drifted from it.
  useEffect(() => {
    if (bookIndex === null || !allMeasured) return;
    loadMovingBookmark(projectId, bookIndex).then((anchor) => {
      if (!anchor) {
        setBookmarkedFlatIndex(null);
        return;
      }
      const idx = flatPages.findIndex(
        (p) => p.chapterId === anchor.chapterId && anchor.charOffset >= p.startIndex && anchor.charOffset < p.endIndex,
      );
      setBookmarkedFlatIndex(idx === -1 ? null : idx);
    });
  }, [projectId, bookIndex, allMeasured, flatPages]);

  // Both pagers stay mounted (they cross-fade rather than swap), so both are kept in
  // sync at all times -- whichever one becomes visible is already on the right page.
  function scrollBothPagersTo(index: number, animated: boolean) {
    fullscreenScrollRef.current?.scrollTo({ x: index * width, animated });
    carouselScrollRef.current?.scrollTo({ x: index * carouselStride, animated });
  }

  function goToPage(index: number, animated = true) {
    if (index < 0 || index >= flatPages.length) return;
    setPageIndex(index);
    scrollBothPagersTo(index, animated);
  }

  useEffect(() => {
    requestAnimationFrame(() => scrollBothPagersTo(pageIndex, false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allMeasured]);

  // Positions the reader once pagination for the resolved book is ready. Runs exactly
  // once per explicit "position request" (initial route-driven resolution, or a TOC pick
  // -- see selectBookFromToc/selectChapterFromToc), never merely because pagination got
  // re-run for an unrelated reason (a font-size change, say) -- that would otherwise
  // yank the reader back to a bookmark every time a setting changed.
  useEffect(() => {
    if (bookIndex === null || !allMeasured || flatPages.length === 0) return;
    if (lastHandledRequest.current === positionRequest) return;
    lastHandledRequest.current = positionRequest;

    const explicitChapterId = pendingChapterJump.current;
    pendingChapterJump.current = null;

    (async () => {
      let targetIndex = 0;
      let highlight: { start: number; end: number } | null = null;

      if (explicitChapterId) {
        const idx = flatPages.findIndex((p) => p.chapterId === explicitChapterId);
        if (idx !== -1) targetIndex = idx;
      } else if (jumpToText && chapterId) {
        const chapter = chapters.find((c) => c.id === chapterId);
        // Every miss below used to leave targetIndex at 0, i.e. page one of the whole
        // BOOK, which is why a jump that failed for any reason looked like it had ignored
        // the chapter entirely. The chapter's own first page is the right fallback.
        const chapterFirstPage = flatPages.findIndex((p) => p.chapterId === chapterId);
        if (chapterFirstPage !== -1) targetIndex = chapterFirstPage;

        const idx = chapter ? findJumpOffset(chapter.content, jumpToText) : -1;
        if (chapter && idx !== -1) {
          const tokens = tokenizeWords(chapter.content);
          const startTok = tokens.findIndex((t) => t.start <= idx && t.end > idx);
          const endIdx = idx + jumpToText.length;
          const endTok = tokens.findIndex((t) => t.start < endIdx && t.end >= endIdx);
          const pages = pagesByChapter.get(chapterId) ?? [];
          // A page's endIndex is where its last line ends, so the whitespace between two
          // pages belongs to neither. An offset landing in one of those gaps matched no
          // page at all; falling back to the last page that starts at or before the offset
          // puts it on the right page instead of nowhere.
          let pageInChapter = pages.findIndex((p) => idx >= p.startIndex && idx < p.endIndex);
          if (pageInChapter === -1) {
            for (let i = 0; i < pages.length; i += 1) {
              if (pages[i].startIndex <= idx) pageInChapter = i;
            }
          }
          if (pageInChapter !== -1) {
            const foundFlatIndex = flatPages.findIndex(
              (p) => p.chapterId === chapterId && p.pageInChapter === pageInChapter + 1,
            );
            if (foundFlatIndex !== -1) targetIndex = foundFlatIndex;
          }
          if (startTok !== -1 && endTok !== -1) highlight = { start: startTok, end: endTok };
        }
      } else if (chapterId) {
        const idx = flatPages.findIndex((p) => p.chapterId === chapterId);
        if (idx !== -1) targetIndex = idx;
      } else {
        // No explicit target -- resume wherever this book's moving bookmark left off.
        const anchor = await loadMovingBookmark(projectId, bookIndex);
        if (anchor) {
          const idx = flatPages.findIndex(
            (p) => p.chapterId === anchor.chapterId && anchor.charOffset >= p.startIndex && anchor.charOffset < p.endIndex,
          );
          if (idx !== -1) targetIndex = idx;
        }
      }

      setPageIndex(targetIndex);
      setHighlightRange(highlight);
      requestAnimationFrame(() => scrollBothPagersTo(targetIndex, false));
    })();
  }, [bookIndex, allMeasured, flatPages, positionRequest]);

  // Selection/highlight and the measured word geometry all belong to one specific page.
  useEffect(() => {
    wordRects.current = new Map();
    setSelAnchor(null);
    setSelFocus(null);
    setPopupPos(null);
    setHighlightRange(null);
  }, [current?.chapterId, current?.startIndex]);

  function toggleChrome() {
    const next = !chromeVisible;
    setChromeVisible(next);
    Animated.timing(chromeAnim, { toValue: next ? 1 : 0, duration: 260, useNativeDriver: true }).start();
  }

  function clearSelection() {
    setSelAnchor(null);
    setSelFocus(null);
    setPopupPos(null);
  }

  // Plain tap: dismiss an active selection if there is one, otherwise toggle chrome.
  function tapPage() {
    if (selAnchor !== null || highlightRange) {
      clearSelection();
      setHighlightRange(null);
      return;
    }
    toggleChrome();
  }

  const registerWordRect = useCallback((tokenIndex: number, rect: WordRect) => {
    wordRects.current.set(tokenIndex, rect);
  }, []);

  // Which word sits under a point in the prose column's own coordinate space. Vertical
  // position picks the line (every line row is exactly lineHeight tall), horizontal
  // position picks the word within it; a point past either end of a line clamps to that
  // line's first/last word so dragging into the margin still extends predictably.
  const hitTestToken = useCallback(
    (pageX: number, pageY: number): number | null => {
      if (currentLineWords.length === 0) return null;
      // Gesture coordinates arrive relative to the whole page; the prose column starts
      // inside the page's padding.
      const x = pageX - PAGE_PAD_H;
      const y = pageY - PAGE_PAD_TOP;
      const lineIndex = Math.min(currentLineWords.length - 1, Math.max(0, Math.floor(y / lineHeight)));
      // Blank lines (paragraph breaks) hold no words -- walk outward to the nearest line
      // that does, so a drag across a break doesn't stall.
      let words: LineWord[] = currentLineWords[lineIndex];
      for (let offset = 1; words.length === 0 && offset < currentLineWords.length; offset++) {
        words = currentLineWords[lineIndex - offset] ?? currentLineWords[lineIndex + offset] ?? [];
      }
      if (words.length === 0) return null;

      let best: number | null = null;
      for (const w of words) {
        const rect = wordRects.current.get(w.tokenIndex);
        if (!rect) continue;
        if (x >= rect.x && x <= rect.x + rect.width) return w.tokenIndex;
        if (best === null || x > rect.x) best = w.tokenIndex;
      }
      return best ?? words[0].tokenIndex;
    },
    [currentLineWords, lineHeight],
  );

  // Long-press to begin, keep dragging to extend. runOnJS keeps the callbacks on the JS
  // thread so they can drive React state directly; activateAfterLongPress is what lets
  // this claim the gesture from the paging ScrollView, so the page no longer slides away
  // the moment the finger moves.
  const selectGesture = Gesture.Pan()
    .activateAfterLongPress(SELECT_LONG_PRESS_MS)
    .runOnJS(true)
    .onStart((e) => {
      const token = hitTestToken(e.x, e.y);
      selectingRef.current = token !== null;
      if (token === null) return;
      setHighlightRange(null);
      setSelAnchor(token);
      setSelFocus(token);
      setPopupPos(null);
    })
    .onUpdate((e) => {
      if (!selectingRef.current) return;
      const token = hitTestToken(e.x, e.y);
      if (token !== null) setSelFocus(token);
    })
    .onEnd((e) => {
      if (!selectingRef.current) return;
      selectingRef.current = false;
      setPopupPos({ x: e.absoluteX, y: e.absoluteY });
    });

  const tapGesture = Gesture.Tap().runOnJS(true).onEnd(tapPage);
  const pageGesture = Gesture.Exclusive(selectGesture, tapGesture);

  function openContents() {
    tocPanel.open();
  }

  function selectBookFromToc(index: number) {
    tocPanel.close();
    pendingChapterJump.current = null;
    setPositionRequest((r) => r + 1);
    setBookIndex(index);
    setPageIndex(0);
  }

  function selectChapterFromToc(cId: string, book: number) {
    tocPanel.close();
    pendingChapterJump.current = cId;
    setPositionRequest((r) => r + 1);
    setBookIndex(book);
    setPageIndex(0);
  }

  function updatePrefs(patch: Partial<ReaderPrefs>) {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    saveReaderPrefs(next);
  }

  const selStart = selAnchor !== null && selFocus !== null ? Math.min(selAnchor, selFocus) : null;
  const selEnd = selAnchor !== null && selFocus !== null ? Math.max(selAnchor, selFocus) : null;
  const selectedText =
    selStart !== null && selEnd !== null && currentChapterTokens[selStart] && currentChapterTokens[selEnd] && currentChapter
      ? currentChapter.content.slice(currentChapterTokens[selStart].start, currentChapterTokens[selEnd].end)
      : null;
  const selectedCharOffset = selStart !== null ? currentChapterTokens[selStart]?.start ?? null : null;

  function viewInEditor() {
    if (!selectedText || !current) return;
    const text = selectedText;
    const targetChapterId = current.chapterId;
    clearSelection();
    navigation.navigate('Editor', { chapterId: targetChapterId, jumpToText: text });
  }

  async function copySelection() {
    if (!selectedText) return;
    await Clipboard.setStringAsync(selectedText);
    clearSelection();
  }

  async function shareSelection() {
    if (!selectedText) return;
    try {
      await Share.share({ message: selectedText });
    } catch {
      // user dismissed the share sheet -- nothing to do
    }
    clearSelection();
  }

  async function pinSelection() {
    if (!selectedText || !current || selectedCharOffset === null) return;
    await addPinnedBookmark(projectId, { chapterId: current.chapterId, charOffset: selectedCharOffset, text: selectedText });
    clearSelection();
    Alert.alert('Pinned', 'Saved this passage as a pinned bookmark.');
  }

  async function toggleMovingBookmark() {
    if (bookIndex === null || !current) return;
    if (bookmarkedFlatIndex === pageIndex) {
      setBookmarkedFlatIndex(null);
      await saveMovingBookmark(projectId, bookIndex, { chapterId: '', charOffset: -1 });
      return;
    }
    await saveMovingBookmark(projectId, bookIndex, { chapterId: current.chapterId, charOffset: current.startIndex });
    setBookmarkedFlatIndex(pageIndex);
  }

  // Every annotation in the current chapter, resolved to token indices. Annotations are
  // stored by the exact substring, not an offset (handoff doc §3.5), so they are located by
  // searching the prose, and every occurrence of that substring is marked, not just the
  // first.
  //
  // One resolver for all of them rather than one per type: highlights, plants and reveals
  // differ in what they mean and how they are drawn, not in how they are found.
  const annotationSpans = useMemo(() => {
    if (!currentChapter) return [] as ReaderSpan[];
    const spans: ReaderSpan[] = [];
    for (const annotation of currentChapter.annotations) {
      if (!annotation.text) continue;
      if (annotation.type === 'note') continue; // no inline appearance of its own
      let from = 0;
      for (;;) {
        const charStart = currentChapter.content.indexOf(annotation.text, from);
        if (charStart === -1) break;
        const charEnd = charStart + annotation.text.length;
        let start = -1;
        let end = -1;
        for (let i = 0; i < currentChapterTokens.length; i += 1) {
          const token = currentChapterTokens[i];
          if (token.end <= charStart) continue;
          if (token.start >= charEnd) break;
          if (start === -1) start = i;
          end = i;
        }
        if (start !== -1) {
          spans.push({
            id: annotation.id,
            type: annotation.type as ReaderSpan['type'],
            label: annotation.label ?? '',
            pairLabel: (annotation as { pairLabel?: string }).pairLabel ?? '',
            text: annotation.text,
            start,
            end,
          });
        }
        from = charEnd;
      }
    }
    return spans;
  }, [currentChapter, currentChapterTokens]);

  const highlightSpans = useMemo(
    () => annotationSpans.filter((span) => span.type === 'highlight'),
    [annotationSpans],
  );

  // A token set per kind, because the page renderer works token by token and a Set lookup
  // is the only thing cheap enough to run per word per frame.
  const markedTokens = useMemo(() => {
    const of = (type: ReaderSpan['type']) => {
      const marked = new Set<number>();
      for (const span of annotationSpans) {
        if (span.type !== type) continue;
        for (let i = span.start; i <= span.end; i += 1) marked.add(i);
      }
      return marked;
    };
    return { highlight: of('highlight'), plant: of('plant'), reveal: of('reveal') };
  }, [annotationSpans]);

  // Bundled once rather than rebuilt inline per page: this is passed to every rendered page
  // and a fresh object each time defeats the memoisation on them.
  const markStyles = useMemo(
    () => ({ highlight: styles.highlighted, plant: styles.plantMark, reveal: styles.revealMark }),
    [styles],
  );

  const flagCounts = useMemo(
    () => ({
      plants: annotationSpans.filter((s) => s.type === 'plant').length,
      reveals: annotationSpans.filter((s) => s.type === 'reveal').length,
    }),
    [annotationSpans],
  );

  // What the selection is sitting on. Read-only here: the Reader shows flags, it does not
  // make them, so this drives an explanation rather than an edit.
  const selectedFlags = useMemo(
    () =>
      selStart === null || selEnd === null
        ? []
        : annotationSpans.filter(
            (span) =>
              span.type !== 'highlight' && span.start <= selEnd && span.end >= selStart,
          ),
    [annotationSpans, selStart, selEnd],
  );

  // Which highlights the current selection touches -- drives both the icon's state and
  // what removing does.
  const overlappingHighlights = useMemo(
    () =>
      selStart === null || selEnd === null
        ? []
        : highlightSpans.filter((span) => span.start <= selEnd && span.end >= selStart),
    [highlightSpans, selStart, selEnd],
  );
  const selectionHighlighted = overlappingHighlights.length > 0;

  function toggleHighlight() {
    if (!selectedText || !currentChapter) return;
    if (selectionHighlighted) {
      // Removing clears every highlight the selection touches, not just one fully
      // enclosing it -- otherwise selecting across two adjacent highlights would leave
      // the marker looking on with nothing to un-mark.
      const removing = new Set(overlappingHighlights.map((span) => span.id));
      updateChapter(currentChapter.id, {
        annotations: currentChapter.annotations.filter((a) => !removing.has(a.id)),
      });
    } else {
      const annotation: Annotation = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        type: 'highlight',
        text: selectedText,
        label: '',
      };
      updateChapter(currentChapter.id, { annotations: [...currentChapter.annotations, annotation] });
    }
    clearSelection();
  }

  const showChoosingBook = bookIndex === null;
  const showLoading = !showChoosingBook && (loading || !allMeasured);
  const overallProgress = flatPages.length > 0 ? Math.round(((pageIndex + 1) / flatPages.length) * 100) : 0;
  // Only shown alongside the rest of the chrome (search/Aa/etc) -- not floating over
  // every single page turn regardless of whether the chrome is even visible.
  const showJumpBack = chromeVisible && bookmarkedFlatIndex !== null && bookmarkedFlatIndex !== pageIndex && !!flatPages[bookmarkedFlatIndex];
  const isBookmarked = bookmarkedFlatIndex === pageIndex;

  const carouselFrom = Math.max(0, pageIndex - CAROUSEL_WINDOW);
  const carouselTo = Math.min(flatPages.length - 1, pageIndex + CAROUSEL_WINDOW);

  const proseStyle = { fontSize, lineHeight, fontFamily: proseFontFamily, color: colors.text };
  const showPages = !showChoosingBook && !showLoading && flatPages.length > 0;

  return (
    <View style={styles.screen}>
      <StatusBar hidden animated />

      {/* Off-screen measurers -- one per chapter in the current book, invisible but laid
          out at the exact page width/font so onTextLayout reports real wrap points. */}
      {bookIndex !== null &&
        bookChapters.map((chapter) => (
          <Text
            key={`${chapter.id}:${pageContentWidth}x${pageContentHeight}:${fontSize}x${lineHeight}:${proseFontFamily}:${chapter.content.length}`}
            style={[styles.measurer, { width: pageContentWidth, fontSize, lineHeight, fontFamily: proseFontFamily }]}
            onTextLayout={(e) => handleMeasured(chapter.id, e.nativeEvent.lines as unknown as { text: string }[], chapter.content)}
          >
            {chapter.content || ' '}
          </Text>
        ))}

      {showChoosingBook ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>Choose a book to start reading.</Text>
        </View>
      ) : showLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.gold} />
        </View>
      ) : flatPages.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>No chapters in this book yet.</Text>
        </View>
      ) : null}

      {showPages && (
        <>
          {/* Fullscreen: one page, edge to edge. Scales/fades out as the chrome comes in
              rather than being unmounted, which is what makes that toggle read as a zoom. */}
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              {
                opacity: chromeAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
                transform: [{ scale: chromeAnim.interpolate({ inputRange: [0, 1], outputRange: [1, CAROUSEL_ITEM_RATIO] }) }],
              },
            ]}
            pointerEvents={chromeVisible ? 'none' : 'auto'}
          >
            <ScrollView
              ref={fullscreenScrollRef}
              horizontal
              pagingEnabled
              decelerationRate="fast"
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(e) => setPageIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
            >
              <View style={{ width: fullscreenFrom * width }} />
              {flatPages.slice(fullscreenFrom, fullscreenTo + 1).map((page, offset) => {
                const i = fullscreenFrom + offset;
                const isCurrent = i === pageIndex;
                const pageBody = (
                  <View style={styles.pageContent}>
                    {page.pageInChapter === 1 && (
                      <Text style={[styles.pageHeading, { fontFamily: proseFontFamily }]} numberOfLines={1}>
                        {page.chapterTitle}
                      </Text>
                    )}
                    <PageProse
                      page={page}
                      lineWords={windowLineWords.get(`${page.chapterId}-${page.pageInChapter}`) ?? EMPTY_LINE_WORDS}
                      lineHeight={lineHeight}
                      align={prefs.textAlign}
                      proseStyle={proseStyle}
                      selStart={isCurrent ? selStart : null}
                      selEnd={isCurrent ? selEnd : null}
                      highlightRange={isCurrent ? highlightRange : null}
                      // Saved highlights are drawn on every rendered page, not just the
                      // current one -- they belong to the text, not to the selection.
                      markedTokens={page.chapterId === current?.chapterId ? markedTokens : EMPTY_MARKS}
                      onRegisterWord={isCurrent ? registerWordRect : null}
                      selectedStyle={styles.selected}
                      markStyles={markStyles}
                    />
                    <Text style={styles.pageNumber}>{page.bookPageNumber}</Text>
                    {isCurrent && (
                      <Pressable style={styles.bookmarkCorner} onPress={toggleMovingBookmark} hitSlop={6}>
                        {isBookmarked && <Icon name="bookmark-filled" size={20} color={colors.gold} />}
                      </Pressable>
                    )}
                  </View>
                );
                return (
                  <View key={`${page.chapterId}-${page.pageInChapter}`} style={{ width, height }}>
                    {isCurrent ? <GestureDetector gesture={pageGesture}>{pageBody}</GestureDetector> : pageBody}
                  </View>
                );
              })}
              <View style={{ width: Math.max(0, flatPages.length - 1 - fullscreenTo) * width }} />
            </ScrollView>
          </Animated.View>

          {/* Carousel: prev/current/next pages peek side by side, chrome visible around
              them. Fades/scales in from the fullscreen page's own size. */}
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              {
                opacity: chromeAnim,
                transform: [{ scale: chromeAnim.interpolate({ inputRange: [0, 1], outputRange: [1 / CAROUSEL_ITEM_RATIO, 1] }) }],
              },
            ]}
            pointerEvents={chromeVisible ? 'auto' : 'none'}
          >
            <ScrollView
              ref={carouselScrollRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              decelerationRate="fast"
              snapToInterval={carouselStride}
              snapToAlignment="start"
              contentContainerStyle={{ paddingHorizontal: carouselSideInset, paddingTop: 110, paddingBottom: 130 }}
              onMomentumScrollEnd={(e) => setPageIndex(Math.round(e.nativeEvent.contentOffset.x / carouselStride))}
            >
              <View style={{ width: carouselFrom * carouselStride }} />
              {flatPages.slice(carouselFrom, carouselTo + 1).map((page, offset) => {
                const i = carouselFrom + offset;
                const isCurrent = i === pageIndex;
                return (
                  <Pressable
                    key={`${page.chapterId}-${page.pageInChapter}`}
                    style={[
                      styles.carouselCard,
                      { width: carouselItemWidth, marginRight: CAROUSEL_GAP },
                      isCurrent && styles.carouselCardActive,
                    ]}
                    onPress={() => (isCurrent ? toggleChrome() : goToPage(i))}
                  >
                    {page.pageInChapter === 1 && (
                      <Text style={styles.carouselHeading} numberOfLines={1}>{page.chapterTitle}</Text>
                    )}
                    <Text
                      style={[styles.pageProse, styles.carouselProse, { fontFamily: proseFontFamily, textAlign: prefs.textAlign }]}
                      numberOfLines={14}
                    >
                      {page.text}
                    </Text>
                    <Text style={styles.carouselPageNumber}>{page.bookPageNumber}</Text>
                    {isCurrent && bookmarkedFlatIndex === i && (
                      <View style={styles.carouselRibbon}>
                        <Icon name="bookmark-filled" size={16} color={colors.gold} />
                      </View>
                    )}
                  </Pressable>
                );
              })}
              <View style={{ width: Math.max(0, flatPages.length - 1 - carouselTo) * carouselStride }} />
            </ScrollView>
          </Animated.View>
        </>
      )}

      <Animated.View style={[styles.header, { opacity: chromeAnim }]} pointerEvents={chromeVisible ? 'auto' : 'none'}>
        <View style={styles.headerRow}>
          <Pressable style={styles.iconBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.iconBtnText}>‹</Text>
          </Pressable>
          <Pressable style={styles.iconBtn} onPress={openContents}>
            <Text style={styles.iconBtnText}>☰</Text>
          </Pressable>
          <Pressable
            style={[styles.iconBtn, styles.iconBtnBordered]}
            onPress={() => navigation.navigate('Search', { projectId })}
          >
            <Icon name="search" size={17} color={colors.gold} />
          </Pressable>
          <Pressable
            style={[styles.iconBtn, styles.iconBtnBordered]}
            onPress={() =>
              navigation.navigate('CharacterWeb', {
                projectId,
                // Opens on this chapter's own moment instead of the whole saga at once.
                focusChapterId: current?.chapterId,
              })
            }
          >
            <Icon name="link" size={17} color={colors.gold} />
          </Pressable>
          <Pressable style={[styles.iconBtn, styles.iconBtnBordered]} onPress={() => setFontSheetOpen(true)}>
            <Text style={styles.iconBtnAa}>Aa</Text>
          </Pressable>
        </View>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {projectName || (bookIndex !== null ? BOOKS[bookIndex] : '')}
        </Text>
      </Animated.View>

      {/* Read-only, and deliberately not a control: the Reader shows flags, the Editor
          makes them. Sits under the action bar so selecting a tinted passage explains the
          tint instead of leaving the reader to guess what green meant. */}
      {popupPos && selectedText && selectedFlags.length > 0 && (
        <View
          style={[
            styles.flagCaption,
            {
              top: Math.max(60, popupPos.y - 56) + 46,
              left: Math.min(Math.max(8, popupPos.x - 110), width - 228),
            },
          ]}
        >
          {selectedFlags.map((flag) => (
            <View key={flag.id} style={styles.flagCaptionRow}>
              <Text
                style={[
                  styles.flagCaptionKind,
                  { color: flag.type === 'plant' ? PLANT_INK : REVEAL_INK },
                ]}
              >
                {flag.type === 'plant' ? '🌱 Plant' : '⚡ Reveal'}
              </Text>
              <Text style={styles.flagCaptionText} numberOfLines={3}>
                {flag.pairLabel || flag.label || 'No description recorded for this one yet.'}
              </Text>
            </View>
          ))}
        </View>
      )}

      {popupPos && selectedText && (
        <View
          style={[
            styles.actionBar,
            {
              top: Math.max(60, popupPos.y - 56),
              left: Math.min(Math.max(8, popupPos.x - 110), width - 228),
            },
          ]}
        >
          {/* Icon-only, and one control rather than two: a hollow marker means this text
              carries no highlight, a solid one means it does and tapping clears it. */}
          <Pressable style={styles.actionBtn} onPress={toggleHighlight}>
            <Icon
              name={selectionHighlighted ? 'marker-filled' : 'marker'}
              size={19}
              color={selectionHighlighted ? HIGHLIGHT_INK : colors.gold}
            />
          </Pressable>
          <Pressable style={styles.actionBtn} onPress={copySelection}>
            <Icon name="copy" size={17} color={colors.gold} />
            <Text style={styles.actionBtnLabel}>Copy</Text>
          </Pressable>
          <Pressable style={styles.actionBtn} onPress={pinSelection}>
            <Icon name="pin" size={17} color={colors.gold} />
            <Text style={styles.actionBtnLabel}>Pin</Text>
          </Pressable>
          <Pressable style={styles.actionBtn} onPress={shareSelection}>
            <Icon name="share" size={17} color={colors.gold} />
            <Text style={styles.actionBtnLabel}>Share</Text>
          </Pressable>
          <Pressable style={styles.actionBtn} onPress={viewInEditor}>
            <Icon name="pencil" size={17} color={colors.gold} />
            <Text style={styles.actionBtnLabel}>Editor</Text>
          </Pressable>
        </View>
      )}

      {showJumpBack && (
        <Pressable style={styles.jumpBackCard} onPress={() => goToPage(bookmarkedFlatIndex!)}>
          <View style={styles.jumpBackThumb}>
            <Text style={styles.jumpBackThumbText} numberOfLines={4}>
              {flatPages[bookmarkedFlatIndex!].text}
            </Text>
          </View>
          <Text style={styles.jumpBackLabel}>Back to{'\n'}Page {bookmarkedFlatIndex! + 1}</Text>
        </Pressable>
      )}

      <Animated.View style={[styles.footer, { opacity: chromeAnim }]} pointerEvents={chromeVisible ? 'auto' : 'none'}>
        <Text style={styles.footerChapter} numberOfLines={1}>
          {current?.chapterTitle ?? ''}
        </Text>
        <Text style={styles.footerMeta}>
          {current ? `Page ${pageIndex + 1} of ${flatPages.length} · ${overallProgress}%` : ''}
        </Text>
        {/* Shown only when this chapter actually has flags in it, because otherwise it is a
            legend for two colours that are not on screen. */}
        {flagCounts.plants + flagCounts.reveals > 0 && (
          <View style={styles.legendRow}>
            <View style={[styles.legendSwatch, { backgroundColor: PLANT_TINT }]} />
            <Text style={styles.legendText}>{flagCounts.plants} plant{flagCounts.plants === 1 ? '' : 's'}</Text>
            <View style={[styles.legendSwatch, { backgroundColor: REVEAL_TINT }]} />
            <Text style={styles.legendText}>{flagCounts.reveals} reveal{flagCounts.reveals === 1 ? '' : 's'}</Text>
          </View>
        )}
        <View style={styles.scrubberRow}>
          <Pressable style={styles.iconBtn} onPress={openContents}>
            <Text style={styles.iconBtnText}>▦</Text>
          </Pressable>
          <Slider
            style={{ flex: 1 }}
            minimumValue={0}
            maximumValue={Math.max(0, flatPages.length - 1)}
            step={1}
            value={pageIndex}
            minimumTrackTintColor={colors.gold}
            maximumTrackTintColor={colors.border}
            thumbTintColor={colors.gold}
            onSlidingComplete={(v) => goToPage(Math.round(v), false)}
          />
        </View>
      </Animated.View>

      {/* An edge swipe opens the contents panel from anywhere in the Reader, and can
          reopen it as many times as you like -- previously the panel could only ever be
          shown by a button, so once swiped away mid-read there was no gesture to get it
          back. */}
      <EdgeSwipeZone controller={tocPanel} />
      <View pointerEvents="none" style={[styles.dimmer, { opacity: prefs.dimOpacity }]} />

      <SlidePanel controller={tocPanel} width={tocPanelWidth}>
        <View style={styles.tocInner}>
          {tocView === 'chapters' && bookIndex !== null ? (
            <>
              <Pressable style={styles.tocBackRow} onPress={() => setTocView('books')}>
                <Text style={styles.tocBackText}>‹ All books</Text>
              </Pressable>
              <Text style={styles.tocTitle}>{BOOKS[bookIndex] ?? 'Contents'}</Text>
              <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
                {(byBook.get(bookIndex) ?? []).map((c, i) => (
                  <Pressable
                    key={c.id}
                    style={styles.tocChapterRow}
                    onPress={() => selectChapterFromToc(c.id, bookIndex)}
                  >
                    <Text style={styles.tocChapterNumber}>{i + 1}</Text>
                    <Text
                      style={[styles.tocChapterTitle, c.id === current?.chapterId && styles.tocChapterTitleActive]}
                      numberOfLines={2}
                    >
                      {c.title}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </>
          ) : (
            <>
              <Text style={styles.tocTitle}>{projectName || 'Contents'}</Text>
              <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
                {BOOKS.map((name, i) => {
                  const bookChs = byBook.get(i) ?? [];
                  if (bookChs.length === 0) return null;
                  return (
                    <Pressable key={i} style={styles.tocBookMain} onPress={() => selectBookFromToc(i)}>
                      <Text style={styles.tocBookTitle}>{name}</Text>
                      <Text style={styles.tocBookMeta}>
                        {bookChs.length} chapter{bookChs.length === 1 ? '' : 's'}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </>
          )}
        </View>
      </SlidePanel>


      {/* Font/Layout -- size, line spacing, alignment, a curated font-family choice (kept
          to the app's own already-loaded families -- see FONT_FAMILY_OPTIONS above, not a
          generic serif picker), and an in-app reading dimmer. Real device brightness now
          lives in Settings instead (see SettingsScreen) -- it's an account-wide control,
          not specific to reading. */}
      <Modal visible={fontSheetOpen} transparent animationType="slide" onRequestClose={() => setFontSheetOpen(false)}>
        <Pressable style={styles.sheetOverlay} onPress={() => setFontSheetOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.sheetTitle}>Font & Layout</Text>

            <Text style={styles.sheetLabel}>Font</Text>
            <View style={styles.optionRow}>
              {FONT_FAMILY_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.key}
                  style={[styles.fontOption, prefs.fontFamily === opt.key && styles.optionActive]}
                  onPress={() => updatePrefs({ fontFamily: opt.key })}
                >
                  <Text style={[styles.fontOptionAa, { fontFamily: opt.family }]}>Aa</Text>
                  <Text style={styles.fontOptionLabel}>{opt.label}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.sheetLabel}>Alignment</Text>
            <View style={styles.optionRow}>
              {ALIGN_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.key}
                  style={[styles.alignOption, prefs.textAlign === opt.key && styles.optionActive]}
                  onPress={() => updatePrefs({ textAlign: opt.key })}
                >
                  <Icon name={opt.icon} size={18} color={prefs.textAlign === opt.key ? colors.gold : colors.textFaint} />
                </Pressable>
              ))}
            </View>

            <Text style={styles.sheetLabel}>Text size</Text>
            <Slider
              minimumValue={0.8}
              maximumValue={1.5}
              value={prefs.fontScale}
              minimumTrackTintColor={colors.gold}
              maximumTrackTintColor={colors.border}
              thumbTintColor={colors.gold}
              onSlidingComplete={(v) => updatePrefs({ fontScale: v })}
            />
            <Text style={styles.sheetLabel}>Line spacing</Text>
            <Slider
              minimumValue={0.9}
              maximumValue={1.4}
              value={prefs.lineSpacingScale}
              minimumTrackTintColor={colors.gold}
              maximumTrackTintColor={colors.border}
              thumbTintColor={colors.gold}
              onSlidingComplete={(v) => updatePrefs({ lineSpacingScale: v })}
            />
            <Text style={styles.sheetLabel}>Reading dimmer</Text>
            <Slider
              minimumValue={0}
              maximumValue={0.6}
              value={prefs.dimOpacity}
              minimumTrackTintColor={colors.gold}
              maximumTrackTintColor={colors.border}
              thumbTintColor={colors.gold}
              onSlidingComplete={(v) => updatePrefs({ dimOpacity: v })}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

// A page drawn one line at a time. Each line is a fixed-height row of individually-laid-
// out words, which reproduces the wrapping the off-screen measurer computed while giving
// every word a real measured rectangle (reported through onRegisterWord) for the
// drag-selection hit test. Rendering per line is also what makes genuine justification
// possible -- a justified row distributes its words with space-between, except on the
// line that ends a paragraph.
const PageProse = memo(function PageProse({
  page,
  lineWords,
  lineHeight,
  align,
  proseStyle,
  selStart,
  selEnd,
  highlightRange,
  markedTokens,
  onRegisterWord,
  selectedStyle,
  markStyles,
}: {
  page: ChapterPage;
  lineWords: LineWord[][];
  lineHeight: number;
  align: ReaderTextAlign;
  proseStyle: { fontSize: number; lineHeight: number; fontFamily: string; color: string };
  selStart: number | null;
  selEnd: number | null;
  highlightRange: { start: number; end: number } | null;
  markedTokens: MarkedTokens;
  onRegisterWord: ((tokenIndex: number, rect: WordRect) => void) | null;
  selectedStyle: object;
  markStyles: Record<keyof MarkedTokens, object>;
}) {
  return (
    <View style={{ flex: 1 }}>
      {lineWords.map((words, lineIndex) => {
        const line = page.lines[lineIndex];
        const justified = align === 'justify' && !line?.endsParagraph && words.length > 1;
        return (
          <View
            key={lineIndex}
            style={{
              height: lineHeight,
              flexDirection: 'row',
              justifyContent: justified
                ? 'space-between'
                : align === 'center'
                  ? 'center'
                  : align === 'right'
                    ? 'flex-end'
                    : 'flex-start',
            }}
          >
            {words.map((w, wordIndex) => {
              const selected =
                (selStart !== null && selEnd !== null && w.tokenIndex >= selStart && w.tokenIndex <= selEnd) ||
                (highlightRange !== null && w.tokenIndex >= highlightRange.start && w.tokenIndex <= highlightRange.end);
              // Marks sit under the live selection: several can apply to one word, and the
              // selection tint is listed last so it wins where they overlap. A plant and a
              // reveal cannot overlap in practice -- the build guards against it -- but if
              // they ever did, the later tint simply wins rather than anything breaking.
              return (
                <Text
                  key={w.tokenIndex}
                  style={[
                    proseStyle,
                    markedTokens.plant.has(w.tokenIndex) && markStyles.plant,
                    markedTokens.reveal.has(w.tokenIndex) && markStyles.reveal,
                    markedTokens.highlight.has(w.tokenIndex) && markStyles.highlight,
                    selected && selectedStyle,
                  ]}
                  onLayout={
                    onRegisterWord
                      ? (e) =>
                          onRegisterWord(w.tokenIndex, {
                            line: lineIndex,
                            x: e.nativeEvent.layout.x,
                            width: e.nativeEvent.layout.width,
                          })
                      : undefined
                  }
                >
                  {justified || wordIndex === words.length - 1 ? w.text : `${w.text} `}
                </Text>
              );
            })}
          </View>
        );
      })}
    </View>
  );
});

function makeStyles(colors: ThemeColors) {
  const chromeBg = withOpacity(colors.bg, 0.94);
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    emptyText: { color: colors.textDim, fontSize: 13 },
    measurer: { position: 'absolute', left: -9999, top: 0, opacity: 0, fontFamily: FONTS.literary },
    // The actual page surface -- this is the one place day/night really shows up in the
    // Reader, since it's real book prose, not app chrome.
    pageContent: {
      flex: 1,
      paddingHorizontal: PAGE_PAD_H,
      paddingTop: PAGE_PAD_TOP,
      paddingBottom: PAGE_PAD_BOTTOM,
      backgroundColor: colors.bg,
    },
    pageProse: { color: colors.text, fontFamily: FONTS.literary },
    // Words are laid out individually so drag-selection has a rectangle per word to
    // hit-test, which means a tinted word paints only as wide as its glyphs and a run of
    // them comes out striped -- worst under justification, where the gaps are widest.
    // Padding the tint outward while pulling the same amount back in as margin closes
    // those gaps without moving a single word.
    selected: { backgroundColor: SELECTION_TINT, ...TINT_BLEED },
    highlighted: { backgroundColor: HIGHLIGHT_TINT, ...TINT_BLEED },
    // Read-only marks. Tinted rather than underlined because an underline at reading size
    // fights the descenders, and because these are the same two colours the character web
    // uses for the same two things.
    plantMark: { backgroundColor: PLANT_TINT, ...TINT_BLEED },
    revealMark: { backgroundColor: REVEAL_TINT, ...TINT_BLEED },
    flagCaption: {
      position: 'absolute',
      maxWidth: 260,
      gap: 6,
      paddingVertical: 8,
      paddingHorizontal: 11,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.borderDim,
      backgroundColor: colors.panel,
    },
    flagCaptionRow: { gap: 2 },
    flagCaptionKind: { fontFamily: FONTS.bodySemiBold, fontSize: 11 },
    flagCaptionText: { color: colors.textDim, fontSize: 12, lineHeight: 16 },
    legendRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 5 },
    legendSwatch: { width: 11, height: 11, borderRadius: 3 },
    legendText: { color: colors.textFaint, fontSize: 10.5, marginRight: 6 },
    // Always-visible chapter heading, independent of the toggleable chrome. fontFamily is
    // overridden inline to whatever reading font is currently selected so it always
    // matches the prose.
    pageHeading: {
      position: 'absolute',
      top: HEADING_TOP,
      left: PAGE_PAD_H,
      right: PAGE_PAD_H,
      textAlign: 'center',
      color: colors.textDim,
      fontSize: HEADING_FONT_SIZE,
    },
    pageNumber: {
      position: 'absolute',
      bottom: 16,
      left: 0,
      right: 0,
      textAlign: 'center',
      color: colors.textFaint,
      fontFamily: FONTS.mono,
      fontSize: 11,
    },
    // Tap the top-right corner of a page to bookmark it, tap again to remove -- no
    // separate header button. Generous hit target even though the icon itself only shows
    // up once bookmarked.
    bookmarkCorner: {
      position: 'absolute',
      top: 14,
      right: 14,
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    carouselCard: {
      backgroundColor: colors.bg,
      borderRadius: 4,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      height: '100%',
    },
    carouselCardActive: {
      borderWidth: 2,
      borderColor: colors.gold,
      shadowColor: '#000',
      shadowOpacity: 0.5,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 8,
    },
    carouselHeading: {
      color: colors.textFaint,
      fontFamily: FONTS.mono,
      fontSize: 9,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 8,
      textAlign: 'center',
    },
    carouselProse: { fontSize: 11, lineHeight: 16 },
    carouselPageNumber: { color: colors.textFaint, fontFamily: FONTS.mono, fontSize: 9.5, textAlign: 'center', marginTop: 8 },
    carouselRibbon: { position: 'absolute', top: 6, right: 8 },
    header: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      paddingTop: 44,
      paddingBottom: 10,
      paddingHorizontal: 12,
      // Translucent band of the CURRENT theme's own bg -- this is what makes it read as
      // beige-on-cream in day mode and dark-on-dark in night mode, rather than a fixed
      // dark overlay regardless of theme.
      backgroundColor: chromeBg,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    iconBtn: {
      width: 38,
      height: 38,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    // Search/bookmark/Aa specifically get a gold ring with nothing filling it in --
    // back and the hamburger stay plain glyphs, per explicit feedback distinguishing
    // "tool" icons from navigation controls.
    iconBtnBordered: { borderWidth: 1, borderColor: colors.gold, backgroundColor: 'transparent' },
    iconBtnText: { color: colors.text, fontSize: 17 },
    iconBtnAa: { color: colors.text, fontFamily: FONTS.literary, fontSize: 15 },
    headerTitle: { color: colors.gold, fontFamily: FONTS.heading, fontSize: 17, textAlign: 'center', marginTop: 10 },
    actionBar: {
      position: 'absolute',
      flexDirection: 'row',
      backgroundColor: colors.panel,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.gold,
      paddingVertical: 6,
      paddingHorizontal: 4,
      shadowColor: '#000',
      shadowOpacity: 0.5,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 3 },
      elevation: 8,
    },
    actionBtn: { alignItems: 'center', paddingHorizontal: 8, gap: 2 },
    actionBtnLabel: { fontFamily: FONTS.mono, fontSize: 9, color: colors.textDim },
    jumpBackCard: {
      position: 'absolute',
      bottom: 100,
      left: 14,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.panel,
      borderWidth: 1,
      borderColor: colors.gold,
      borderRadius: 8,
      padding: 8,
      maxWidth: 190,
      shadowColor: '#000',
      shadowOpacity: 0.5,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 3 },
      elevation: 8,
    },
    jumpBackThumb: { width: 46, height: 62, backgroundColor: colors.bg, borderRadius: 2, padding: 4, overflow: 'hidden' },
    jumpBackThumbText: { color: colors.text, fontSize: 4.5, lineHeight: 6, fontFamily: FONTS.literary },
    jumpBackLabel: { color: colors.text, fontFamily: FONTS.bodyMedium, fontSize: 11, flexShrink: 1 },
    footer: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      paddingBottom: 26,
      paddingTop: 10,
      paddingHorizontal: 16,
      backgroundColor: chromeBg,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    footerChapter: { color: colors.text, fontFamily: FONTS.heading, fontSize: 13, textAlign: 'center' },
    footerMeta: { color: colors.textDim, fontFamily: FONTS.mono, fontSize: 10.5, textAlign: 'center', marginTop: 2, marginBottom: 6 },
    scrubberRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    dimmer: { ...StyleSheet.absoluteFill, backgroundColor: '#000' },
    pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
    pickerPanel: {
      width: '80%',
      maxWidth: 340,
      backgroundColor: colors.bg,
      borderWidth: 1,
      borderColor: colors.gold,
      borderRadius: 10,
      padding: 20,
    },
    pickerTitle: { color: colors.gold, fontFamily: FONTS.heading, fontSize: 16, marginBottom: 14, textAlign: 'center' },
    pickerRowMeta: { color: colors.textFaint, fontFamily: FONTS.mono, fontSize: 10.5 },
    flagQuote: { color: colors.textDim, fontFamily: FONTS.literaryItalic, fontSize: 12.5, marginBottom: 14, textAlign: 'center' },
    flagOption: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 12,
      marginBottom: 8,
      alignItems: 'center',
    },
    flagOptionText: { color: colors.text, fontFamily: FONTS.bodyMedium, fontSize: 14 },
    tocInner: { flex: 1, paddingTop: 50, paddingHorizontal: 18 },
    tocBackRow: { paddingVertical: 6 },
    tocBackText: { color: colors.gold, fontFamily: FONTS.mono, fontSize: 11.5 },
    tocTitle: { color: colors.gold, fontFamily: FONTS.heading, fontSize: 17, marginBottom: 16, textAlign: 'center' },
    tocBookMain: { paddingVertical: 14, borderTopWidth: 1, borderTopColor: colors.borderDim },
    tocBookTitle: { color: colors.text, fontFamily: FONTS.heading, fontSize: 15 },
    tocBookMeta: { color: colors.textFaint, fontFamily: FONTS.mono, fontSize: 10.5, marginTop: 2 },
    tocChapterRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 11,
      borderTopWidth: 1,
      borderTopColor: colors.borderDim,
    },
    tocChapterNumber: { color: colors.textFaint, fontFamily: FONTS.mono, fontSize: 11, width: 22 },
    tocChapterTitle: { color: colors.textDim, fontFamily: FONTS.literary, fontSize: 14, flex: 1 },
    tocChapterTitleActive: { color: colors.gold },
    sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    sheet: { backgroundColor: colors.bg, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20, paddingBottom: 36, borderWidth: 1, borderColor: colors.border },
    sheetTitle: { color: colors.gold, fontFamily: FONTS.heading, fontSize: 16, marginBottom: 16, textAlign: 'center' },
    sheetLabel: { color: colors.textDim, fontFamily: FONTS.mono, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 14, marginBottom: 6 },
    optionRow: { flexDirection: 'row', gap: 8 },
    optionActive: { borderColor: colors.gold, backgroundColor: withOpacity(colors.gold, 0.14) },
    fontOption: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      paddingVertical: 10,
      alignItems: 'center',
      gap: 2,
    },
    fontOptionAa: { color: colors.text, fontSize: 18 },
    fontOptionLabel: { color: colors.textFaint, fontFamily: FONTS.mono, fontSize: 9, textTransform: 'uppercase' },
    alignOption: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      paddingVertical: 12,
      alignItems: 'center',
    },
  });
}
