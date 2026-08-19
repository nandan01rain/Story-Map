import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { supabase } from '../lib/supabase';
import { BOOKS } from '../lib/storyData';
import type { SignedInStackParamList } from '../navigation/types';
import { useChapterStore } from '../store/chapterStore';
import { useStickyNoteStore } from '../store/stickyNoteStore';
import { FONTS, type ThemeColors, useTheme, withOpacity } from '../theme';

type Props = NativeStackScreenProps<SignedInStackParamList, 'Search'>;

const MIN_QUERY_LENGTH = 2;
const SNIPPET_PAD = 50;

type SceneRow = { id: string; chapter_id: string; title: string; summary: string | null };
type Hit = {
  key: string;
  type: string;
  title: string;
  meta: string;
  source: string;
  open: () => void;
};

// Ports the PWA's runSearch() (index.html): one query matched case-insensitively against
// chapters (title + prose), scenes (title + summary) and sticky notes, in that order,
// each result showing its type, where it lives, and a snippet with the matched text
// highlighted. Documents are the one PWA category missing here -- they have no mobile
// screen to open yet, so a hit would have nowhere to go.
function snippetRange(text: string, query: string): { text: string; matchStart: number; matchEnd: number } {
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return { text: text.slice(0, 120), matchStart: -1, matchEnd: -1 };
  const start = Math.max(0, idx - SNIPPET_PAD);
  const end = Math.min(text.length, idx + query.length + SNIPPET_PAD);
  const prefix = start > 0 ? '…' : '';
  return {
    text: prefix + text.slice(start, end) + (end < text.length ? '…' : ''),
    matchStart: prefix.length + (idx - start),
    matchEnd: prefix.length + (idx - start) + query.length,
  };
}

export default function SearchScreen({ route, navigation }: Props) {
  const { projectId } = route.params;
  const [query, setQuery] = useState('');
  const [scenes, setScenes] = useState<SceneRow[]>([]);
  const { chapters, fetchChapters, loading: chaptersLoading } = useChapterStore();
  const { notes, fetchNotes } = useStickyNoteStore();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  useEffect(() => {
    navigation.setOptions({ title: 'Search' });
  }, [navigation]);

  useEffect(() => {
    if (chapters.length === 0) fetchChapters(projectId);
    fetchNotes(projectId);
    supabase
      .from('scenes')
      .select('id, chapter_id, title, summary')
      .eq('project_id', projectId)
      .then(({ data }) => setScenes((data as SceneRow[]) ?? []));
  }, [projectId, chapters.length, fetchChapters, fetchNotes]);

  const q = query.trim();

  const hits = useMemo<Hit[]>(() => {
    if (q.length < MIN_QUERY_LENGTH) return [];
    const needle = q.toLowerCase();
    const list: Hit[] = [];

    for (const ch of chapters) {
      if (!`${ch.title} ${ch.content ?? ''}`.toLowerCase().includes(needle)) continue;
      list.push({
        key: `chapter-${ch.id}`,
        type: 'Chapter',
        title: ch.title,
        meta: `${BOOKS[ch.book] ?? `Book ${ch.book + 1}`} · Act ${ch.act}`,
        source: ch.content || ch.title,
        open: () => navigation.navigate('Editor', { chapterId: ch.id }),
      });
    }

    for (const s of scenes) {
      if (!`${s.title} ${s.summary ?? ''}`.toLowerCase().includes(needle)) continue;
      const ch = chapters.find((c) => c.id === s.chapter_id);
      list.push({
        key: `scene-${s.id}`,
        type: 'Scene',
        title: s.title,
        meta: ch ? `${BOOKS[ch.book] ?? `Book ${ch.book + 1}`} · ${ch.title}` : '',
        source: s.summary || s.title,
        open: () => navigation.navigate('ChapterDrawer', { chapterId: s.chapter_id, projectId }),
      });
    }

    for (const n of notes) {
      if (!(n.content ?? '').toLowerCase().includes(needle)) continue;
      list.push({
        key: `note-${n.id}`,
        type: 'Note',
        title: 'Margin note',
        meta: new Date(n.created_at).toLocaleDateString(),
        source: n.content,
        open: () => navigation.navigate('StickyNotes', { projectId, noteId: n.id }),
      });
    }

    return list;
  }, [q, chapters, scenes, notes, navigation, projectId]);

  return (
    <View style={styles.screen}>
      <TextInput
        style={styles.input}
        value={query}
        onChangeText={setQuery}
        placeholder="Search everything you've written"
        placeholderTextColor={colors.textFaint}
        autoFocus
        autoCorrect={false}
        returnKeyType="search"
      />

      {chaptersLoading && chapters.length === 0 ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.gold} />
        </View>
      ) : q.length < MIN_QUERY_LENGTH ? (
        <View style={styles.centered}>
          <Text style={styles.hint}>Type at least two characters.</Text>
        </View>
      ) : hits.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.hint}>Nothing found for "{q}".</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.results} keyboardShouldPersistTaps="handled">
          {hits.map((hit) => {
            const snippet = snippetRange(hit.source, q);
            return (
              <Pressable key={hit.key} style={styles.result} onPress={hit.open}>
                <Text style={styles.resultType}>
                  {hit.type}
                  {hit.meta ? ` — ${hit.meta}` : ''}
                </Text>
                <Text style={styles.resultTitle} numberOfLines={1}>
                  {hit.title}
                </Text>
                <Text style={styles.resultSnippet} numberOfLines={3}>
                  {snippet.matchStart === -1 ? (
                    snippet.text
                  ) : (
                    <>
                      {snippet.text.slice(0, snippet.matchStart)}
                      <Text style={styles.mark}>{snippet.text.slice(snippet.matchStart, snippet.matchEnd)}</Text>
                      {snippet.text.slice(snippet.matchEnd)}
                    </>
                  )}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg },
    input: {
      margin: 16,
      backgroundColor: colors.panel,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      paddingHorizontal: 14,
      paddingVertical: 11,
      color: colors.text,
      fontSize: 15,
    },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
    hint: { color: colors.textDim, fontSize: 13, textAlign: 'center' },
    results: { paddingHorizontal: 16, paddingBottom: 40 },
    result: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      backgroundColor: colors.panel,
      padding: 14,
      marginBottom: 10,
    },
    resultType: {
      color: colors.textFaint,
      fontFamily: FONTS.mono,
      fontSize: 10,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    resultTitle: { color: colors.gold, fontFamily: FONTS.heading, fontSize: 15, marginTop: 4 },
    resultSnippet: { color: colors.textDim, fontFamily: FONTS.literary, fontSize: 13, lineHeight: 20, marginTop: 6 },
    mark: { color: colors.text, backgroundColor: withOpacity(colors.gold, 0.35) },
  });
}
