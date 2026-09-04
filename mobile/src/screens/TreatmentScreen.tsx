import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BOOKS } from '../lib/storyData';
import type { SignedInStackParamList } from '../navigation/types';
import { useChapterStore } from '../store/chapterStore';
import { treatmentTitle, useTreatmentStore, type TreatmentVersion } from '../store/treatmentStore';
import { FONTS, type ThemeColors, useTheme, withOpacity } from '../theme';

type Props = NativeStackScreenProps<SignedInStackParamList, 'Treatment'>;

const AUTOSAVE_DELAY_MS = 800;

// One scene, described. The same restraint as the pages editor: one prose field, no title
// field, no save button, and everything that is not writing behind a single dot.
//
// What differs from a page is only what the dot opens onto -- a treatment can hold several
// versions, and several of them can be live at once because the writer is deliberately
// holding two readings of the scene open. Nothing here asks them to reduce to one.
export default function TreatmentScreen({ route, navigation }: Props) {
  const { projectId, treatmentId } = route.params;
  const { treatments, fetchTreatments, saveVersion, liveVersion, versionsOf } = useTreatmentStore();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [content, setContent] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [ready, setReady] = useState(false);
  // Which version the field is editing. Switching versions in the sheet re-seeds the field.
  const [editingId, setEditingId] = useState<string | null>(null);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef('');
  const versionRef = useRef<string | null>(null);

  const treatment = treatments.find((t) => t.id === treatmentId) ?? null;

  useEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  useEffect(() => {
    if (treatments.length === 0) fetchTreatments(projectId);
  }, [projectId, treatments.length, fetchTreatments]);

  // Seed once per version, never on every store update -- re-seeding mid-typing would fight
  // the cursor on each autosave round trip.
  const seededFor = useRef<string | null>(null);
  useEffect(() => {
    const target = editingId ? versionsOf(treatmentId).find((v) => v.id === editingId) : liveVersion(treatmentId);
    if (!target || seededFor.current === target.id) return;
    seededFor.current = target.id;
    versionRef.current = target.id;
    setEditingId(target.id);
    setContent(target.content);
    latest.current = target.content;
    setReady(true);
  }, [treatmentId, editingId, liveVersion, versionsOf]);

  const flushRef = useRef<(text: string) => Promise<void>>(async () => {});
  flushRef.current = async (text: string) => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    if (versionRef.current) await saveVersion(versionRef.current, text);
  };

  function handleChange(text: string) {
    setContent(text);
    latest.current = text;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => flushRef.current(latest.current), AUTOSAVE_DELAY_MS);
  }

  // Leaving is a save, never a discard. No confirmation, because a treatment must not be
  // losable by walking away from it.
  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (latest.current) flushRef.current(latest.current);
    };
  }, []);

  if (!ready || !treatment) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <ActivityIndicator color={colors.gold} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.chrome, { paddingTop: insets.top + 6 }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={14}>
          <Text style={styles.chromeGlyph}>‹</Text>
        </Pressable>
        <Pressable onPress={() => setSheetOpen(true)} hitSlop={14}>
          <Text style={styles.chromeGlyph}>·</Text>
        </Pressable>
      </View>

      <TextInput
        style={[styles.paper, { paddingBottom: insets.bottom + 40 }]}
        value={content}
        onChangeText={handleChange}
        multiline
        autoFocus={!content}
        scrollEnabled
        textAlignVertical="top"
        selectionColor={colors.gold}
      />

      <TreatmentSheet
        visible={sheetOpen}
        treatmentId={treatmentId}
        projectId={projectId}
        editingId={editingId}
        liveText={content}
        styles={styles}
        colors={colors}
        onClose={() => setSheetOpen(false)}
        onEditVersion={(id) => {
          // Flush the current version before switching, or the last few seconds of typing
          // would be lost to a version change.
          flushRef.current(latest.current);
          seededFor.current = null;
          setEditingId(id);
          setSheetOpen(false);
        }}
        onOpenChapter={(chapterId) => {
          setSheetOpen(false);
          navigation.navigate('Editor', { chapterId });
        }}
      />
    </KeyboardAvoidingView>
  );
}

