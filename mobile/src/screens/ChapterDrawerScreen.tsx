import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useState } from 'react';
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

type Props = NativeStackScreenProps<SignedInStackParamList, 'ChapterDrawer'>;

const STATUSES: Chapter['status'][] = ['idea', 'outline', 'drafted', 'final'];

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
        <ActivityIndicator color="#c69a3a" />
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
  const [targetMin, targetMax] = wordTarget;

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
        placeholderTextColor="#8a7355"
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

      <Text style={styles.wordCount}>
        {wc} {wc === 1 ? 'word' : 'words'}
        <Text style={styles.wordTarget}>
          {'  ·  book target: '}
          {targetMin ?? '—'}–{targetMax ?? '—'} per chapter
        </Text>
      </Text>

      <Text style={styles.label}>Notes</Text>
      <TextInput
        style={styles.notesInput}
        value={notes}
        onChangeText={setNotes}
        onBlur={commitNotes}
        placeholder="Anything to remember about this chapter..."
        placeholderTextColor="#8a7355"
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
              placeholderTextColor="#8a7355"
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
            placeholderTextColor="#8a7355"
            multiline
          />
        </View>
      ))}

      <Pressable style={styles.deleteBtn} onPress={handleDelete}>
        <Text style={styles.deleteBtnText}>Delete chapter</Text>
      </Pressable>

      <Pressable style={styles.editorBtn} onPress={() => navigation.navigate('Editor', { chapterId })}>
        <Text style={styles.editorBtnText}>Open full editor →</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#120d08' },
  content: { padding: 20, paddingBottom: 60 },
  centered: { flex: 1, backgroundColor: '#120d08', alignItems: 'center', justifyContent: 'center' },
  position: { color: '#8a7355', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  titleInput: { color: '#e9dcb8', fontSize: 20, fontWeight: '600', paddingVertical: 4 },
  statusRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  statusPill: { borderWidth: 1, borderRadius: 20, paddingVertical: 5, paddingHorizontal: 12 },
  statusPillText: { color: '#a8926a', fontSize: 11, textTransform: 'capitalize' },
  statusPillTextActive: { color: '#120d08', fontWeight: '700' },
  wordCount: { color: '#e9dcb8', fontSize: 13, marginTop: 14 },
  wordTarget: { color: '#8a7355', fontSize: 12 },
  label: {
    color: '#8a7355',
    fontSize: 10.5,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 20,
    marginBottom: 8,
  },
  notesInput: {
    backgroundColor: '#1a130b',
    borderWidth: 1,
    borderColor: '#4a3a22',
    borderRadius: 6,
    padding: 11,
    fontSize: 14,
    color: '#e9dcb8',
    minHeight: 70,
    textAlignVertical: 'top',
  },
  scenesHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20 },
  addSceneBtn: { color: '#c69a3a', fontSize: 12 },
  sceneCard: {
    backgroundColor: '#1a130b',
    borderWidth: 1,
    borderColor: '#4a3a22',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
  },
  sceneCardHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sceneTitleInput: { flex: 1, color: '#e9dcb8', fontSize: 14, fontWeight: '600' },
  sceneRemove: { color: '#b8542e', fontSize: 18, paddingHorizontal: 4 },
  sceneStatusRow: { flexDirection: 'row', gap: 6, marginTop: 8, marginBottom: 8 },
  sceneStatusPill: { borderWidth: 1, borderRadius: 12, paddingVertical: 3, paddingHorizontal: 8 },
  sceneStatusPillText: { color: '#a8926a', fontSize: 9, textTransform: 'capitalize' },
  sceneSummaryInput: { color: '#c9b892', fontSize: 13, minHeight: 40, textAlignVertical: 'top' },
  deleteBtn: {
    marginTop: 28,
    borderWidth: 1,
    borderColor: '#b8542e',
    borderRadius: 6,
    padding: 12,
    alignItems: 'center',
  },
  deleteBtnText: { color: '#b8542e', fontWeight: '600' },
  editorBtn: { marginTop: 12, backgroundColor: '#c69a3a', borderRadius: 6, padding: 14, alignItems: 'center' },
  editorBtnText: { color: '#2b1a05', fontWeight: '700', fontSize: 15 },
});
