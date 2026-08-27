import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BOOKS } from '../lib/storyData';
import type { SignedInStackParamList } from '../navigation/types';
import { useAuthStore } from '../store/authStore';
import { useChapterStore } from '../store/chapterStore';
import { PAGE_TYPES, pageTitle, usePageStore, type PageType } from '../store/pageStore';
import { FONTS, type ThemeColors, useTheme, withOpacity } from '../theme';

type Props = NativeStackScreenProps<SignedInStackParamList, 'Page'>;

const AUTOSAVE_DELAY_MS = 800;

// A notebook left open on a desk. That is the whole brief for this screen, and every
// decision in it is downstream of that one image:
//
//   * One field. No title, no type picker, no project or chapter selector, no save button.
//     Opening it puts a cursor on a blank page and gets out of the way.
//   * A row is not created in the database until the first character is typed, so opening
//     this and changing your mind leaves nothing behind and needs no cleanup pass.
//   * Everything else -- what this is, whether it has been read, what it became, what it
//     used to say -- lives behind one dot at the top right. Never visible while writing.
//
// The tension is deliberate and must stay one-directional: the surface feels casual and
// disposable, the storage never is. Nothing on this screen deletes a page, and the promote
// action copies rather than moves. The interface must never imply otherwise.
export default function PageScreen({ route, navigation }: Props) {
  const { projectId, pageId: initialPageId } = route.params;
  const user = useAuthStore((s) => s.user);
  const { pages, legacySchema, fetchPages, createPage, savePage } = usePageStore();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [pageId, setPageId] = useState<string | null>(initialPageId ?? null);
  const [content, setContent] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [ready, setReady] = useState(!initialPageId);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const creating = useRef(false);
  // The autosave timer and the unmount flush both need the newest text, and neither can
  // read it out of state closures reliably once a debounce is in flight.
  const latest = useRef('');
  // And both need the newest page id. It cannot come from state: the id appears partway
  // through typing, and a stale `null` in a closure would make the next flush create a
  // SECOND page holding the same words instead of updating the first.
  const idRef = useRef<string | null>(initialPageId ?? null);

  const page = pageId ? (pages.find((p) => p.id === pageId) ?? null) : null;

  useEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  useEffect(() => {
    if (pages.length === 0) fetchPages(projectId);
  }, [projectId, pages.length, fetchPages]);

  // Opening an existing page: seed the field once, then never again -- re-seeding on every
  // store update would fight the writer's cursor on each autosave round-trip.
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current || !initialPageId) return;
    const existing = pages.find((p) => p.id === initialPageId);
    if (!existing) return;
    seeded.current = true;
    idRef.current = existing.id;
    setContent(existing.content);
    latest.current = existing.content;
    setReady(true);
  }, [initialPageId, pages]);

  const flushRef = useRef<(text: string) => Promise<void>>(async () => {});
  flushRef.current = async (text: string) => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    if (idRef.current) {
      await savePage(idRef.current, text);
      return;
    }
    if (!text.trim() || !user || creating.current) return;
    creating.current = true;
    const { page: created } = await createPage(user.id, projectId, text);
    creating.current = false;
    if (created) {
      idRef.current = created.id;
      setPageId(created.id);
    }
  };

  function handleChange(text: string) {
    setContent(text);
    latest.current = text;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => flushRef.current(latest.current), AUTOSAVE_DELAY_MS);
  }

  // Leaving the screen is a save, not a discard. There is no other way out of this screen
  // and no confirmation, because a page must never be losable by walking away from it.
  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (latest.current.trim()) flushRef.current(latest.current);
    };
  }, []);

  if (!ready) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <ActivityIndicator color={colors.gold} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      <View style={[styles.chrome, { paddingTop: insets.top + 6 }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={14}>
          <Text style={styles.chromeGlyph}>‹</Text>
        </Pressable>
        <Pressable onPress={() => setSheetOpen(true)} hitSlop={14} disabled={!page}>
          <Text style={[styles.chromeGlyph, !page && styles.chromeGlyphOff]}>·</Text>
        </Pressable>
      </View>

      <TextInput
        style={[styles.paper, { paddingBottom: insets.bottom + 40 }]}
        value={content}
        onChangeText={handleChange}
        multiline
        autoFocus
        scrollEnabled
        textAlignVertical="top"
        placeholder=""
        selectionColor={colors.gold}
      />

      {page && (
        <PageSheet
          visible={sheetOpen}
          pageId={page.id}
          projectId={projectId}
          content={content}
          legacySchema={legacySchema}
          styles={styles}
          colors={colors}
          onClose={() => setSheetOpen(false)}
          onOpenChapter={(chapterId) => {
            setSheetOpen(false);
            navigation.navigate('Editor', { chapterId });
          }}
        />
      )}
    </KeyboardAvoidingView>
  );
}

