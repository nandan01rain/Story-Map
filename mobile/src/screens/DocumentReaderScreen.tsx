import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Slider from '@react-native-community/slider';
import * as NavigationBar from 'expo-navigation-bar';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ViewToken,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Icon from '../components/Icon';
import { MarkdownBlock, type MarkdownLook } from '../components/MarkdownBlock';
import SlidePanel, { EdgeSwipeZone } from '../components/SlidePanel';
import { parseMarkdown, type Block } from '../lib/markdown';
import {
  ALIGN_OPTIONS,
  DEFAULT_READER_PREFS,
  FONT_FAMILY_OPTIONS,
  type ReaderPrefs,
  loadDocumentPosition,
  loadReaderPrefs,
  resolveFontFamily,
  saveDocumentPosition,
  saveReaderPrefs,
} from '../lib/readerPrefs';
import { useSlidePanel } from '../lib/useSlidePanel';
import type { SignedInStackParamList } from '../navigation/types';
import { type StoryDocument, useDocumentStore } from '../store/documentStore';
import { FONTS, type ThemeColors, useTheme, withOpacity } from '../theme';

type Props = NativeStackScreenProps<SignedInStackParamList, 'DocumentReader'>;

const BASE_FONT_SIZE = 16.5;
const BASE_LINE_HEIGHT = 27;
const PAD_H = 24;

