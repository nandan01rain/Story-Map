import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import type { SignedInStackParamList } from '../navigation/types';
import { analyseProse, type ProseReport, type SentenceBand } from '../lib/proseReport';
import { bookIndices, byBookOrder } from '../lib/storyData';
import { useChapterStore } from '../store/chapterStore';
import { FONTS, type ThemeColors, useTheme } from '../theme';
import BookChips from '../components/BookChips';

type Props = NativeStackScreenProps<SignedInStackParamList, 'ProseReport'>;

// The line-level report: one chapter, or a whole book, analysed on the device.

const BAND_LABEL: Record<SentenceBand, string> = {
  short: '1–8',
  medium: '9–20',
  long: '21–35',
  'very-long': '36+',
};

export default function ProseReportScreen({ route, navigation }: Props) {
  const { projectId, chapterId } = route.params;
  const chapters = useChapterStore((s) => s.chapters);
  const fetchChapters = useChapterStore((s) => s.fetchChapters);
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [bookIndex, setBookIndex] = useState<number | null>(null);

  useEffect(() => {
    if (chapters.length === 0) fetchChapters(projectId);
  }, [projectId, chapters.length, fetchChapters]);

  const projectChapters = useMemo(() => chapters.filter((c) => c.project_id === projectId), [chapters, projectId]);
  const chapter = chapterId ? projectChapters.find((c) => c.id === chapterId) : undefined;

  useLayoutEffect(() => {
    navigation.setOptions({ title: chapter ? 'Chapter report' : 'Prose report' });
  }, [navigation, chapter]);

  useEffect(() => {
    if (!chapterId && bookIndex === null && projectChapters.length) {
      const first = bookIndices(projectChapters).find((i) => projectChapters.some((c) => c.book === i && c.content));
      setBookIndex(first ?? 0);
    }
  }, [chapterId, bookIndex, projectChapters]);

  const text = useMemo(() => {
    if (chapter) return chapter.content ?? '';
    if (bookIndex === null) return '';
    return projectChapters
      .filter((c) => c.book === bookIndex)
      .sort(byBookOrder)
      .map((c) => c.content ?? '')
      .join('\n\n');
  }, [chapter, bookIndex, projectChapters]);

  const report: ProseReport | null = useMemo(() => (text.trim() ? analyseProse(text) : null), [text]);
  const bandMax = report ? Math.max(1, ...Object.values(report.bands)) : 1;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {chapter ? (
        <Text style={styles.subject}>{chapter.title}</Text>
      ) : (
        <BookChips books={bookIndices(projectChapters)} selected={bookIndex} onSelect={setBookIndex} style={styles.chips} />
      )}

      {!report ? (
        <Text style={styles.empty}>Nothing written here yet.</Text>
      ) : (
        <>
          <View style={styles.row}>
            <Stat label="Words" value={report.words.toLocaleString()} styles={styles} />
            <Stat label="Sentences" value={report.sentences.toLocaleString()} styles={styles} />
            <Stat label="Paragraphs" value={report.paragraphs.toLocaleString()} styles={styles} />
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Sentence length</Text>
            <Text style={styles.hint}>
              Average {report.avgSentence} words, median {report.medianSentence}. Longest run of one length:{' '}
              {report.longestSameBandRun.length} {report.longestSameBandRun.band.replace('-', ' ')} sentences in a row.
            </Text>
            <View style={styles.bars}>
              {(Object.keys(report.bands) as SentenceBand[]).map((b) => (
                <View key={b} style={styles.barRow}>
                  <Text style={styles.barLabel}>{BAND_LABEL[b]}</Text>
                  <View style={styles.barTrack}>
                    <View style={[styles.barFill, { width: `${Math.round((report.bands[b] / bandMax) * 100)}%` }]} />
                  </View>
                  <Text style={styles.barCount}>{report.bands[b]}</Text>
                </View>
              ))}
            </View>
          </View>

          <ListCard
            title="Repeated openings"
            hint="Sentences that begin with the same two words."
            items={report.repeatedOpenings.map((o) => ({ text: `“${o.opening}…”`, count: o.count }))}
            empty="No sentence opening repeats."
            styles={styles}
          />

          <ListCard
            title="Overused words"
            hint="Content words, with how many per thousand."
            items={report.overusedWords.map((w) => ({ text: w.word, count: w.count, meta: `${w.perThousand}‰` }))}
            empty="Nothing leans on one word."
            styles={styles}
          />

          <ListCard
            title={`Adverbs · ${report.adverbs.perThousand} per thousand words`}
            hint="-ly words. Under 10 per thousand is spare; over 30 is a habit."
            items={report.adverbs.top.map((w) => ({ text: w.word, count: w.count }))}
            empty="None."
            styles={styles}
          />

          <ListCard
            title="Filter words"
            hint="Words that put narration between the reader and the thing: felt, saw, suddenly, really…"
            items={report.filterWords.map((w) => ({ text: w.word, count: w.count }))}
            empty="None."
            styles={styles}
          />

          <ListCard
            title={`Dialogue · ${report.dialogue.share}% of the words`}
            hint="Tags used after a closing quote. 'Said' disappearing is the goal; a spread of synonyms is not."
            items={report.dialogue.tags.map((t) => ({ text: t.tag, count: t.count }))}
            empty="No tagged dialogue found."
            styles={styles}
          />

          <View style={styles.card}>
            <Text style={styles.label}>Paragraphs</Text>
            <Text style={styles.hint}>
              Average {report.paragraphLength.avg} words; the longest is {report.paragraphLength.longest}.
            </Text>
          </View>
        </>
      )}
    </ScrollView>
  );
}

