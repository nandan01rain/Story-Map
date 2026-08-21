import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import Animated from 'react-native-reanimated';
import { DropProvider, SortableItem, useSortableList } from 'react-native-reanimated-dnd';

import type { SignedInStackParamList } from '../navigation/types';
import NavDrawer from '../components/NavDrawer';
import { EdgeSwipeZone } from '../components/SlidePanel';
import { useSlidePanel } from '../lib/useSlidePanel';
import { useSortablePositions } from '../lib/useSortablePositions';
import { BOOKS, statusColor, wordCount } from '../lib/storyData';
import { type Chapter, useChapterStore } from '../store/chapterStore';
import { useAuthStore } from '../store/authStore';
import { FONTS, type ThemeColors, useTheme } from '../theme';

type Props = NativeStackScreenProps<SignedInStackParamList, 'ChapterList'>;
type NavigateFn = Props['navigation']['navigate'];
type Styles = ReturnType<typeof makeStyles>;

const ROW_HEIGHT = 52;
// useSortableList requires every item to report the same fixed height for its drag
// position math -- reserving a constant-height label slot above every row (shown or
// left blank) keeps that true, rather than only some rows growing taller for their act
// label and throwing the math off.
const LABEL_HEIGHT = 26;
const ITEM_HEIGHT = ROW_HEIGHT + LABEL_HEIGHT;

