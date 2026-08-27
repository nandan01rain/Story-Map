import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { supabase } from '../lib/supabase';
import { BOOKS } from '../lib/storyData';
import type { SignedInStackParamList } from '../navigation/types';
import { useChapterStore } from '../store/chapterStore';
import { pageTitle, usePageStore } from '../store/pageStore';
import { FONTS, type ThemeColors, useTheme, withOpacity } from '../theme';

type Props = NativeStackScreenProps<SignedInStackParamList, 'Search'>;

const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 220;
const SNIPPET_PAD = 50;

// Search is not a convenience here, it is what makes the pile safe to deposit into. A page
// nobody can find again in three seconds is a page that was lost the moment it was written,
// which is the exact failure the pages build exists to answer. So this searches everything
// the project holds -- pages, chapters, scenes, documents -- from one box.
//
// Two engines, same results shape:
//
//   * search_everything() (20260826_pages.sql): Postgres full-text, GIN-indexed, ranked,
//     with server-side ts_headline snippets. Handles stemming and phrases and does not drag
//     the whole project over the wire to filter it on the phone.
//
//   * a client-side substring scan, used only when that function is not on the live project
//     yet. It is the search this screen had before, kept because search breaking while a
//     migration sits unapplied is worse than search being naive.

type Hit = {
  key: string;
  kind: 'page' | 'chapter' | 'scene' | 'document';
  label: string;
  title: string;
  meta: string;
  /** Pre-split snippet: alternating plain/highlighted runs, starting plain. */
  runs: string[];
  open: () => void;
};

const KIND_LABEL: Record<Hit['kind'], string> = {
  page: 'Page',
  chapter: 'Chapter',
  scene: 'Scene',
  document: 'Document',
};

type RpcRow = {
  kind: Hit['kind'];
  id: string;
  parent_id: string | null;
  title: string | null;
  snippet: string | null;
  rank: number;
  at: string | null;
};

/**
 * ts_headline hands back `<mark>`-wrapped HTML, which React Native cannot render. Split it
 * into alternating plain/marked runs instead. Entities are unescaped because ts_headline
 * escapes the text it wraps, and prose is full of ampersands and quotes.
 */
export function splitHeadline(html: string): string[] {
  const unescape = (s: string) =>
    s
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, '&');
  return html.split(/<\/?mark>/).map(unescape);
}

/** Client-fallback snippet: same alternating-runs shape, built around the first match. */
function substringRuns(text: string, query: string): string[] {
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return [text.slice(0, 140)];
  const start = Math.max(0, idx - SNIPPET_PAD);
  const end = Math.min(text.length, idx + query.length + SNIPPET_PAD);
  return [
    (start > 0 ? '…' : '') + text.slice(start, idx),
    text.slice(idx, idx + query.length),
    text.slice(idx + query.length, end) + (end < text.length ? '…' : ''),
  ];
}

type SceneRow = { id: string; chapter_id: string; title: string; summary: string | null };
type DocRow = { id: string; title: string; content: string | null };