function Stat({ label, value, styles }: { label: string; value: string; styles: ReturnType<typeof makeStyles> }) {
  return (
    <View style={[styles.card, styles.stat]}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.big}>{value}</Text>
    </View>
  );
}

function ListCard({
  title,
  hint,
  items,
  empty,
  styles,
}: {
  title: string;
  hint: string;
  items: { text: string; count: number; meta?: string }[];
  empty: string;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.label}>{title}</Text>
      <Text style={styles.hint}>{hint}</Text>
      {items.length === 0 ? (
        <Text style={styles.emptyLine}>{empty}</Text>
      ) : (
        items.map((it) => (
          <View key={it.text} style={styles.item}>
            <Text style={styles.itemText}>{it.text}</Text>
            {it.meta ? <Text style={styles.itemMeta}>{it.meta}</Text> : null}
            <Text style={styles.itemCount}>{it.count}</Text>
          </View>
        ))
      )}
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg },
    content: { padding: 16, gap: 12, paddingBottom: 40 },
    subject: { color: colors.text, fontFamily: FONTS.headingBold, fontSize: 17, letterSpacing: 1, textAlign: 'center' },
    chips: { marginHorizontal: -16 },
    empty: { color: colors.textFaint, fontFamily: FONTS.body, fontSize: 15, textAlign: 'center', marginTop: 40 },
    row: { flexDirection: 'row', gap: 12 },
    card: { backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 16 },
    stat: { flex: 1, padding: 12 },
    label: { color: colors.gold, fontFamily: FONTS.heading, fontSize: 11, letterSpacing: 2 },
    big: { color: colors.text, fontFamily: FONTS.headingBold, fontSize: 22, marginTop: 6 },
    hint: { color: colors.textDim, fontFamily: FONTS.body, fontSize: 12.5, lineHeight: 18, marginTop: 6 },
    bars: { marginTop: 12, gap: 8 },
    barRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    barLabel: { width: 44, color: colors.textDim, fontFamily: FONTS.mono, fontSize: 11 },
    barTrack: { flex: 1, height: 8, backgroundColor: colors.borderDim, borderRadius: 4, overflow: 'hidden' },
    barFill: { height: 8, backgroundColor: colors.gold },
    barCount: { width: 32, textAlign: 'right', color: colors.text, fontFamily: FONTS.mono, fontSize: 11 },
    item: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderDim, marginTop: 6 },
    itemText: { flex: 1, color: colors.text, fontFamily: FONTS.body, fontSize: 15 },
    itemMeta: { color: colors.textFaint, fontFamily: FONTS.mono, fontSize: 11 },
    itemCount: { color: colors.gold, fontFamily: FONTS.mono, fontSize: 13, minWidth: 24, textAlign: 'right' },
    emptyLine: { color: colors.textFaint, fontFamily: FONTS.body, fontSize: 13, marginTop: 8 },
  });
}
