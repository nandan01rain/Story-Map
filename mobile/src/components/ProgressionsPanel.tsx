import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { bookName, byReadingOrder, chapterNumberInBook } from '../lib/storyData';
import { useChapterStore } from '../store/chapterStore';
import { useProgressionStore } from '../store/progressionStore';
import { FONTS, type ThemeColors, useTheme, withOpacity } from '../theme';

// What this document says AS OF a chapter. Sits under a document's body. Each entry is a
// note anchored to the chapter from which it holds; read in reading order they are the
// entry as it stands at any point in the saga. See migration 20260921_progressions.sql.

export default function ProgressionsPanel({
  documentId,
  projectId,
  userId,
}: {
  documentId: string;
  projectId: string;
  userId: string;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const chapters = useChapterStore((s) => s.chapters);
  const fetchChapters = useChapterStore((s) => s.fetchChapters);
  const { byDocument, supported, fetchForDocument, add, update, remove } = useProgressionStore();
  const [adding, setAdding] = useState(false);
  const [note, setNote] = useState('');
  const [fromChapterId, setFromChapterId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    void fetchForDocument(documentId);
    if (chapters.length === 0) void fetchChapters(projectId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId]);

  const reading = useMemo(
    () => chapters.filter((c) => c.project_id === projectId).sort(byReadingOrder),
    [chapters, projectId],
  );
  const order = useMemo(() => new Map(reading.map((c, i) => [c.id, i])), [reading]);
  const list = useMemo(
    () => [...(byDocument[documentId] ?? [])].sort((a, b) => (order.get(a.from_chapter_id ?? '') ?? 1e9) - (order.get(b.from_chapter_id ?? '') ?? 1e9)),
    [byDocument, documentId, order],
  );

  function chapterLabel(id: string | null): string {
    if (!id) return 'from the start';
    const ch = reading.find((c) => c.id === id);
    if (!ch) return 'a deleted chapter';
    const n = chapterNumberInBook(ch, reading);
    return `${bookName(ch.book)} · Ch ${n ?? '?'} · ${ch.title}`;
  }

  function startAdd() {
    setEditingId(null);
    setNote('');
    setFromChapterId(null);
    setAdding(true);
  }
  function startEdit(id: string) {
    const p = list.find((x) => x.id === id);
    if (!p) return;
    setEditingId(id);
    setNote(p.note);
    setFromChapterId(p.from_chapter_id);
    setAdding(true);
  }
  async function save() {
    const text = note.trim();
    if (!text) return;
    const { error } = editingId
      ? await update(editingId, { note: text, from_chapter_id: fromChapterId })
      : await add({ documentId, projectId, userId, fromChapterId, note: text });
    if (error) Alert.alert('Not saved', error);
    else setAdding(false);
  }
  function confirmRemove(id: string) {
    Alert.alert('Remove this progression?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => void remove(id) },
    ]);
  }

  if (!supported) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.label}>Progressions</Text>
        <Text style={styles.hint}>
          Needs the database table: paste supabase/migrations/20260921_progressions.sql into the Supabase SQL editor once.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Text style={styles.label}>Progressions</Text>
        <Pressable onPress={startAdd} hitSlop={8}>
          <Text style={styles.addText}>+ As of a chapter</Text>
        </Pressable>
      </View>
      <Text style={styles.hint}>What this entry says from a given chapter on. Read in order, it's the entry as it stands anywhere in the saga.</Text>

      {list.map((p) => (
        <Pressable key={p.id} style={styles.entry} onPress={() => startEdit(p.id)} onLongPress={() => confirmRemove(p.id)}>
          <Text style={styles.entryFrom}>{chapterLabel(p.from_chapter_id)}</Text>
          <Text style={styles.entryNote}>{p.note}</Text>
        </Pressable>
      ))}

      {adding && (
        <View style={styles.form}>
          <Text style={styles.formLabel}>From</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            <Pressable onPress={() => setFromChapterId(null)} style={[styles.chip, fromChapterId === null && styles.chipOn]}>
              <Text style={[styles.chipText, fromChapterId === null && styles.chipTextOn]}>the start</Text>
            </Pressable>
            {reading.map((c) => (
              <Pressable key={c.id} onPress={() => setFromChapterId(c.id)} style={[styles.chip, fromChapterId === c.id && styles.chipOn]}>
                <Text style={[styles.chipText, fromChapterId === c.id && styles.chipTextOn]} numberOfLines={1}>
                  {`B${c.book + 1} · ${c.title}`}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
          <TextInput
            style={styles.input}
            value={note}
            onChangeText={setNote}
            multiline
            placeholder="From here on, this is true…"
            placeholderTextColor={colors.textFaint}
            autoFocus
          />
          <View style={styles.actions}>
            {editingId && (
              <Pressable onPress={() => confirmRemove(editingId)} hitSlop={8}>
                <Text style={styles.danger}>Remove</Text>
              </Pressable>
            )}
            <View style={{ flex: 1 }} />
            <Pressable onPress={() => setAdding(false)} hitSlop={8}>
              <Text style={styles.cancel}>Cancel</Text>
            </Pressable>
            <Pressable onPress={save} hitSlop={8}>
              <Text style={styles.confirm}>Save</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    wrap: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 30, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderDim },
    head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    label: { color: colors.gold, fontFamily: FONTS.heading, fontSize: 11, letterSpacing: 2 },
    addText: { color: colors.gold, fontFamily: FONTS.body, fontSize: 13 },
    hint: { color: colors.textFaint, fontFamily: FONTS.body, fontSize: 12, lineHeight: 17, marginTop: 4, marginBottom: 6 },
    entry: { paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderDim },
    entryFrom: { color: colors.textDim, fontFamily: FONTS.mono, fontSize: 11 },
    entryNote: { color: colors.text, fontFamily: FONTS.body, fontSize: 14.5, lineHeight: 21, marginTop: 3 },
    form: { marginTop: 10, padding: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 10, backgroundColor: colors.panel },
    formLabel: { color: colors.textDim, fontFamily: FONTS.heading, fontSize: 10, letterSpacing: 2 },
    chips: { gap: 6, paddingVertical: 8 },
    chip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, borderWidth: 1, borderColor: colors.borderDim, maxWidth: 200 },
    chipOn: { borderColor: colors.gold, backgroundColor: withOpacity(colors.gold, 0.1) },
    chipText: { color: colors.textDim, fontFamily: FONTS.body, fontSize: 12 },
    chipTextOn: { color: colors.gold },
    input: { color: colors.text, fontFamily: FONTS.body, fontSize: 15, lineHeight: 22, minHeight: 70, textAlignVertical: 'top', padding: 0, marginTop: 4 },
    actions: { flexDirection: 'row', alignItems: 'center', gap: 18, marginTop: 10 },
    cancel: { color: colors.textFaint, fontFamily: FONTS.body, fontSize: 14 },
    confirm: { color: colors.gold, fontFamily: FONTS.bodySemiBold, fontSize: 14 },
    danger: { color: colors.error, fontFamily: FONTS.body, fontSize: 13 },
  });
}
