import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
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

import type { SignedInStackParamList } from '../navigation/types';
import { ANNOTATION_COLORS, computeHighlightSegments, wordCount } from '../lib/storyData';
import { type Annotation, useChapterStore } from '../store/chapterStore';

type Props = NativeStackScreenProps<SignedInStackParamList, 'Editor'>;

const AUTOSAVE_DELAY_MS = 1200; // matches the PWA's editorSaveTimer exactly (index.html)
const FLAG_LABELS: Record<Annotation['type'], string> = { plant: '🌱 Plant', reveal: '⚡ Reveal', note: '📜 Note' };

// Ports the PWA's contenteditable-based editor (index.html §3.5) to RN's TextInput, which
// has no equivalent for inline-styled editable text -- see the plan doc's editor risk
// section. Two modes instead: a read view with real inline highlight spans (nested
// <Text>, ported from renderAnnotatedContent()'s exact substring-relocation algorithm --
// see computeHighlightSegments), and a plain-TextInput edit mode for actual typing.
// Deferred to Phase 3 (continuity checker / POV tracker), same as the drawer's scene
// fields: linked-plant search/matching for reveals, auto-feeding scene requires/
// provides, and thread-based Mythic Threads. Annotations here store type/text/label
// (+thread for notes) only.
export default function EditorScreen({ route, navigation }: Props) {
  const { chapterId } = route.params;
  const chapter = useChapterStore((s) => s.chapters.find((c) => c.id === chapterId));
  const updateChapter = useChapterStore((s) => s.updateChapter);

  const [mode, setMode] = useState<'read' | 'edit'>('read');
  const [content, setContent] = useState(chapter?.content ?? '');
  const [annotations, setAnnotations] = useState<Annotation[]>(chapter?.annotations ?? []);
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const [status, setStatus] = useState('');
  const [historyVisible, setHistoryVisible] = useState(false);
  const [pendingFlag, setPendingFlag] = useState<{ type: Annotation['type']; text: string } | null>(null);
  const [labelInput, setLabelInput] = useState('');
  const [threadInput, setThreadInput] = useState('');

  const savedContentRef = useRef(chapter?.content ?? '');
  const savedAnnotationsRef = useRef<Annotation[]>(chapter?.annotations ?? []);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    navigation.setOptions({ title: chapter?.title ?? 'Chapter' });
  }, [navigation, chapter?.title]);

  // pushVersionSnapshot(), ported: skip if nothing changed or content is empty, cap at 10.
  function snapshotIfChanged(latestContent: string) {
    if (!chapter) return chapter;
    if (latestContent === savedContentRef.current) return null;
    if (!savedContentRef.current || !savedContentRef.current.trim()) return null;
    const version = { content: savedContentRef.current, savedAt: Date.now(), words: wordCount(savedContentRef.current) };
    return [version, ...chapter.versions].slice(0, 10);
  }

  async function persist(latestContent: string, latestAnnotations: Annotation[]) {
    if (!chapter) return;
    const newVersions = snapshotIfChanged(latestContent);
    const { error } = await updateChapter(chapterId, {
      content: latestContent,
      annotations: latestAnnotations,
      ...(newVersions ? { versions: newVersions } : {}),
    });
    savedContentRef.current = latestContent;
    savedAnnotationsRef.current = latestAnnotations;
    setStatus(error ? `Not saved: ${error}` : 'Saved.');
    if (!error) setTimeout(() => setStatus((s) => (s === 'Saved.' ? '' : s)), 2000);
  }

  function scheduleAutosave(nextContent: string, nextAnnotations: Annotation[]) {
    setStatus('Unsaved changes…');
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => persist(nextContent, nextAnnotations), AUTOSAVE_DELAY_MS);
  }

  function handleContentChange(text: string) {
    setContent(text);
    scheduleAutosave(text, annotations);
  }

  // Leaving edit mode (or the screen) flushes immediately rather than waiting on the
  // debounce, same intent as the PWA's editor-close handler firing autosaveChapter().
  function flushSave() {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    if (content !== savedContentRef.current || annotations !== savedAnnotationsRef.current) {
      persist(content, annotations);
    }
  }

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  const segments = useMemo(() => computeHighlightSegments(content, annotations), [content, annotations]);

  function beginFlag(type: Annotation['type']) {
    const text = content.slice(selection.start, selection.end);
    if (!text.trim()) {
      Alert.alert('Select some text first', `Select the text in the chapter you want to flag, then tap ${type}.`);
      return;
    }
    setPendingFlag({ type, text });
    setLabelInput('');
    setThreadInput('');
  }

  function confirmFlag() {
    if (!pendingFlag) return;
    const annotation: Annotation = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: pendingFlag.type,
      text: pendingFlag.text,
      label: labelInput.trim(),
      ...(pendingFlag.type === 'note' && threadInput.trim() ? { thread: threadInput.trim() } : {}),
    };
    const next = [...annotations, annotation];
    setAnnotations(next);
    scheduleAutosave(content, next);
    setPendingFlag(null);
  }

  function removeAnnotation(id: string) {
    const next = annotations.filter((a) => a.id !== id);
    setAnnotations(next);
    scheduleAutosave(content, next);
  }

  function restoreVersion(index: number) {
    if (!chapter) return;
    Alert.alert(
      'Restore this version?',
      'Your current text will be replaced (it will be saved to history first).',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
          onPress: () => {
            const newVersions = snapshotIfChanged(content) ?? chapter.versions;
            const restored = chapter.versions[index].content;
            setContent(restored);
            updateChapter(chapterId, { content: restored, versions: newVersions });
            savedContentRef.current = restored;
            setStatus('Restored.');
            setHistoryVisible(false);
          },
        },
      ],
    );
  }

  if (!chapter) return null;

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <View style={styles.toolbar}>
        <Pressable
          onPress={() => {
            if (mode === 'edit') flushSave();
            setMode(mode === 'edit' ? 'read' : 'edit');
          }}
        >
          <Text style={styles.toolbarBtn}>{mode === 'edit' ? 'Done' : 'Edit'}</Text>
        </Pressable>
        <Text style={styles.status}>{status}</Text>
        <Pressable onPress={() => setHistoryVisible(true)}>
          <Text style={styles.toolbarBtn}>History</Text>
        </Pressable>
      </View>

      {mode === 'read' ? (
        <ScrollView style={styles.body} contentContainerStyle={styles.readContent}>
          <Text style={styles.proseText}>
            {segments.map((seg, i) =>
              seg.type ? (
                <Text key={i} style={{ backgroundColor: ANNOTATION_COLORS[seg.type] }}>
                  {seg.text}
                </Text>
              ) : (
                <Text key={i}>{seg.text}</Text>
              ),
            )}
            {content.length === 0 && <Text style={styles.placeholder}>Tap Edit to start writing...</Text>}
          </Text>

          {annotations.length > 0 && (
            <View style={styles.flagsSection}>
              <Text style={styles.flagsHeading}>Flags</Text>
              {annotations.map((a) => (
                <View key={a.id} style={styles.flagRow}>
                  <View style={[styles.flagSwatch, { backgroundColor: ANNOTATION_COLORS[a.type] }]} />
                  <View style={styles.flagBody}>
                    <Text style={styles.flagType}>{FLAG_LABELS[a.type]}</Text>
                    <Text style={styles.flagText} numberOfLines={1}>
                      "{a.text}"
                    </Text>
                    {!!a.label && <Text style={styles.flagLabel}>{a.label}</Text>}
                  </View>
                  <Pressable onPress={() => removeAnnotation(a.id)} hitSlop={10}>
                    <Text style={styles.flagRemove}>×</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      ) : (
        <>
          <TextInput
            style={styles.editInput}
            value={content}
            onChangeText={handleContentChange}
            onSelectionChange={(e) => setSelection(e.nativeEvent.selection)}
            multiline
            autoFocus
            textAlignVertical="top"
            placeholder="Start writing..."
            placeholderTextColor="#8a7355"
          />
          {/* Always visible rather than gated on hasSelection -- onSelectionChange on a
              multiline TextInput is unreliable on Android for drag-based selection
              (longstanding RN platform bug, not specific to this app: e.g. facebook/
              react-native#18617, #29365), so hiding the toolbar until a selection is
              detected could mean it never appears at all. beginFlag() still reads
              whatever `selection` currently holds and tells the user to select text
              first if it's empty -- this dev-only readout shows exactly what the
              TextInput is reporting, to see whether it's simply not firing on this
              device or firing with the wrong range. */}
          <Text style={styles.selectionDebug}>selection: {selection.start}–{selection.end}</Text>
          <View style={styles.markToolbar}>
            <Pressable style={styles.markBtn} onPress={() => beginFlag('plant')}>
              <Text style={styles.markBtnText}>🌱 Plant</Text>
            </Pressable>
            <Pressable style={styles.markBtn} onPress={() => beginFlag('reveal')}>
              <Text style={styles.markBtnText}>⚡ Reveal</Text>
            </Pressable>
            <Pressable style={styles.markBtn} onPress={() => beginFlag('note')}>
              <Text style={styles.markBtnText}>📜 Note</Text>
            </Pressable>
          </View>
        </>
      )}

      {/* Flag label modal -- ports the annotation-modal (index.html, beginMark()) */}
      <Modal visible={!!pendingFlag} transparent animationType="fade" onRequestClose={() => setPendingFlag(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {pendingFlag ? `Flag as ${FLAG_LABELS[pendingFlag.type]}` : ''}
            </Text>
            <Text style={styles.modalSelectedText} numberOfLines={3}>
              "{pendingFlag?.text}"
            </Text>
            <TextInput
              style={styles.modalInput}
              value={labelInput}
              onChangeText={setLabelInput}
              placeholder="Label (what does this pay off / complete / mean?)"
              placeholderTextColor="#8a7355"
              autoFocus
            />
            {pendingFlag?.type === 'note' && (
              <TextInput
                style={styles.modalInput}
                value={threadInput}
                onChangeText={setThreadInput}
                placeholder="Thread name (optional -- for recurring motifs)"
                placeholderTextColor="#8a7355"
              />
            )}
            <View style={styles.modalActions}>
              <Pressable onPress={() => setPendingFlag(null)}>
                <Text style={styles.modalCancel}>Cancel</Text>
              </Pressable>
              <Pressable onPress={confirmFlag}>
                <Text style={styles.modalConfirm}>Flag it</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Version history -- ports renderVersionList()/restore (index.html) */}
      <Modal visible={historyVisible} transparent animationType="fade" onRequestClose={() => setHistoryVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Version history</Text>
            {chapter.versions.length === 0 ? (
              <Text style={styles.modalEmpty}>No earlier saves yet — history builds up as you keep editing.</Text>
            ) : (
              <ScrollView style={{ maxHeight: 320 }}>
                {chapter.versions.map((v, i) => (
                  <View key={i} style={styles.versionRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.versionTime}>{new Date(v.savedAt).toLocaleString()}</Text>
                      <Text style={styles.versionPreview} numberOfLines={1}>
                        {v.content.trim().slice(0, 100)}
                      </Text>
                    </View>
                    <Pressable onPress={() => restoreVersion(i)}>
                      <Text style={styles.modalConfirm}>Restore</Text>
                    </Pressable>
                  </View>
                ))}
              </ScrollView>
            )}
            <Pressable onPress={() => setHistoryVisible(false)} style={{ marginTop: 14, alignSelf: 'flex-end' }}>
              <Text style={styles.modalCancel}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#120d08' },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2013',
  },
  toolbarBtn: { color: '#c69a3a', fontSize: 14, fontWeight: '600' },
  status: { color: '#8a7355', fontSize: 11 },
  body: { flex: 1 },
  readContent: { padding: 20, paddingBottom: 60 },
  proseText: { color: '#e9dcb8', fontSize: 16, lineHeight: 26 },
  placeholder: { color: '#8a7355', fontStyle: 'italic' },
  editInput: {
    flex: 1,
    color: '#e9dcb8',
    fontSize: 16,
    lineHeight: 26,
    padding: 20,
  },
  selectionDebug: { color: '#6b5d42', fontSize: 10, textAlign: 'center', paddingBottom: 4 },
  markToolbar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#2a2013',
    backgroundColor: '#1a130b',
  },
  markBtn: { paddingVertical: 6, paddingHorizontal: 14 },
  markBtnText: { color: '#e9dcb8', fontSize: 13 },
  flagsSection: { marginTop: 30, borderTopWidth: 1, borderTopColor: '#2a2013', paddingTop: 16 },
  flagsHeading: {
    color: '#8a7355',
    fontSize: 10.5,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  flagRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  flagSwatch: { width: 10, height: 10, borderRadius: 5 },
  flagBody: { flex: 1 },
  flagType: { color: '#a8926a', fontSize: 11 },
  flagText: { color: '#c9b892', fontSize: 13, fontStyle: 'italic' },
  flagLabel: { color: '#8a7355', fontSize: 12 },
  flagRemove: { color: '#b8542e', fontSize: 18, paddingHorizontal: 4 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: '#1a130b', borderRadius: 10, padding: 20, borderWidth: 1, borderColor: '#4a3a22' },
  modalTitle: { color: '#e9dcb8', fontSize: 16, fontWeight: '700', marginBottom: 10 },
  modalSelectedText: { color: '#8a7355', fontSize: 13, fontStyle: 'italic', marginBottom: 12 },
  modalInput: {
    backgroundColor: '#120d08',
    borderWidth: 1,
    borderColor: '#4a3a22',
    borderRadius: 6,
    padding: 10,
    color: '#e9dcb8',
    fontSize: 14,
    marginBottom: 10,
  },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 20, marginTop: 8 },
  modalCancel: { color: '#a8926a', fontSize: 14 },
  modalConfirm: { color: '#c69a3a', fontSize: 14, fontWeight: '700' },
  modalEmpty: { color: '#8a7355', fontSize: 13, fontStyle: 'italic' },
  versionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2013',
  },
  versionTime: { color: '#8a7355', fontSize: 11 },
  versionPreview: { color: '#c9b892', fontSize: 12.5, fontStyle: 'italic' },
});
