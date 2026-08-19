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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { SignedInStackParamList } from '../navigation/types';
import { ANNOTATION_COLORS, BOOKS, computeHighlightSegments, tokenizeSentences, wordCount } from '../lib/storyData';
import { type Annotation, useChapterStore } from '../store/chapterStore';

type Props = NativeStackScreenProps<SignedInStackParamList, 'Editor'>;

const AUTOSAVE_DELAY_MS = 1200; // matches the PWA's editorSaveTimer exactly (index.html)
const FLAG_LABELS: Record<Annotation['type'], string> = { plant: '🌱 Plant', reveal: '⚡ Reveal', note: '📜 Note' };
const SELECTION_TINT = 'rgba(198,154,58,0.4)'; // gold, distinct from any ANNOTATION_COLORS value

// Ports the PWA's contenteditable-based editor (index.html §3.5) to RN's TextInput, which
// has no equivalent for inline-styled editable text -- see the plan doc's editor risk
// section. Three modes: a read view with real inline highlight spans (nested <Text>,
// ported from renderAnnotatedContent()'s exact substring-relocation algorithm -- see
// computeHighlightSegments), a plain-TextInput edit mode for actual typing, and a
// "select mode" for flagging built entirely on custom tap-a-sentence-to-select rather
// than native TextInput text selection -- Android's drag-to-extend-selection on
// multiline TextInput is a longstanding, still-unresolved RN platform bug (only ever
// selects a single word on some devices/keyboards, confirmed on real hardware this
// session), so flagging doesn't depend on it at all. Chunked by sentence rather than
// word (see tokenizeSentences in storyData.ts) -- a per-word version wrapped every word
// in its own touchable element, which for a real chapter blocked the JS thread for
// several seconds on every tap (also confirmed on real hardware). Deferred to Phase 3
// (continuity checker / POV
// tracker), same as the drawer's scene fields: linked-plant search for reveals,
// auto-feeding scene requires/provides, and thread-based Mythic Threads. Annotations
// here store type/text/label(+thread for notes) only.
export default function EditorScreen({ route, navigation }: Props) {
  const { chapterId } = route.params;
  const chapter = useChapterStore((s) => s.chapters.find((c) => c.id === chapterId));
  const updateChapter = useChapterStore((s) => s.updateChapter);

  const [mode, setMode] = useState<'read' | 'edit' | 'select'>('read');
  const [content, setContent] = useState(chapter?.content ?? '');
  const [annotations, setAnnotations] = useState<Annotation[]>(chapter?.annotations ?? []);
  const [status, setStatus] = useState('');
  const [historyVisible, setHistoryVisible] = useState(false);
  const [flagPickerVisible, setFlagPickerVisible] = useState(false);
  const [pendingFlag, setPendingFlag] = useState<{ type: Annotation['type']; text: string } | null>(null);
  const [labelInput, setLabelInput] = useState('');
  const [threadInput, setThreadInput] = useState('');
  const [sentAnchor, setWordAnchor] = useState<number | null>(null);
  const [sentFocus, setWordFocus] = useState<number | null>(null);
  const insets = useSafeAreaInsets();

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
  const tokens = useMemo(() => tokenizeSentences(content), [content]);

  const sentSelStart = sentAnchor !== null && sentFocus !== null ? Math.min(sentAnchor, sentFocus) : null;
  const sentSelEnd = sentAnchor !== null && sentFocus !== null ? Math.max(sentAnchor, sentFocus) : null;

  function tapSentence(index: number) {
    if (sentAnchor === null) {
      setWordAnchor(index);
      setWordFocus(index);
    } else {
      setWordFocus(index);
    }
  }

  function exitSelectMode() {
    setMode('read');
    setWordAnchor(null);
    setWordFocus(null);
  }

  function beginFlag(type: Annotation['type']) {
    if (sentSelStart === null || sentSelEnd === null) return;
    const text = content.slice(tokens[sentSelStart].start, tokens[sentSelEnd].end);
    setFlagPickerVisible(false);
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
    exitSelectMode();
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
      <Text style={styles.position}>
        {BOOKS[chapter.book]} · Act {chapter.act}
      </Text>
      <View style={styles.toolbar}>
        <Pressable
          onPress={() => {
            if (mode === 'select') { exitSelectMode(); return; }
            if (mode === 'edit') flushSave();
            setMode(mode === 'edit' ? 'read' : 'edit');
          }}
        >
          <Text style={styles.toolbarBtn}>{mode === 'edit' ? 'Done' : mode === 'select' ? 'Cancel' : 'Edit'}</Text>
        </Pressable>
        <Text style={styles.status}>{status}</Text>
        {mode === 'read' && (
          <Pressable onPress={() => setMode('select')}>
            <Text style={styles.toolbarBtn}>Flag text</Text>
          </Pressable>
        )}
        {mode !== 'select' && (
          <Pressable onPress={() => setHistoryVisible(true)}>
            <Text style={styles.toolbarBtn}>History</Text>
          </Pressable>
        )}
      </View>

      {mode === 'read' && (
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
      )}

      {mode === 'edit' && (
        <TextInput
          style={styles.editInput}
          value={content}
          onChangeText={handleContentChange}
          multiline
          autoFocus
          textAlignVertical="top"
          placeholder="Start writing..."
          placeholderTextColor="#8a7355"
        />
      )}

      {mode === 'select' && (
        <>
          <ScrollView style={styles.body} contentContainerStyle={styles.readContent}>
            <Text style={styles.selectHint}>Tap a sentence to start, tap another to extend the selection.</Text>
            {tokens.length === 0 && <Text style={styles.placeholder}>This chapter has no text yet.</Text>}
            <Text style={styles.proseText}>
              {tokens.map((tok, i) => {
                const selected = sentSelStart !== null && i >= sentSelStart && i <= sentSelEnd!;
                const gap = i > 0 ? content.slice(tokens[i - 1].end, tok.start) : '';
                return (
                  <Text key={i}>
                    {gap}
                    <Text
                      onPress={() => tapSentence(i)}
                      style={selected ? { backgroundColor: SELECTION_TINT } : undefined}
                    >
                      {tok.text}
                    </Text>
                  </Text>
                );
              })}
            </Text>
          </ScrollView>
          {sentSelStart !== null && (
            <View style={[styles.selectionBar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
              <Text style={styles.selectionBarHint}>
                {sentSelEnd! - sentSelStart + 1} sentence{sentSelEnd === sentSelStart ? '' : 's'} selected
              </Text>
              <Pressable style={styles.selectionBarMore} onPress={() => setFlagPickerVisible(true)}>
                <Text style={styles.selectionBarMoreText}>⋮</Text>
              </Pressable>
            </View>
          )}
        </>
      )}

      {/* Full-screen flag-type picker, opened from the "⋮" on a selection */}
      <Modal visible={flagPickerVisible} animationType="slide" onRequestClose={() => setFlagPickerVisible(false)}>
        <View style={[styles.flagPickerScreen, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.flagPickerHeader}>
            <Text style={styles.modalTitle}>Flag this text</Text>
            <Pressable onPress={() => setFlagPickerVisible(false)} hitSlop={10}>
              <Text style={styles.flagPickerClose}>×</Text>
            </Pressable>
          </View>
          <Text style={styles.modalSelectedText} numberOfLines={4}>
            "{sentSelStart !== null ? content.slice(tokens[sentSelStart].start, tokens[sentSelEnd!].end) : ''}"
          </Text>
          <Pressable style={styles.flagPickerOption} onPress={() => beginFlag('plant')}>
            <Text style={styles.flagPickerOptionEmoji}>🌱</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.flagPickerOptionTitle}>Plant</Text>
              <Text style={styles.flagPickerOptionDesc}>Something that pays off later</Text>
            </View>
          </Pressable>
          <Pressable style={styles.flagPickerOption} onPress={() => beginFlag('reveal')}>
            <Text style={styles.flagPickerOptionEmoji}>⚡</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.flagPickerOptionTitle}>Reveal</Text>
              <Text style={styles.flagPickerOptionDesc}>Completes an earlier plant</Text>
            </View>
          </Pressable>
          <Pressable style={styles.flagPickerOption} onPress={() => beginFlag('note')}>
            <Text style={styles.flagPickerOptionEmoji}>📜</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.flagPickerOptionTitle}>Note</Text>
              <Text style={styles.flagPickerOptionDesc}>Subtext, myth, or parallel</Text>
            </View>
          </Pressable>
        </View>
      </Modal>

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
  position: {
    color: '#8a7355',
    fontSize: 10.5,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2013',
    gap: 12,
  },
  toolbarBtn: { color: '#c69a3a', fontSize: 14, fontWeight: '600' },
  status: { color: '#8a7355', fontSize: 11, flex: 1, textAlign: 'center' },
  body: { flex: 1 },
  readContent: { padding: 20, paddingBottom: 60 },
  proseText: { color: '#e9dcb8', fontSize: 16, lineHeight: 26 },
  placeholder: { color: '#8a7355', fontStyle: 'italic' },
  selectHint: { color: '#8a7355', fontSize: 12, fontStyle: 'italic', marginBottom: 12 },
  editInput: {
    flex: 1,
    color: '#e9dcb8',
    fontSize: 16,
    lineHeight: 26,
    padding: 20,
  },
  selectionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#4a3a22',
    backgroundColor: '#1a130b',
  },
  selectionBarHint: { color: '#a8926a', fontSize: 12 },
  selectionBarMore: {
    backgroundColor: '#c69a3a',
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectionBarMoreText: { color: '#2b1a05', fontSize: 18, fontWeight: '900', lineHeight: 18 },
  flagPickerScreen: { flex: 1, backgroundColor: '#120d08', paddingHorizontal: 20 },
  flagPickerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  flagPickerClose: { color: '#a8926a', fontSize: 26, lineHeight: 26 },
  flagPickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#1a130b',
    borderWidth: 1,
    borderColor: '#4a3a22',
    borderRadius: 10,
    padding: 16,
    marginTop: 12,
  },
  flagPickerOptionEmoji: { fontSize: 26 },
  flagPickerOptionTitle: { color: '#e9dcb8', fontSize: 16, fontWeight: '700' },
  flagPickerOptionDesc: { color: '#8a7355', fontSize: 12, marginTop: 2 },
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