export default function SearchScreen({ route, navigation }: Props) {
  const { projectId } = route.params;
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [rows, setRows] = useState<RpcRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [fullText, setFullText] = useState(true);

  const { chapters, fetchChapters } = useChapterStore();
  const { pages, fetchPages } = usePageStore();
  const [scenes, setScenes] = useState<SceneRow[]>([]);
  const [documents, setDocuments] = useState<DocRow[]>([]);
  const fallbackLoaded = useRef(false);

  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  useEffect(() => {
    navigation.setOptions({ title: 'Search' });
  }, [navigation]);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(query.trim()), DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [query]);

  // Only paid for if the RPC turns out to be missing -- there is no reason to pull every
  // chapter's prose onto the phone when Postgres is doing the searching.
  const loadFallbackCorpus = useCallback(async () => {
    if (fallbackLoaded.current) return;
    fallbackLoaded.current = true;
    if (chapters.length === 0) fetchChapters(projectId);
    fetchPages(projectId);
    const [sceneRes, docRes] = await Promise.all([
      supabase.from('scenes').select('id, chapter_id, title, summary').eq('project_id', projectId),
      supabase.from('documents').select('id, title, content').eq('project_id', projectId),
    ]);
    setScenes((sceneRes.data as SceneRow[]) ?? []);
    setDocuments((docRes.data as DocRow[]) ?? []);
  }, [projectId, chapters.length, fetchChapters, fetchPages]);

  useEffect(() => {
    let cancelled = false;
    if (debounced.length < MIN_QUERY_LENGTH) {
      setRows([]);
      return;
    }
    if (!fullText) {
      loadFallbackCorpus();
      return;
    }
    setSearching(true);
    supabase
      .rpc('search_everything', { p_project_id: projectId, p_query: debounced })
      .then(({ data, error }) => {
        if (cancelled) return;
        setSearching(false);
        if (error) {
          // The function is not on this project yet. Say so once and switch engines for
          // the rest of the session rather than retrying on every keystroke.
          setFullText(false);
          loadFallbackCorpus();
          return;
        }
        setRows((data as RpcRow[]) ?? []);
      });
    return () => {
      cancelled = true;
    };
  }, [debounced, projectId, fullText, loadFallbackCorpus]);

  const openers = useMemo(
    () => ({
      page: (id: string) => () => navigation.navigate('Page', { projectId, pageId: id }),
      chapter: (id: string) => () => navigation.navigate('Editor', { chapterId: id }),
      scene: (chapterId: string) => () => navigation.navigate('ChapterDrawer', { chapterId, projectId }),
      document: () => () => navigation.navigate('Documents', { projectId }),
    }),
    [navigation, projectId],
  );

  const hits = useMemo<Hit[]>(() => {
    if (debounced.length < MIN_QUERY_LENGTH) return [];

    if (fullText) {
      return rows.map((r) => {
        const chapter = r.kind === 'scene' ? chapters.find((c) => c.id === r.parent_id) : undefined;
        return {
          key: `${r.kind}-${r.id}`,
          kind: r.kind,
          label: KIND_LABEL[r.kind],
          title: r.title?.trim() || (r.kind === 'page' ? 'Untitled page' : 'Untitled'),
          meta:
            r.kind === 'page' && r.at
              ? new Date(r.at).toLocaleDateString()
              : chapter
                ? `${BOOKS[chapter.book] ?? `Book ${chapter.book + 1}`} · ${chapter.title}`
                : '',
          runs: splitHeadline(r.snippet ?? ''),
          open:
            r.kind === 'scene'
              ? openers.scene(r.parent_id ?? '')
              : r.kind === 'document'
                ? openers.document()
                : r.kind === 'page'
                  ? openers.page(r.id)
                  : openers.chapter(r.id),
        };
      });
    }

    const needle = debounced.toLowerCase();
    const list: Hit[] = [];

    for (const ch of chapters) {
      if (!`${ch.title} ${ch.content ?? ''}`.toLowerCase().includes(needle)) continue;
      list.push({
        key: `chapter-${ch.id}`,
        kind: 'chapter',
        label: KIND_LABEL.chapter,
        title: ch.title,
        meta: `${BOOKS[ch.book] ?? `Book ${ch.book + 1}`} · Act ${ch.act}`,
        runs: substringRuns(ch.content || ch.title, debounced),
        open: openers.chapter(ch.id),
      });
    }

    for (const s of scenes) {
      if (!`${s.title} ${s.summary ?? ''}`.toLowerCase().includes(needle)) continue;
      const ch = chapters.find((c) => c.id === s.chapter_id);
      list.push({
        key: `scene-${s.id}`,
        kind: 'scene',
        label: KIND_LABEL.scene,
        title: s.title,
        meta: ch ? `${BOOKS[ch.book] ?? `Book ${ch.book + 1}`} · ${ch.title}` : '',
        runs: substringRuns(s.summary || s.title, debounced),
        open: openers.scene(s.chapter_id),
      });
    }

    for (const d of documents) {
      if (!`${d.title} ${d.content ?? ''}`.toLowerCase().includes(needle)) continue;
      list.push({
        key: `document-${d.id}`,
        kind: 'document',
        label: KIND_LABEL.document,
        title: d.title,
        meta: '',
        runs: substringRuns(d.content || d.title, debounced),
        open: openers.document(),
      });
    }

    for (const p of pages) {
      if (!(p.content ?? '').toLowerCase().includes(needle)) continue;
      list.push({
        key: `page-${p.id}`,
        kind: 'page',
        label: KIND_LABEL.page,
        title: pageTitle(p) || 'Untitled page',
        meta: new Date(p.updated_at ?? p.created_at).toLocaleDateString(),
        runs: substringRuns(p.content, debounced),
        open: openers.page(p.id),
      });
    }

    return list;
  }, [debounced, fullText, rows, chapters, scenes, documents, pages, openers]);

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

      {debounced.length < MIN_QUERY_LENGTH ? (
        <View style={styles.centered}>
          <Text style={styles.hint}>Type at least two characters.</Text>
        </View>
      ) : searching && hits.length === 0 ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.gold} />
        </View>
      ) : hits.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.hint}>Nothing found for "{debounced}".</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.results} keyboardShouldPersistTaps="handled">
          {hits.map((hit) => (
            <Pressable key={hit.key} style={styles.result} onPress={hit.open}>
              <Text style={styles.resultType}>
                {hit.label}
                {hit.meta ? ` — ${hit.meta}` : ''}
              </Text>
              <Text style={styles.resultTitle} numberOfLines={1}>
                {hit.title}
              </Text>
              <Text style={styles.resultSnippet} numberOfLines={3}>
                {hit.runs.map((run, i) =>
                  i % 2 === 1 ? (
                    <Text key={i} style={styles.mark}>
                      {run}
                    </Text>
                  ) : (
                    run
                  ),
                )}
              </Text>
            </Pressable>
          ))}
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
