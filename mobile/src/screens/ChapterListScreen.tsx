import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { SignedInStackParamList } from '../navigation/types';
import { BOOKS, statusColor, wordCount } from '../lib/storyData';
import { type Chapter, useChapterStore } from '../store/chapterStore';

type Props = NativeStackScreenProps<SignedInStackParamList, 'ChapterList'>;

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
                    {actChapters.map((ch) => (
                      <Pressable
                        key={ch.id}
                        style={styles.chapterRow}
                        onPress={() => navigation.navigate('ChapterDrawer', { chapterId: ch.id, projectId })}
                      >
                        <View style={[styles.dot, { backgroundColor: statusColor(ch.status) }]} />
                        <Text style={styles.chapterTitle} numberOfLines={1}>
                          {ch.title}
                        </Text>
                        <Text style={styles.chapterMeta}>{wordCount(ch.content)}w</Text>
                      </Pressable>
                    ))}
                  </View>
                );
              })}
          </View>
        );
      })}
    </ScrollView>
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
    gap: 10,
    paddingVertical: 9,
    borderTopWidth: 1,
    borderTopColor: '#2a2013',
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  chapterTitle: { color: '#e9dcb8', fontSize: 14, flex: 1 },
  chapterMeta: { color: '#8a7355', fontSize: 11 },
});
