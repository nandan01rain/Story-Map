import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import type { SignedInStackParamList } from '../navigation/types';
import { fetchCharacterGraph, setCharacterProperties, type GraphData } from '../lib/characterGraph';
import { agesIn, born, chapterTimes, findings, formatTime } from '../lib/chronology';
import { bookName } from '../lib/storyData';
import { useChapterStore } from '../store/chapterStore';
import { FONTS, type ThemeColors, useTheme, withOpacity } from '../theme';

type Props = NativeStackScreenProps<SignedInStackParamList, 'Chronology'>;

// The story's clock, laid against reading order. Mark a chapter's time where it matters;
// unmarked chapters follow the last mark. Give characters a birth time and every chapter
// shows their ages, and anyone present before they were born is called out.

export default function ChronologyScreen({ route, navigation }: Props) {
  const { projectId } = route.params;
  const chapters = useChapterStore((s) => s.chapters);
  const supported = useChapterStore((s) => s.storyTimeSupported);
  const fetchChapters = useChapterStore((s) => s.fetchChapters);
  const updateChapter = useChapterStore((s) => s.updateChapter);
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [graph, setGraph] = useState<GraphData | null>(null);
  const [graphError, setGraphError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [bornDrafts, setBornDrafts] = useState<Record<string, string>>({});
  const [savingBorn, setSavingBorn] = useState<string | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions({ title: 'Chronology' });
  }, [navigation]);

  useEffect(() => {
    if (chapters.length === 0) fetchChapters(projectId);
  }, [projectId, chapters.length, fetchChapters]);

  useEffect(() => {
    fetchCharacterGraph(projectId).then(({ data, error }) => {
      if (data) setGraph(data);
      if (error) setGraphError(error);
    });
  }, [projectId]);

  const projectChapters = useMemo(() => chapters.filter((c) => c.project_id === projectId), [chapters, projectId]);
  const times = useMemo(() => chapterTimes(projectChapters), [projectChapters]);
  const found = useMemo(() => findings(graph, times), [graph, times]);
  const characters = useMemo(() => (graph?.nodes ?? []).filter((n) => n.type === 'character'), [graph]);

  function commitTime(chapterId: string) {
    const raw = drafts[chapterId];
    if (raw === undefined) return;
    const trimmed = raw.trim();
    const value = trimmed === '' ? null : Number(trimmed);
    if (value !== null && !Number.isFinite(value)) return;
    void updateChapter(chapterId, { story_time: value });
    setDrafts((d) => {
      const next = { ...d };
      delete next[chapterId];
      return next;
    });
  }

  async function commitBorn(characterId: string) {
    const raw = bornDrafts[characterId];
    if (raw === undefined) return;
    const trimmed = raw.trim();
    const value = trimmed === '' ? null : Number(trimmed);
    if (value !== null && !Number.isFinite(value)) return;
    setSavingBorn(characterId);
    const { error } = await setCharacterProperties(characterId, { born: value });
    setSavingBorn(null);
    if (!error && graph) {
      setGraph({
        ...graph,
        nodes: graph.nodes.map((n) => (n.id === characterId ? { ...n, properties: { ...n.properties, born: value } } : n)),
      });
    }
    setBornDrafts((d) => {
      const next = { ...d };
      delete next[characterId];
      return next;
    });
  }

  let lastBook: number | null = null;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {!supported && (
        <View style={[styles.card, styles.warn]}>
          <Text style={styles.warnText}>
            Story times can't be saved yet: the database is missing the column. Paste
            supabase/migrations/20260825_spine_support.sql into the Supabase SQL editor once and reopen this screen.
          </Text>
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.label}>How this works</Text>
        <Text style={styles.hint}>
          Give a chapter a time in the story's own units -- year 1203, day 40, whatever the saga counts in. Chapters
          you leave blank follow the last one you marked, so a flashback is one number on the chapter that jumps.
          Give a character a birth time below and their age appears in every chapter they're in.
        </Text>
      </View>

      {found.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.label}>Findings</Text>
          {found.map((f, i) => (
            <Text key={i} style={[styles.finding, f.kind === 'before-birth' && styles.findingBad]}>
              {f.kind === 'before-birth'
                ? `${f.name} is in “${f.chapterTitle}” at ${formatTime(f.time)}, but is born at ${formatTime(f.born)}.`
                : f.kind === 'flashback'
                  ? `“${f.chapterTitle}” goes back from ${formatTime(f.from)} to ${formatTime(f.to)} -- a flashback, if you meant it.`
                  : `${f.count} chapter${f.count === 1 ? '' : 's'} with nobody placed in ${f.count === 1 ? 'it' : 'them'} -- no ages to check there.`}
            </Text>
          ))}
        </View>
      )}

      <Text style={styles.section}>Chapters</Text>
      {times.map((t) => {
        const showBook = t.chapter.book !== lastBook;
        lastBook = t.chapter.book;
        const ages = graph ? agesIn(graph, times, t.chapter.id) : [];
        return (
          <View key={t.chapter.id}>
            {showBook && <Text style={styles.book}>{bookName(t.chapter.book)}</Text>}
            <View style={[styles.row, t.flashback && styles.rowFlashback]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.title} numberOfLines={1}>{t.chapter.title}</Text>
                <Text style={styles.meta}>
                  {t.marked ? `at ${formatTime(t.time)}` : Number.isFinite(t.time) ? `follows · ${formatTime(t.time)}` : 'unplaced in time'}
                  {t.flashback ? ' · flashback' : ''}
                </Text>
                {ages.length > 0 && (
                  <Text style={styles.ages}>
                    {ages.map((a) => (a.age !== null ? `${a.name} ${formatTime(a.age)}` : a.name)).join(' · ')}
                  </Text>
                )}
              </View>
              <TextInput
                style={styles.timeInput}
                value={drafts[t.chapter.id] ?? (t.marked ? formatTime(t.time) : '')}
                onChangeText={(v) => setDrafts((d) => ({ ...d, [t.chapter.id]: v }))}
                onBlur={() => commitTime(t.chapter.id)}
                onSubmitEditing={() => commitTime(t.chapter.id)}
                keyboardType="numeric"
                placeholder="—"
                placeholderTextColor={colors.textFaint}
                editable={supported}
              />
            </View>
          </View>
        );
      })}

      <Text style={styles.section}>Characters</Text>
      {graphError ? (
        <Text style={styles.hint}>The cast needs the network: {graphError}</Text>
      ) : characters.length === 0 ? (
        <Text style={styles.hint}>No characters in the braid yet.</Text>
      ) : (
        characters.map((c) => {
          const b = born(c);
          return (
            <View key={c.id} style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>{c.label}</Text>
                <Text style={styles.meta}>{b !== null ? `born ${formatTime(b)}` : 'birth time not set'}</Text>
              </View>
              <TextInput
                style={styles.timeInput}
                value={bornDrafts[c.id] ?? (b !== null ? formatTime(b) : '')}
                onChangeText={(v) => setBornDrafts((d) => ({ ...d, [c.id]: v }))}
                onBlur={() => commitBorn(c.id)}
                onSubmitEditing={() => commitBorn(c.id)}
                keyboardType="numeric"
                placeholder="born"
                placeholderTextColor={colors.textFaint}
                editable={savingBorn !== c.id}
              />
            </View>
          );
        })
      )}
      <Pressable onPress={() => navigation.navigate('Braid', { projectId })} style={styles.link}>
        <Text style={styles.linkText}>Place characters in chapters in the Braid →</Text>
      </Pressable>
    </ScrollView>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg },
    content: { padding: 16, gap: 10, paddingBottom: 60 },
    card: { backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14 },
    warn: { borderColor: colors.gold, backgroundColor: withOpacity(colors.gold, 0.08) },
    warnText: { color: colors.text, fontFamily: FONTS.body, fontSize: 13, lineHeight: 19 },
    label: { color: colors.gold, fontFamily: FONTS.heading, fontSize: 11, letterSpacing: 2 },
    hint: { color: colors.textDim, fontFamily: FONTS.body, fontSize: 12.5, lineHeight: 18, marginTop: 6 },
    finding: { color: colors.text, fontFamily: FONTS.body, fontSize: 13.5, lineHeight: 19, marginTop: 8 },
    findingBad: { color: colors.error },
    section: { color: colors.gold, fontFamily: FONTS.heading, fontSize: 12, letterSpacing: 2, marginTop: 14 },
    book: { color: colors.textDim, fontFamily: FONTS.heading, fontSize: 11, letterSpacing: 1.5, marginTop: 10, marginBottom: 4 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.borderDim,
    },
    rowFlashback: { borderLeftWidth: 2, borderLeftColor: colors.gold, paddingLeft: 8 },
    title: { color: colors.text, fontFamily: FONTS.bodySemiBold, fontSize: 14.5 },
    meta: { color: colors.textFaint, fontFamily: FONTS.mono, fontSize: 11, marginTop: 2 },
    ages: { color: colors.textDim, fontFamily: FONTS.body, fontSize: 12.5, marginTop: 3 },
    timeInput: {
      width: 84,
      textAlign: 'right',
      color: colors.text,
      fontFamily: FONTS.mono,
      fontSize: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      paddingVertical: 4,
    },
    link: { paddingVertical: 14 },
    linkText: { color: colors.gold, fontFamily: FONTS.body, fontSize: 13 },
  });
}