function TreatmentSheet({
  visible,
  treatmentId,
  projectId,
  editingId,
  liveText,
  styles,
  colors,
  onClose,
  onEditVersion,
  onOpenChapter,
}: {
  visible: boolean;
  treatmentId: string;
  projectId: string;
  editingId: string | null;
  liveText: string;
  styles: Styles;
  colors: ThemeColors;
  onClose: () => void;
  onEditVersion: (id: string) => void;
  onOpenChapter: (chapterId: string) => void;
}) {
  const { treatments, versionsOf, setVersionStatus, addVersion, setTitle, markBecame } = useTreatmentStore();
  const { chapters, fetchChapters, createChapter, updateChapter } = useChapterStore();
  const treatment = treatments.find((t) => t.id === treatmentId);
  const [promoting, setPromoting] = useState(false);
  const [book, setBook] = useState(0);
  const [busy, setBusy] = useState(false);
  const [title, setTitleDraft] = useState('');

  useEffect(() => {
    if (visible && chapters.length === 0) fetchChapters(projectId);
    if (visible && treatment) setTitleDraft(treatment.title ?? '');
  }, [visible, chapters.length, fetchChapters, projectId, treatment]);

  if (!treatment) return null;
  const versions = versionsOf(treatmentId);

  const acts = Array.from(new Set(chapters.filter((c) => c.book === book).map((c) => c.act))).sort((a, b) => a - b);
  const actChoices = acts.length > 0 ? acts : [1];

  async function promote(act: number) {
    setBusy(true);
    const name = treatmentTitle(treatment!, versions.find((v) => v.id === editingId)) || 'Untitled chapter';
    const { chapter } = await createChapter(projectId, book, act, name.slice(0, 120));
    if (chapter) {
      // The chapter gets a COPY. The treatment is untouched and stays in the list.
      await updateChapter(chapter.id, { content: liveText });
      await markBecame(treatment!.id, 'chapter', chapter.id);
    }
    setBusy(false);
    if (chapter) onOpenChapter(chapter.id);
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.sheetBackdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <ScrollView>
            <Text style={styles.sheetLabel}>Name</Text>
            <TextInput
              style={styles.titleInput}
              value={title}
              onChangeText={setTitleDraft}
              onEndEditing={() => setTitle(treatmentId, title.trim())}
              placeholder="Optional — the first line stands in"
              placeholderTextColor={colors.textFaint}
            />

            <View style={styles.sheetRule} />

            <Text style={styles.sheetLabel}>Versions</Text>
            <Text style={styles.sheetNote}>
              More than one can be live at once. That is a way of holding two readings of the
              scene open, not a conflict to resolve.
            </Text>
            {versions.map((v) => (
              <VersionRow
                key={v.id}
                version={v}
                editing={v.id === editingId}
                styles={styles}
                onOpen={() => onEditVersion(v.id)}
                onToggle={() => setVersionStatus(v.id, v.status === 'live' ? 'stale' : 'live')}
              />
            ))}
            <Pressable style={styles.sheetAction} onPress={() => addVersion(treatmentId, '')}>
              <Text style={styles.sheetActionText}>Start another version</Text>
            </Pressable>

            <View style={styles.sheetRule} />

            {treatment.became_type ? (
              <Pressable
                style={styles.sheetAction}
                onPress={() => treatment.became_id && onOpenChapter(treatment.became_id)}
              >
                <Text style={styles.sheetActionText}>Became a {treatment.became_type} — open it</Text>
              </Pressable>
            ) : promoting ? (
              <>
                <Text style={styles.sheetLabel}>Make this a chapter</Text>
                <View style={styles.chipRow}>
                  {BOOKS.map((name, i) => (
                    <Pressable key={name} style={[styles.chip, book === i && styles.chipOn]} onPress={() => setBook(i)}>
                      <Text style={[styles.chipText, book === i && styles.chipTextOn]}>{name}</Text>
                    </Pressable>
                  ))}
                </View>
                <View style={styles.chipRow}>
                  {actChoices.map((a) => (
                    <Pressable key={a} style={styles.chip} onPress={() => promote(a)} disabled={busy}>
                      <Text style={styles.chipText}>Act {a}</Text>
                    </Pressable>
                  ))}
                </View>
                <Text style={styles.sheetNote}>
                  The chapter gets a copy. This treatment stays exactly as it is.
                </Text>
              </>
            ) : (
              <Pressable style={styles.sheetAction} onPress={() => setPromoting(true)}>
                <Text style={styles.sheetActionText}>Make this a chapter</Text>
              </Pressable>
            )}

            {busy && <ActivityIndicator color={colors.gold} style={{ marginTop: 12 }} />}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function VersionRow({
  version,
  editing,
  styles,
  onOpen,
  onToggle,
}: {
  version: TreatmentVersion;
  editing: boolean;
  styles: Styles;
  onOpen: () => void;
  onToggle: () => void;
}) {
  const first =
    (version.content || '').split('\n').map((l) => l.trim()).find((l) => l.length > 0) ?? 'Empty version';
  return (
    <View style={styles.versionRow}>
      <Pressable style={styles.versionMain} onPress={onOpen}>
        <Text style={[styles.versionText, editing && styles.versionEditing]} numberOfLines={2}>
          {first}
        </Text>
        <Text style={styles.versionMeta}>
          {new Date(version.updated_at ?? version.created_at).toLocaleDateString()}
          {version.status === 'stale' ? ' · set aside' : ''}
          {editing ? ' · editing' : ''}
        </Text>
      </Pressable>
      <Pressable onPress={onToggle} hitSlop={8}>
        <Text style={styles.versionToggle}>{version.status === 'live' ? 'set aside' : 'make live'}</Text>
      </Pressable>
    </View>
  );
}

type Styles = ReturnType<typeof makeStyles>;

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg },
    centered: { alignItems: 'center', justifyContent: 'center' },
    chrome: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 18, paddingBottom: 2 },
    chromeGlyph: { color: withOpacity(colors.textFaint, 0.75), fontSize: 26, lineHeight: 28, paddingHorizontal: 6 },
    paper: {
      flex: 1,
      color: colors.text,
      fontFamily: FONTS.literary,
      fontSize: 18,
      lineHeight: 30,
      paddingHorizontal: 26,
      paddingTop: 14,
    },
    sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: colors.panel,
      borderTopWidth: 1,
      borderColor: colors.border,
      borderTopLeftRadius: 14,
      borderTopRightRadius: 14,
      padding: 20,
      maxHeight: '80%',
    },
    sheetLabel: { color: colors.gold, fontFamily: FONTS.heading, fontSize: 14, marginBottom: 8 },
    sheetNote: { color: colors.textFaint, fontFamily: FONTS.literaryItalic, fontSize: 12, marginTop: 6, lineHeight: 18 },
    sheetRule: { height: 1, backgroundColor: colors.borderDim, marginVertical: 18 },
    sheetAction: { paddingVertical: 12 },
    sheetActionText: { color: colors.text, fontFamily: FONTS.body, fontSize: 15 },
    titleInput: {
      color: colors.text,
      fontFamily: FONTS.literary,
      fontSize: 16,
      borderBottomWidth: 1,
      borderColor: colors.borderDim,
      paddingVertical: 6,
    },
    versionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderColor: colors.borderDim,
    },
    versionMain: { flex: 1, minWidth: 0 },
    versionText: { color: colors.textDim, fontFamily: FONTS.literary, fontSize: 14, lineHeight: 20 },
    versionEditing: { color: colors.text },
    versionMeta: { color: colors.textFaint, fontFamily: FONTS.mono, fontSize: 9.5, marginTop: 3 },
    versionToggle: { color: colors.gold, fontFamily: FONTS.mono, fontSize: 10.5 },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: { borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
    chipOn: { backgroundColor: withOpacity(colors.gold, 0.22), borderColor: colors.gold },
    chipText: { color: colors.textDim, fontFamily: FONTS.mono, fontSize: 11 },
    chipTextOn: { color: colors.text },
  });
}