// Ports the PWA's renderListView() (index.html): Book -> Act -> Chapter accordion.
// Acts are inferred from whatever integer `act` values exist on a book's chapters
// (not a stored entity, see CLAUDE.md's hierarchy section) rather than a fixed count.
// Map view (the PWA's other view mode) is a separate, later task -- List view alone
// is enough to browse/open every chapter, so nothing is blocked on Map existing yet.
export default function ChapterListScreen({ route, navigation }: Props) {
  const { projectId, projectName } = route.params;
  const { chapters, loading, error, fetchChapters, createChapter } = useChapterStore();
  const [expandedBooks, setExpandedBooks] = useState<Set<number>>(new Set([0]));
  const [addChapterBook, setAddChapterBook] = useState<number | null>(null);
  const [newChapterTitle, setNewChapterTitle] = useState('');
  const [newChapterAct, setNewChapterAct] = useState('1');
  const [creatingChapter, setCreatingChapter] = useState(false);
  const signOut = useAuthStore((s) => s.signOut);
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { width: winWidth } = useWindowDimensions();

  // No hamburger button at all -- per explicit feedback, the menu opens purely from an
  // edge swipe. The gesture drives the panel continuously (see useSlidePanel), so a
  // partial swipe shows a partially-open drawer and settles either way on release.
  const drawerWidth = Math.min(winWidth * 0.78, 360);
  const drawerPanel = useSlidePanel(drawerWidth);

  useEffect(() => {
    navigation.setOptions({ title: projectName });
  }, [navigation, projectName]);

  useEffect(() => {
    fetchChapters(projectId);
  }, [projectId, fetchChapters]);

  const byBook = useMemo(() => {
    const map = new Map<number, Chapter[]>();
    for (const ch of chapters) {
      if (!map.has(ch.book)) map.set(ch.book, []);
      map.get(ch.book)!.push(ch);
    }
    return map;
  }, [chapters]);

  function toggleBook(bookIndex: number) {
    setExpandedBooks((prev) => {
      const next = new Set(prev);
      if (next.has(bookIndex)) next.delete(bookIndex);
      else next.add(bookIndex);
      return next;
    });
  }

  function openAddChapter(bookIndex: number) {
    setAddChapterBook(bookIndex);
    setNewChapterTitle('');
    setNewChapterAct('1');
  }

  async function confirmAddChapter() {
    if (addChapterBook === null) return;
    const act = Math.max(1, parseInt(newChapterAct, 10) || 1);
    setCreatingChapter(true);
    const { error: err } = await createChapter(projectId, addChapterBook, act, newChapterTitle);
    setCreatingChapter(false);
    if (err) return;
    setExpandedBooks((prev) => new Set(prev).add(addChapterBook));
    setAddChapterBook(null);
  }

  function navigateFromDrawer(go: () => void) {
    drawerPanel.close();
    go();
  }

  const drawer = (
    <NavDrawer
      controller={drawerPanel}
      panelWidth={drawerWidth}
      projectName={projectName}
      onSearch={() => navigateFromDrawer(() => navigation.navigate('Search', { projectId }))}
      onSwitchProject={() => navigateFromDrawer(() => navigation.navigate('ProjectPicker'))}
      onSignOut={() => navigateFromDrawer(signOut)}
      onOpenReader={() => navigateFromDrawer(() => navigation.navigate('Reader', { projectId, projectName }))}
      onOpenSettings={() => navigateFromDrawer(() => navigation.navigate('Settings'))}
      onOpenNotes={() => navigateFromDrawer(() => navigation.navigate('StickyNotes', { projectId }))}
      onOpenDocuments={() => navigateFromDrawer(() => navigation.navigate('Documents', { projectId }))}
      onOpenAssistant={() => navigateFromDrawer(() => navigation.navigate('Assistant', { projectId }))}
    />
  );

  const edgeSwipeZone = <EdgeSwipeZone controller={drawerPanel} />;

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.gold} />
        {edgeSwipeZone}
        {drawer}
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{error}</Text>
        {edgeSwipeZone}
        {drawer}
      </View>
    );
  }

  if (chapters.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.empty}>No chapters yet.</Text>
        {edgeSwipeZone}
        {drawer}
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {BOOKS.map((bookName, bookIndex) => {
        const bookChapters = byBook.get(bookIndex);
        if (!bookChapters || bookChapters.length === 0) return null;
        const isOpen = expandedBooks.has(bookIndex);

        return (
          <View key={bookIndex} style={styles.book}>
            <Pressable style={styles.bookHeader} onPress={() => toggleBook(bookIndex)}>
              <Text style={styles.bookTitle}>{bookName}</Text>
              <Text style={styles.bookMeta}>
                {bookChapters.length} chapter{bookChapters.length === 1 ? '' : 's'}
              </Text>
              <Pressable style={styles.addChapterBtn} onPress={() => openAddChapter(bookIndex)} hitSlop={8}>
                <Text style={styles.addChapterBtnText}>+</Text>
              </Pressable>
              <Text style={styles.bookArrow}>{isOpen ? '▼' : '▶'}</Text>
            </Pressable>

            {isOpen && (
              <BookChapterList chapters={bookChapters} projectId={projectId} navigate={navigation.navigate} styles={styles} />
            )}
          </View>
        );
      })}

      <Modal visible={addChapterBook !== null} transparent animationType="fade" onRequestClose={() => setAddChapterBook(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              New chapter{addChapterBook !== null ? ` — ${BOOKS[addChapterBook]}` : ''}
            </Text>
            <TextInput
              style={styles.modalInput}
              value={newChapterTitle}
              onChangeText={setNewChapterTitle}
              placeholder="Chapter title"
              placeholderTextColor={colors.textFaint}
              autoFocus
            />
            <TextInput
              style={styles.modalInput}
              value={newChapterAct}
              onChangeText={setNewChapterAct}
              placeholder="Act"
              placeholderTextColor={colors.textFaint}
              keyboardType="number-pad"
            />
            <View style={styles.modalActions}>
              <Pressable onPress={() => setAddChapterBook(null)}>
                <Text style={styles.modalCancel}>Cancel</Text>
              </Pressable>
              <Pressable onPress={confirmAddChapter} disabled={creatingChapter}>
                <Text style={styles.modalConfirm}>{creatingChapter ? 'Creating…' : 'Create'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      </ScrollView>
      {edgeSwipeZone}
      {drawer}
    </View>
  );
}

// Drag-to-reorder across the WHOLE book, not just within one act -- extended from the
// PWA's List-mode reordering (index.html, wireListDrag()) at this session's explicit
// request; the PWA itself only supported within-act dragging (that function's own
// comment explains why: no natural "one continuous position" existed there without
// auto-expanding collapsed act sections). Here the whole book's chapters render as one
// flat draggable sequence when the book is expanded, so no such expansion is needed.
//
// Dragging a chapter past an act boundary reassigns its `act`: on drop, the moved
// chapter inherits the act of whichever chapter now sits immediately above it in the
// merged sequence (or below it, if dropped at the very top) -- every other chapter keeps
// its own act unchanged. `order` is then renumbered within each resulting consecutive
// same-act run, not as one book-wide sequence, so "3rd chapter in Act 2" stays a
// meaningful, stable position after an unrelated chapter moves elsewhere in the book.
// "ACT N" labels are computed live from the current in-progress order (not the act
// values pre-drag), so a chapter visually joins the group it's hovering over as you drag.
//
// A dedicated handle (not the whole row) starts the drag, same as the PWA, so tapping a
// row still opens its drawer. Uses useSortableList rather than the higher-level
// <Sortable> component deliberately -- <Sortable> renders its own internal FlatList/
// VirtualizedList, which React Native explicitly warns against nesting inside a plain
// ScrollView (this screen's outer book accordion) -- confirmed on real hardware as the
// exact "VirtualizedLists should never be nested inside plain ScrollViews" warning.
// useSortableList hands back plain items to .map() over inside a bounded-height
// Animated.ScrollView instead, so nothing virtualized ever sits inside the outer
// ScrollView. Local `items` state mirrors the library's own example pattern (it owns the
// live drag visuals; the consuming app tracks the resulting order itself via onMove) --
// re-synced from the store on external changes, persisted via reorderChapters() once a
// drag actually completes (onDrop), not on every intermediate onMove event.
function BookChapterList({
  chapters,
  projectId,
  navigate,
  styles,
}: {
  chapters: Chapter[];
  projectId: string;
  navigate: NavigateFn;
  styles: Styles;
}) {
  const reorderChapters = useChapterStore((s) => s.reorderChapters);
  const sorted = useMemo(
    () => [...chapters].sort((a, b) => a.act - b.act || a.order - b.order),
    [chapters],
  );
  const [items, setItems] = useState(sorted);
  const [draggedId, setDraggedId] = useState<string | null>(null);

  useEffect(() => {
    setItems(sorted);
  }, [sorted]);

  const handleMove = useCallback((id: string, from: number, to: number) => {
    setDraggedId(id);
    setItems((prev) => {
      const idx = prev.findIndex((c) => c.id === id);
      if (idx === -1 || from === to) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }, []);

  const handleDrop = useCallback(
    (id: string) => {
      setDraggedId(null);
      const draggedIdx = items.findIndex((c) => c.id === id);
      if (draggedIdx === -1) return;

      // The dragged chapter's new act: inherit from the previous item, or the next one
      // if dropped at the very top, or keep its own if it's the book's only chapter.
      const newAct =
        draggedIdx > 0
          ? items[draggedIdx - 1].act
          : items.length > 1
            ? items[1].act
            : items[draggedIdx].act;
      const withReassignedAct = items.map((c) => (c.id === id ? { ...c, act: newAct } : c));

      // Renumber `order` within each consecutive same-act run.
      const updates: { id: string; act: number; order: number }[] = [];
      let runAct: number | null = null;
      let runOrder = 0;
      for (const c of withReassignedAct) {
        if (c.act !== runAct) {
          runAct = c.act;
          runOrder = 0;
        }
        updates.push({ id: c.id, act: c.act, order: runOrder });
        runOrder++;
      }
      reorderChapters(updates);
    },
    [items, reorderChapters],
  );

  const { positions, scrollViewRef, dropProviderRef, handleScroll, handleScrollEnd, contentHeight, getItemProps } =
    useSortableList({ data: items, itemHeight: ITEM_HEIGHT });
  // Same stacked-rows hazard the project list hit: chapters arrive from a fetch after
  // this mounts, and a chapter created later changes the set too.
  const listKey = useSortablePositions(items, positions);

  // Live act labels: which item starts a new act, given the dragged item's provisional
  // act (previous-neighbor rule, same as handleDrop) while a drag is in progress.
  const actStartIds = useMemo(() => {
    const withProvisionalAct = items.map((c, i) => {
      if (c.id !== draggedId) return c;
      const newAct = i > 0 ? items[i - 1].act : items.length > 1 ? items[1].act : c.act;
      return { ...c, act: newAct };
    });
    const starts = new Set<string>();
    let lastAct: number | null = null;
    for (const c of withProvisionalAct) {
      if (c.act !== lastAct) {
        starts.add(c.id);
        lastAct = c.act;
      }
    }
    return starts;
  }, [items, draggedId]);

  return (
    <DropProvider key={listKey} ref={dropProviderRef}>
      <Animated.ScrollView
        ref={scrollViewRef}
        scrollEnabled={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ height: contentHeight }}
        onScrollEndDrag={handleScrollEnd}
        onMomentumScrollEnd={handleScrollEnd}
      >
        {items.map((item, index) => (
          <SortableItem
            key={item.id}
            data={item}
            {...getItemProps(item, index)}
            onMove={handleMove}
            onDrop={() => handleDrop(item.id)}
          >
            <View style={{ height: ITEM_HEIGHT }}>
              <View style={styles.actTitleSlot}>
                {actStartIds.has(item.id) && <Text style={styles.actTitle}>Act {item.act}</Text>}
              </View>
              <View style={styles.chapterRow}>
                <SortableItem.Handle style={styles.dragHandle}>
                  <Text style={styles.dragHandleText}>⠿</Text>
                </SortableItem.Handle>
                <Pressable
                  style={styles.chapterRowMain}
                  onPress={() => navigate('ChapterDrawer', { chapterId: item.id, projectId })}
                >
                  <View style={[styles.dot, { backgroundColor: statusColor(item.status) }]} />
                  <Text style={styles.chapterTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={styles.chapterMeta}>{wordCount(item.content)}w</Text>
                </Pressable>
              </View>
            </View>
          </SortableItem>
        ))}
      </Animated.ScrollView>
    </DropProvider>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg },
    content: { padding: 16, paddingBottom: 40 },
    centered: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
    error: { color: colors.error, fontSize: 13 },
    empty: { color: colors.textDim, fontSize: 13 },
    book: {
      marginBottom: 14,
      backgroundColor: colors.panel,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      overflow: 'hidden',
    },
    bookHeader: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 10 },
    bookTitle: { color: colors.text, fontFamily: FONTS.heading, fontSize: 16, flex: 1 },
    bookMeta: { color: colors.textDim, fontFamily: FONTS.mono, fontSize: 11 },
    bookArrow: { color: colors.gold, fontSize: 12 },
    actTitleSlot: { height: LABEL_HEIGHT, justifyContent: 'flex-end' },
    actTitle: {
      color: colors.textFaint,
      fontFamily: FONTS.mono,
      fontSize: 10.5,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      paddingHorizontal: 14,
      paddingBottom: 4,
    },
    chapterRow: {
      flexDirection: 'row',
      alignItems: 'center',
      height: ROW_HEIGHT,
      paddingHorizontal: 14,
      borderTopWidth: 1,
      borderTopColor: colors.borderDim,
      backgroundColor: colors.panel,
    },
    dragHandle: {
      width: 30,
      height: ROW_HEIGHT,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dragHandleText: { color: colors.textFaint, fontSize: 16 },
    chapterRowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingRight: 4 },
    dot: { width: 8, height: 8, borderRadius: 4 },
    chapterTitle: { color: colors.text, fontFamily: FONTS.literary, fontSize: 14.5, flex: 1 },
    chapterMeta: { color: colors.textFaint, fontFamily: FONTS.mono, fontSize: 11 },
    addChapterBtn: {
      width: 26,
      height: 26,
      borderRadius: 13,
      borderWidth: 1,
      borderColor: colors.gold,
      alignItems: 'center',
      justifyContent: 'center',
    },
    addChapterBtnText: { color: colors.gold, fontSize: 15, lineHeight: 16 },
    modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 24 },
    modalCard: { backgroundColor: colors.panel, borderRadius: 10, padding: 20, borderWidth: 1, borderColor: colors.border },
    modalTitle: { color: colors.text, fontFamily: FONTS.headingBold, fontSize: 16, marginBottom: 12 },
    modalInput: {
      backgroundColor: colors.bg,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 6,
      padding: 10,
      color: colors.text,
      fontSize: 14,
      marginBottom: 10,
    },
    modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 20, marginTop: 8 },
    modalCancel: { color: colors.textDim, fontSize: 14 },
    modalConfirm: { color: colors.gold, fontFamily: FONTS.bodySemiBold, fontSize: 14 },
  });
}
