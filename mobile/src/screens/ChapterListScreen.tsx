import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { DropProvider, SortableItem, useSortableList } from 'react-native-reanimated-dnd';

import type { SignedInStackParamList } from '../navigation/types';
import { BOOKS, statusColor, wordCount } from '../lib/storyData';
import { type Chapter, useChapterStore } from '../store/chapterStore';

type Props = NativeStackScreenProps<SignedInStackParamList, 'ChapterList'>;
type NavigateFn = Props['navigation']['navigate'];

const ROW_HEIGHT = 52;

// Ports the PWA's renderListView() (index.html): Book -> Act -> Chapter accordion.
// Acts are inferred from whatever integer `act` values exist on a book's chapters
// (not a stored entity, see CLAUDE.md's hierarchy section) rather than a fixed count.
// Map view (the PWA's other view mode) is a separate, later task -- List view alone
// is enough to browse/open every chapter, so nothing is blocked on Map existing yet.
export default function ChapterListScreen({ route, navigation }: Props) {
  const { projectId, projectName } = route.params;
  const { chapters, loading, error, fetchChapters } = useChapterStore();
  const [expandedBooks, setExpandedBooks] = useState<Set<number>>(new Set([0]));

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

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#c69a3a" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{error}</Text>
      </View>
    );
  }

  if (chapters.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.empty}>No chapters yet.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {BOOKS.map((bookName, bookIndex) => {
        const bookChapters = byBook.get(bookIndex);
        if (!bookChapters || bookChapters.length === 0) return null;
        const isOpen = expandedBooks.has(bookIndex);
        const acts = [...new Set(bookChapters.map((c) => c.act))].sort((a, b) => a - b);

        return (
          <View key={bookIndex} style={styles.book}>
            <Pressable style={styles.bookHeader} onPress={() => toggleBook(bookIndex)}>
              <Text style={styles.bookTitle}>{bookName}</Text>
              <Text style={styles.bookMeta}>
                {bookChapters.length} chapter{bookChapters.length === 1 ? '' : 's'}
              </Text>
              <Text style={styles.bookArrow}>{isOpen ? '▼' : '▶'}</Text>
            </Pressable>

            {isOpen &&
              acts.map((actNum) => {
                const actChapters = bookChapters
                  .filter((c) => c.act === actNum)
                  .sort((a, b) => a.order - b.order);
                return (
                  <View key={actNum} style={styles.act}>
                    <Text style={styles.actTitle}>Act {actNum}</Text>
                    <ActChapterList chapters={actChapters} projectId={projectId} navigate={navigation.navigate} />
                  </View>
                );
              })}
          </View>
        );
      })}
    </ScrollView>
  );
}

// Drag-to-reorder, within this act only -- ports the PWA's List-mode reordering
// (index.html, wireListDrag()), including its within-act-only scope (that function's own
// comment explains why cross-section dragging wasn't built: no natural "one continuous
// position across every book" ordering exists once acts collapse independently). A
// dedicated handle (not the whole row) starts the drag, same as the PWA, so tapping a
// row still opens its drawer.
//
// Uses useSortableList rather than the higher-level <Sortable> component deliberately:
// <Sortable> renders its own internal FlatList/VirtualizedList, which React Native
// explicitly warns against nesting inside a plain ScrollView (this screen's outer
// book/act accordion) -- confirmed on real hardware as the exact "VirtualizedLists
// should never be nested inside plain ScrollViews" warning. useSortableList hands back
// plain items to .map() over inside a normal Animated.ScrollView instead, so nothing
// virtualized ever sits inside the outer ScrollView. Each act's list gets its own
// DropProvider (per the hook's own documented usage), separate from the app-root one in
// App.tsx.
//
// Local `items` state mirrors the library's own example pattern (it owns the live drag
// visuals; the consuming app tracks the resulting order itself via onMove) -- re-synced
// from the store on external changes (e.g. a chapter edited elsewhere), persisted to
// Supabase via reorderChapters() once a drag actually completes (onDrop), not on every
// intermediate onMove event.
function ActChapterList({
  chapters,
  projectId,
  navigate,
}: {
  chapters: Chapter[];
  projectId: string;
  navigate: NavigateFn;
}) {
  const reorderChapters = useChapterStore((s) => s.reorderChapters);
  const [items, setItems] = useState(chapters);

  useEffect(() => {
    setItems(chapters);
  }, [chapters]);

  const handleMove = useCallback((id: string, from: number, to: number) => {
    setItems((prev) => {
      const idx = prev.findIndex((c) => c.id === id);
      if (idx === -1 || from === to) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }, []);

  const handleDrop = useCallback(() => {
    reorderChapters(items.map((c) => c.id));
  }, [items, reorderChapters]);

  const { scrollViewRef, dropProviderRef, handleScroll, handleScrollEnd, contentHeight, getItemProps } =
    useSortableList({ data: items, itemHeight: ROW_HEIGHT });

  return (
    <DropProvider ref={dropProviderRef}>
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
          <SortableItem key={item.id} data={item} {...getItemProps(item, index)} onMove={handleMove} onDrop={handleDrop}>
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
          </SortableItem>
        ))}
      </Animated.ScrollView>
    </DropProvider>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#120d08' },
  content: { padding: 16, paddingBottom: 40 },
  centered: { flex: 1, backgroundColor: '#120d08', alignItems: 'center', justifyContent: 'center' },
  error: { color: '#b8542e', fontSize: 13 },
  empty: { color: '#a8926a', fontSize: 13 },
  book: {
    marginBottom: 14,
    backgroundColor: '#1a130b',
    borderWidth: 1,
    borderColor: '#4a3a22',
    borderRadius: 8,
    overflow: 'hidden',
  },
  bookHeader: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 10 },
  bookTitle: { color: '#e9dcb8', fontSize: 16, fontWeight: '700', flex: 1 },
  bookMeta: { color: '#a8926a', fontSize: 11 },
  bookArrow: { color: '#c69a3a', fontSize: 12 },
  act: { paddingHorizontal: 14, paddingBottom: 10 },
  actTitle: {
    color: '#8a7355',
    fontSize: 10.5,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 8,
    marginBottom: 6,
  },
  chapterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: ROW_HEIGHT,
    borderTopWidth: 1,
    borderTopColor: '#2a2013',
    backgroundColor: '#1a130b',
  },
  dragHandle: {
    width: 30,
    height: ROW_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dragHandleText: { color: '#8a7355', fontSize: 16 },
  chapterRowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingRight: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  chapterTitle: { color: '#e9dcb8', fontSize: 14, flex: 1 },
  chapterMeta: { color: '#8a7355', fontSize: 11 },
});