// A document, read (2026-10-11). Documents used to open straight into an editable text box,
// raw markdown and all. They now open here first, rendered the way a chat window renders
// markdown (see MarkdownBlock), with the chapter Reader's manner: full screen, the text
// alone until you want the controls, a contents panel from the left edge built from the
// document's own headings, the same font and layout settings, and it reopens where you left
// off. Editing is a separate screen, reached by the pencil -- as the Reader and the Editor are.
//
// Not the chapter Reader itself, deliberately: that one lays prose out a measured line at a
// time so it can paginate and select word by word, and a line model has no room for a
// heading at twice the size or a table. Documents scroll rather than turn pages. Native long-
// press selection still works for copying.
//
// The controls show on scrolling back up and hide on reading on, as a browser's do: a tap is
// already the selection gesture on selectable text, so it cannot also be the chrome toggle.
export default function DocumentReaderScreen({ route, navigation }: Props) {
  const { projectId, documentId } = route.params;
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const fetchDocument = useDocumentStore((s) => s.fetchDocument);

  const [doc, setDoc] = useState<StoryDocument | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<ReaderPrefs>(DEFAULT_READER_PREFS);
  const [fontSheetOpen, setFontSheetOpen] = useState(false);
  const [progress, setProgress] = useState(0);
  const [topBlock, setTopBlock] = useState(0);

  const listRef = useRef<FlatList<Block>>(null);
  const chrome = useRef(new Animated.Value(1)).current;
  const chromeShown = useRef(true);
  const [chromeVisible, setChromeVisible] = useState(true);
  const lastY = useRef(0);
  const restored = useRef(false);
  const tocWidth = Math.min(width * 0.82, 380);
  const toc = useSlidePanel(tocWidth);

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS === 'android') NavigationBar.setVisibilityAsync('hidden').catch(() => {});
      // Refetched on every focus, so coming back from the editor shows what was just written.
      let alive = true;
      void fetchDocument(documentId).then(({ document, error: err }) => {
        if (!alive) return;
        if (err) setError(err);
        else setDoc(document);
      });
      return () => {
        alive = false;
        if (Platform.OS === 'android') NavigationBar.setVisibilityAsync('visible').catch(() => {});
      };
    }, [documentId, fetchDocument]),
  );

  useEffect(() => {
    loadReaderPrefs().then(setPrefs);
  }, []);

  const blocks = useMemo<Block[]>(() => {
    if (!doc) return [];
    const parsed = parseMarkdown(doc.content ?? '');
    // The document's own title leads, unless it already opens with a top-level heading.
    const first = parsed[0];
    if (first && first.kind === 'heading' && first.level === 1) return parsed;
    return [{ kind: 'heading', level: 1, inline: [{ text: doc.title }], plain: doc.title, at: 0 }, ...parsed];
  }, [doc]);

  // The contents: every level-1 and level-2 heading, with level 3 indented beneath them in
  // documents short enough for that to stay a usable list.
  const outline = useMemo(() => {
    const heads = blocks
      .map((b, index) => ({ b, index }))
      .filter((x): x is { b: Extract<Block, { kind: 'heading' }>; index: number } => x.b.kind === 'heading');
    const top = heads.filter((h) => h.b.level <= 2);
    return top.length >= 4 || heads.length > 120 ? top : heads.filter((h) => h.b.level <= 3);
  }, [blocks]);

  const fontSize = BASE_FONT_SIZE * prefs.fontScale;
  const look: MarkdownLook = useMemo(
    () => ({
      colors,
      fontFamily: resolveFontFamily(prefs.fontFamily),
      fontSize,
      lineHeight: BASE_LINE_HEIGHT * prefs.fontScale * prefs.lineSpacingScale,
      align: prefs.textAlign,
    }),
    [colors, prefs, fontSize],
  );

  // Back to where this document was left, once its blocks exist.
  useEffect(() => {
    if (restored.current || blocks.length === 0) return;
    restored.current = true;
    void loadDocumentPosition(documentId).then((index) => {
      if (index > 0 && index < blocks.length) scrollToBlock(index, false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocks.length, documentId]);

  function scrollToBlock(index: number, animated = true) {
    listRef.current?.scrollToIndex({ index, animated, viewPosition: 0 });
  }

  function showChrome(show: boolean) {
    if (chromeShown.current === show) return;
    chromeShown.current = show;
    setChromeVisible(show);
    Animated.timing(chrome, { toValue: show ? 1 : 0, duration: 200, useNativeDriver: true }).start();
  }

  function onScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const y = contentOffset.y;
    const dy = y - lastY.current;
    if (y < 40) showChrome(true);
    else if (dy > 12) showChrome(false);
    else if (dy < -12) showChrome(true);
    lastY.current = y;
    const max = Math.max(1, contentSize.height - layoutMeasurement.height);
    setProgress(Math.min(1, Math.max(0, y / max)));
  }

  const onViewable = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const first = viewableItems.find((v) => v.isViewable);
    if (first?.index != null) {
      setTopBlock(first.index);
      void saveDocumentPosition(documentId, first.index);
    }
  }).current;

  function updatePrefs(patch: Partial<ReaderPrefs>) {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    void saveReaderPrefs(next);
  }

  // Opens the editor on the part being read: the raw-text offset of the block at the top of
  // the screen, which the editor turns into that block's section.
  function edit() {
    const block = blocks[topBlock];
    navigation.navigate('DocumentEditor', { projectId, documentId, at: block?.at ?? 0 });
  }

  const currentHeading = useMemo(() => {
    let title = doc?.title ?? '';
    for (const h of outline) {
      if (h.index > topBlock) break;
      title = h.b.plain;
    }
    return title;
  }, [outline, topBlock, doc]);

  return (
    <View style={styles.screen}>
      <StatusBar hidden animated />

      {error ? (
        <View style={styles.centered}>
          <Text style={styles.error}>{error}</Text>
        </View>
      ) : !doc ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.gold} />
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={blocks}
          keyExtractor={(b, i) => `${i}:${b.at}`}
          renderItem={({ item }) => <MarkdownBlock block={item} look={look} />}
          contentContainerStyle={{ paddingHorizontal: PAD_H, paddingTop: 76, paddingBottom: insets.bottom + 120 }}
          onScroll={onScroll}
          scrollEventThrottle={32}
          onViewableItemsChanged={onViewable}
          viewabilityConfig={{ itemVisiblePercentThreshold: 10 }}
          initialNumToRender={24}
          maxToRenderPerBatch={24}
          windowSize={13}
          // Blocks vary in height, so a jump far ahead lands near, renders, then lands exactly.
          onScrollToIndexFailed={(info) => {
            listRef.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: false });
            setTimeout(() => listRef.current?.scrollToIndex({ index: info.index, animated: false, viewPosition: 0 }), 120);
          }}
          ListEmptyComponent={<Text style={styles.empty}>This document is empty.</Text>}
        />
      )}

      <Animated.View
        style={[styles.header, { opacity: chrome, transform: [{ translateY: chrome.interpolate({ inputRange: [0, 1], outputRange: [-70, 0] }) }] }]}
        pointerEvents={chromeVisible ? 'auto' : 'none'}
      >
        <Pressable style={styles.iconBtn} onPress={() => navigation.goBack()} hitSlop={6}>
          <Text style={styles.iconBtnText}>‹</Text>
        </Pressable>
        <Pressable style={styles.iconBtn} onPress={toc.open} hitSlop={6}>
          <Text style={styles.iconBtnText}>☰</Text>
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {currentHeading}
        </Text>
        <Pressable style={[styles.iconBtn, styles.iconBtnBordered]} onPress={() => setFontSheetOpen(true)}>
          <Text style={styles.iconBtnAa}>Aa</Text>
        </Pressable>
        <Pressable style={[styles.iconBtn, styles.iconBtnBordered]} onPress={edit} disabled={!doc}>
          <Icon name="pencil" size={16} color={colors.gold} />
        </Pressable>
      </Animated.View>

      <Animated.View style={[styles.footer, { paddingBottom: insets.bottom + 8, opacity: chrome }]} pointerEvents="none">
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
        </View>
        <Text style={styles.footerMeta}>{`${Math.round(progress * 100)}%`}</Text>
      </Animated.View>

      <EdgeSwipeZone controller={toc} />
      <View pointerEvents="none" style={[styles.dimmer, { opacity: prefs.dimOpacity }]} />

      <SlidePanel controller={toc} width={tocWidth}>
        <View style={styles.tocInner}>
          <Text style={styles.tocTitle} numberOfLines={3}>
            {doc?.title ?? ''}
          </Text>
          <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
            {outline.length === 0 && <Text style={styles.tocEmpty}>No headings in this document.</Text>}
            {outline.map((h) => {
              const active = h.b.plain === currentHeading;
              return (
                <Pressable
                  key={h.index}
                  style={[styles.tocRow, { paddingLeft: 4 + (h.b.level - 1) * 14 }]}
                  onPress={() => {
                    toc.close();
                    scrollToBlock(h.index);
                  }}
                >
                  <Text
                    style={[styles.tocText, h.b.level === 1 && styles.tocTextTop, active && styles.tocTextActive]}
                    numberOfLines={2}
                  >
                    {h.b.plain}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </SlidePanel>

      {/* The same Font & Layout settings as the chapter Reader, stored in the same place. */}
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

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 },
    error: { color: colors.error, fontFamily: FONTS.body, fontSize: 14, textAlign: 'center' },
    empty: { color: colors.textFaint, fontFamily: FONTS.literaryItalic, fontSize: 15, textAlign: 'center', marginTop: 40 },
    header: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 10,
      paddingTop: 12,
      paddingBottom: 10,
      backgroundColor: withOpacity(colors.bg, 0.94),
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.borderDim,
    },
    headerTitle: { flex: 1, color: colors.textDim, fontFamily: FONTS.heading, fontSize: 13, letterSpacing: 0.5, marginHorizontal: 4 },
    iconBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
    iconBtnBordered: { borderWidth: 1, borderColor: colors.border },
    iconBtnText: { color: colors.gold, fontSize: 22, lineHeight: 26 },
    iconBtnAa: { color: colors.gold, fontFamily: FONTS.heading, fontSize: 14 },
    footer: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      paddingHorizontal: 24,
      paddingTop: 10,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: withOpacity(colors.bg, 0.9),
    },
    progressTrack: { flex: 1, height: 2, backgroundColor: colors.borderDim },
    progressFill: { height: 2, backgroundColor: colors.gold },
    footerMeta: { color: colors.textFaint, fontFamily: FONTS.mono, fontSize: 11 },
    dimmer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#000' },
    tocInner: { flex: 1, paddingTop: 40, paddingHorizontal: 18 },
    tocTitle: { color: colors.gold, fontFamily: FONTS.headingBold, fontSize: 17, letterSpacing: 0.5, marginBottom: 14 },
    tocEmpty: { color: colors.textFaint, fontFamily: FONTS.body, fontSize: 14 },
    tocRow: { paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderDim },
    tocText: { color: colors.textDim, fontFamily: FONTS.body, fontSize: 14, lineHeight: 19 },
    tocTextTop: { color: colors.text, fontFamily: FONTS.bodySemiBold },
    tocTextActive: { color: colors.gold },
    sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    sheet: { backgroundColor: colors.panel, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20, paddingBottom: 34 },
    sheetTitle: { color: colors.text, fontFamily: FONTS.heading, fontSize: 16, marginBottom: 8 },
    sheetLabel: { color: colors.textFaint, fontFamily: FONTS.mono, fontSize: 10.5, letterSpacing: 0.5, textTransform: 'uppercase', marginTop: 14, marginBottom: 6 },
    optionRow: { flexDirection: 'row', gap: 10 },
    fontOption: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: colors.borderDim },
    fontOptionAa: { color: colors.text, fontSize: 20 },
    fontOptionLabel: { color: colors.textDim, fontSize: 11, marginTop: 2 },
    alignOption: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: colors.borderDim },
    optionActive: { borderColor: colors.gold, backgroundColor: withOpacity(colors.gold, 0.1) },
  });
}
