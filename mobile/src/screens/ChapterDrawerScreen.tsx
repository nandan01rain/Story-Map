import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import type { SignedInStackParamList } from '../navigation/types';
import { BOOKS, chapterNumberInBook, statusColor, wordCount } from '../lib/storyData';
import { supabase } from '../lib/supabase';
import { type Chapter, useChapterStore } from '../store/chapterStore';
import { useSceneStore } from '../store/sceneStore';
import { FONTS, type ThemeColors, useTheme } from '../theme';

type Props = NativeStackScreenProps<SignedInStackParamList, 'ChapterDrawer'>;

const STATUSES: Chapter['status'][] = ['idea', 'outline', 'drafted', 'final'];
// Fixed (not theme-swapped) -- a semantic "within target" indicator, same blue in both
// day and night, the same way colors.error/colors.gold stay fixed for their own signals.
const WORD_COUNT_OK = '#4a90d9';

// Ports the PWA's chapter drawer (index.html, openDrawer()/renderChapterScenes()):
// title, position (book/act), status, notes, word count vs. book target, scenes list,
// delete, and "open full editor". Scene POV-autocomplete and requires/provides plant-
// tag editing are Phase 3 scope (POV tracker, continuity checker) -- scenes here are
// title/status/summary only, same fields, lighter editing surface.
export default function ChapterDrawerScreen({ route, navigation }: Props) {
  const { chapterId, projectId } = route.params;
  const chapter = useChapterStore((s) => s.chapters.find((c) => c.id === chapterId));
  const allChapters = useChapterStore((s) => s.chapters);
  const updateChapter = useChapterStore((s) => s.updateChapter);
  const deleteChapter = useChapterStore((s) => s.deleteChapter);
  const { scenes, fetchScenes, createScene, updateScene, deleteScene } = useSceneStore();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const chapterNumber = useMemo(
    () => (chapter ? chapterNumberInBook(chapter, allChapters) : null),
    [allChapters, chapter],
  );

  const [title, setTitle] = useState(chapter?.title ?? '');
  const [notes, setNotes] = useState(chapter?.notes ?? '');
  const [wordTarget, setWordTarget] = useState<[number | null, number | null]>([null, null]);

  useFocusEffect(
    useCallback(() => {
      fetchScenes(chapterId);
    }, [chapterId, fetchScenes]),
  );

  useEffect(() => {
    if (chapter) {
      setTitle(chapter.title);
      setNotes(chapter.notes);
    }
  }, [chapter]);

  // Same fix as EditorScreen: this screen's own hardcoded route title ("Chapter", set in
  // RootNavigator) was never being overridden with the real chapter title.
  useLayoutEffect(() => {
    if (chapter?.title) navigation.setOptions({ title: chapter.title });
  }, [navigation, chapter?.title]);

  useEffect(() => {
    if (!chapter) return;
    supabase
      .from('project_settings')
      .select('chapter_word_targets')
      .eq('project_id', projectId)
      .maybeSingle()
      .then(({ data }) => {
        const targets = data?.chapter_word_targets as [number, number][] | undefined;
        const range = targets?.[chapter.book];
        setWordTarget(range ?? [null, null]);
      });
  }, [chapter, projectId]);

  if (!chapter) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.gold} />
      </View>
    );
  }

  function commitTitle() {
    const trimmed = title.trim() || 'Untitled chapter';
    if (trimmed !== chapter!.title) updateChapter(chapterId, { title: trimmed });
  }

  function commitNotes() {
    if (notes !== chapter!.notes) updateChapter(chapterId, { notes });
  }

  function handleDelete() {
    Alert.alert('Delete chapter', `Delete "${chapter!.title}"? This cannot be undone yet (trash isn't built).`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { error } = await deleteChapter(chapterId);
          if (error) Alert.alert('Could not delete', error);
          else navigation.goBack();
        },
      },
    ]);
  }

  const wc = wordCount(chapter.content);
  const [, targetMax] = wordTarget;
  // Book-level target, not re-entered per chapter -- see project_settings fetch above.
  // Rather than repeating "target: X-Y" on every single chapter, the count itself just
  // glows: blue under 75% of target, yellow from 75% up to the target, red past it.
  // No target set at all -> default text color, no judgment either way.
  const wordCountColor =
    targetMax === null ? colors.text : wc > targetMax ? colors.error : wc >= targetMax * 0.75 ? colors.gold : WORD_COUNT_OK;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.position}>
        {BOOKS[chapter.book]}, Act {chapter.act}
        {chapterNumber !== null ? `, Chapter ${chapterNumber}` : ''}
      </Text>
      <TextInput
        style={styles.titleInput}
        value={title}
        onChangeText={setTitle}
        onBlur={commitTitle}
        placeholder="Chapter title"
        placeholderTextColor={colors.textFaint}
      />

      <View style={styles.statusRow}>
        {STATUSES.map((s) => (
          <Pressable
            key={s}
            style={[
              styles.statusPill,
              { borderColor: statusColor(s) },
              chapter.status === s && { backgroundColor: statusColor(s) },
            ]}
            onPress={() => updateChapter(chapterId, { status: s })}
          >
            <Text style={[styles.statusPillText, chapter.status === s && styles.statusPillTextActive]}>{s}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={[styles.wordCount, { color: wordCountColor }]}>
        {wc} {wc === 1 ? 'word' : 'words'}
      </Text>

      <Text style={styles.label}>Notes</Text>
      <TextInput
        style={styles.notesInput}
        value={notes}
        onChangeText={setNotes}
        onBlur={commitNotes}
        placeholder="Anything to remember about this chapter..."
        placeholderTextColor={colors.textFaint}
        multiline
      />

      <View style={styles.scenesHeader}>
        <Text style={styles.label}>Scenes</Text>
        <Pressable onPress={() => createScene(chapterId, projectId, scenes.length)}>
          <Text style={styles.addSceneBtn}>+ Add scene</Text>
        </Pressable>
      </View>
      {scenes.map((scene) => (
        <View key={scene.id} style={styles.sceneCard}>
          <View style={styles.sceneCardHead}>
            <TextInput
              style={styles.sceneTitleInput}
              value={scene.title}
              onChangeText={(t) => updateScene(scene.id, { title: t })}
              placeholder="Scene title"
              placeholderTextColor={colors.textFaint}
            />
            <Pressable onPress={() => deleteScene(scene.id)} hitSlop={10}>
              <Text style={styles.sceneRemove}>×</Text>
            </Pressable>
          </View>
          <View style={styles.sceneStatusRow}>
            {STATUSES.map((s) => (
              <Pressable
                key={s}
                style={[
                  styles.sceneStatusPill,
                  { borderColor: statusColor(s) },
                  scene.status === s && { backgroundColor: statusColor(s) },
                ]}
                onPress={() => updateScene(scene.id, { status: s })}
              >
                <Text style={styles.sceneStatusPillText}>{s}</Text>
              </Pressable>
            ))}
          </View>
          <TextInput
            style={styles.sceneSummaryInput}
            value={scene.summary}
            onChangeText={(t) => updateScene(scene.id, { summary: t })}
            placeholder="What happens in this scene..."
            placeholderTextColor={colors.textFaint}
            multiline
          />
        </View>
      ))}

      <Pressable style={styles.editorBtn} onPress={() => navigation.navigate('Editor', { chapterId })}>
        <Text style={styles.editorBtnText}>Editor</Text>
      </Pressable>

      <Pressable style={styles.deleteBtn} onPress={handleDelete}>
        <Text style={styles.deleteBtnText}>Delete chapter</Text>
      </Pressable>
    </ScrollView>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg },
    content: { padding: 20, paddingBottom: 60 },
    centered: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
    position: { color: colors.textFaint, fontFamily: FONTS.mono, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
    titleInput: { color: colors.text, fontFamily: FONTS.heading, fontSize: 20, paddingVertical: 4 },
    statusRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
    statusPill: { borderWidth: 1, borderRadius: 20, paddingVertical: 5, paddingHorizontal: 12 },
    statusPillText: { color: colors.textDim, fontFamily: FONTS.mono, fontSize: 11, textTransform: 'capitalize' },
    // Fixed dark text, not theme-driven -- this renders on top of a saturated status
    // color (statusColor(s)), not the page background, so it needs to stay legible
    // against those specific colors in both day and night, not swap with the theme.
    statusPillTextActive: { color: '#120d08', fontFamily: FONTS.bodySemiBold },
    wordCount: { color: colors.text, fontFamily: FONTS.mono, fontSize: 13, marginTop: 14 },
    label: {
      color: colors.textFaint,
      fontSize: 10.5,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginTop: 20,
      marginBottom: 8,
    },
    notesInput: {
      backgroundColor: colors.panel,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 6,
      padding: 11,
      fontSize: 14,
      color: colors.text,
      minHeight: 70,
      textAlignVertical: 'top',
    },
    scenesHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20 },
    addSceneBtn: { color: colors.gold, fontSize: 12 },
    sceneCard: {
      backgroundColor: colors.panel,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 12,
      marginBottom: 10,
    },
    sceneCardHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    sceneTitleInput: { flex: 1, color: colors.text, fontFamily: FONTS.literaryMedium, fontSize: 14.5 },
    sceneRemove: { color: colors.error, fontSize: 18, paddingHorizontal: 4 },
    sceneStatusRow: { flexDirection: 'row', gap: 6, marginTop: 8, marginBottom: 8 },
    sceneStatusPill: { borderWidth: 1, borderRadius: 12, paddingVertical: 3, paddingHorizontal: 8 },
    sceneStatusPillText: { color: colors.textDim, fontFamily: FONTS.mono, fontSize: 9, textTransform: 'capitalize' },
    sceneSummaryInput: { color: colors.textDim, fontFamily: FONTS.literary, fontSize: 13.5, minHeight: 40, textAlignVertical: 'top' },
    deleteBtn: {
      marginTop: 12,
      borderWidth: 1,
      borderColor: colors.error,
      borderRadius: 6,
      padding: 12,
      alignItems: 'center',
    },
    deleteBtnText: { color: colors.error, fontFamily: FONTS.bodySemiBold },
    editorBtn: { marginTop: 28, backgroundColor: colors.gold, borderRadius: 6, padding: 14, alignItems: 'center' },
    editorBtnText: { color: '#2b1a05', fontFamily: FONTS.bodySemiBold, fontSize: 15 },
  });
}