// Everything that is not writing. One sheet, reached by one dot, closed by tapping away.
function PageSheet({
  visible,
  pageId,
  projectId,
  content,
  legacySchema,
  styles,
  colors,
  onClose,
  onOpenChapter,
}: {
  visible: boolean;
  pageId: string;
  projectId: string;
  content: string;
  legacySchema: boolean;
  styles: Styles;
  colors: ThemeColors;
  onClose: () => void;
  onOpenChapter: (chapterId: string) => void;
}) {
  const { pages, setType, setStatus, markBecame } = usePageStore();
  const { chapters, fetchChapters, createChapter } = useChapterStore();
  const page = pages.find((p) => p.id === pageId);
  const [promoting, setPromoting] = useState(false);
  const [book, setBook] = useState(0);
  const [busy, setBusy] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    if (visible && chapters.length === 0) fetchChapters(projectId);
  }, [visible, chapters.length, fetchChapters, projectId]);

  if (!page) return null;

  // Acts are inferred from whatever act values the book's chapters already carry (CLAUDE.md
  // "Hierarchy" -- acts are not a stored entity), so a new page joins the acts that exist
  // rather than inventing a fixed set.
  const acts = Array.from(new Set(chapters.filter((c) => c.book === book).map((c) => c.act))).sort((a, b) => a - b);
  const actChoices = acts.length > 0 ? acts : [1];

  async function promote(act: number) {
    setBusy(true);
    const title = pageTitle({ content }) || 'Untitled chapter';
    const { chapter, error } = await createChapter(projectId, book, act, title.slice(0, 120));
    if (chapter) {
      // The page's text is COPIED into the chapter. The page itself is untouched -- same
      // text, same place in the list -- and only learns where its contents went.
      await useChapterStore.getState().updateChapter(chapter.id, { content });
      await markBecame(page!.id, 'chapter', chapter.id);
    }
    setBusy(false);
    if (chapter && !error) onOpenChapter(chapter.id);
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.sheetBackdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <ScrollView>
            {legacySchema && (
              <Text style={styles.sheetWarn}>
                This project's database predates 20260826_pages.sql. Your text saves normally; type,
                status and history do not.
              </Text>
            )}

            <Text style={styles.sheetLabel}>What is this?</Text>
            <View style={styles.chipRow}>
              {PAGE_TYPES.map((t) => (
                <Pressable
                  key={t}
                  style={[styles.chip, page!.type === t && styles.chipOn]}
                  onPress={() => setType(page!.id, page!.type === t ? null : (t as PageType))}
                >
                  <Text style={[styles.chipText, page!.type === t && styles.chipTextOn]}>{t}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.sheetNote}>Optional, and never asked for. Leave it blank.</Text>

            <View style={styles.sheetRule} />

            {promoting ? (
              <>
                <Text style={styles.sheetLabel}>Make this a chapter</Text>
                <View style={styles.chipRow}>
                  {BOOKS.map((name, i) => (
                    <Pressable key={name} style={[styles.chip, book === i && styles.chipOn]} onPress={() => setBook(i)}>
                      <Text style={[styles.chipText, book === i && styles.chipTextOn]}>{name}</Text>
                    </Pressable>
                  ))}
                </View>
                <View style={styles.chipRow}>
                  {actChoices.map((a) => (
                    <Pressable key={a} style={styles.chip} onPress={() => promote(a)} disabled={busy}>
                      <Text style={styles.chipText}>Act {a}</Text>
                    </Pressable>
                  ))}
                </View>
                <Text style={styles.sheetNote}>
                  The chapter gets a copy. This page stays exactly as it is, and remembers where its
                  words went.
                </Text>
              </>
            ) : page!.became_type ? (
              <Pressable
                style={styles.sheetAction}
                onPress={() => page!.became_id && onOpenChapter(page!.became_id)}
              >
                <Text style={styles.sheetActionText}>
                  Became a {page!.became_type} — open it
                </Text>
              </Pressable>
            ) : (
              <Pressable style={styles.sheetAction} onPress={() => setPromoting(true)}>
                <Text style={styles.sheetActionText}>Make this a chapter</Text>
              </Pressable>
            )}

            <View style={styles.sheetRule} />

            <Pressable
              style={styles.sheetAction}
              onPress={() => setStatus(page!.id, page!.status === 'reviewed' ? 'raw' : 'reviewed')}
            >
              <Text style={styles.sheetActionText}>
                {page!.status === 'reviewed' ? 'Mark as unread again' : 'Mark as read through'}
              </Text>
            </Pressable>

            {page!.versions.length > 0 && (
              <>
                <Pressable style={styles.sheetAction} onPress={() => setShowHistory((v) => !v)}>
                  <Text style={styles.sheetActionText}>
                    {page!.versions.length} earlier draft{page!.versions.length === 1 ? '' : 's'}
                  </Text>
                </Pressable>
                {showHistory &&
                  page!.versions.map((v) => (
                    <View key={v.savedAt} style={styles.version}>
                      <Text style={styles.versionDate}>{new Date(v.savedAt).toLocaleString()}</Text>
                      <Text style={styles.versionText} numberOfLines={6}>
                        {v.content}
                      </Text>
                    </View>
                  ))}
              </>
            )}

            {busy && <ActivityIndicator color={colors.gold} style={{ marginTop: 12 }} />}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

type Styles = ReturnType<typeof makeStyles>;

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg },
    centered: { alignItems: 'center', justifyContent: 'center' },
    // Nearly absent on purpose: two low-contrast glyphs, no bar, no border, nothing that
    // reads as a toolbar sitting above the page.
    chrome: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: 18,
      paddingBottom: 2,
    },
    chromeGlyph: { color: withOpacity(colors.textFaint, 0.75), fontSize: 26, lineHeight: 28, paddingHorizontal: 6 },
    chromeGlyphOff: { opacity: 0.25 },
    // Room to sprawl: a book face, wide leading, and margins closer to a printed page than
    // to a form field.
    paper: {
      flex: 1,
      color: colors.text,
      fontFamily: FONTS.literary,
      fontSize: 18,
      lineHeight: 30,
      paddingHorizontal: 26,
      paddingTop: 14,
    },

    sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: colors.panel,
      borderTopWidth: 1,
      borderColor: colors.border,
      borderTopLeftRadius: 14,
      borderTopRightRadius: 14,
      padding: 20,
      maxHeight: '75%',
    },
    sheetLabel: { color: colors.gold, fontFamily: FONTS.heading, fontSize: 14, marginBottom: 10 },
    sheetNote: { color: colors.textFaint, fontFamily: FONTS.literaryItalic, fontSize: 12, marginTop: 8, lineHeight: 18 },
    sheetWarn: { color: colors.error, fontFamily: FONTS.body, fontSize: 12, lineHeight: 18, marginBottom: 14 },
    sheetRule: { height: 1, backgroundColor: colors.borderDim, marginVertical: 18 },
    sheetAction: { paddingVertical: 12 },
    sheetActionText: { color: colors.text, fontFamily: FONTS.body, fontSize: 15 },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    chipOn: { backgroundColor: withOpacity(colors.gold, 0.22), borderColor: colors.gold },
    chipText: { color: colors.textDim, fontFamily: FONTS.mono, fontSize: 11 },
    chipTextOn: { color: colors.text },
    version: {
      borderLeftWidth: 2,
      borderColor: colors.borderDim,
      paddingLeft: 10,
      marginTop: 10,
    },
    versionDate: { color: colors.textFaint, fontFamily: FONTS.mono, fontSize: 10 },
    versionText: { color: colors.textDim, fontFamily: FONTS.literary, fontSize: 13, lineHeight: 20, marginTop: 4 },
  });
}
