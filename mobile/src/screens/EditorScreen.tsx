import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  InteractionManager,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Icon from '../components/Icon';
import type { SignedInStackParamList } from '../navigation/types';
import { ANNOTATION_COLORS, BOOKS, chapterNumberInBook, wordCount } from '../lib/storyData';
import { fetchCharacterGraph, type GraphNode } from '../lib/characterGraph';
import { useAssistantStore } from '../store/assistantStore';
import { type Annotation, type FlagType, useChapterStore } from '../store/chapterStore';
import { FONTS, type ThemeColors, useTheme, withOpacity } from '../theme';

type Props = NativeStackScreenProps<SignedInStackParamList, 'Editor'>;

const AUTOSAVE_DELAY_MS = 1200; // matches the PWA's editorSaveTimer exactly (index.html)
const FLAG_LABELS: Record<FlagType, string> = { plant: '🌱 Plant', reveal: '⚡ Reveal', note: '📜 Note' };
const LINE_HEIGHT = 27;
const TEXTINPUT_TOP_OFFSET = 96; // position label + toolbar height, above the TextInput itself

// Single always-editing screen now that ReaderScreen (page-level, chrome-free) is the
// real reading surface -- the earlier read/edit mode toggle and the separate "Flag text"
// mode (a modal with its own tap-a-sentence-to-select mechanic) are both gone per
// explicit feedback: reading lives in the Reader now, and flagging should happen inline
// on whatever's selected in the TextInput itself, not behind a second screen.
//
// Flagging now rides on TextInput's own `selection` (start/end indices via
// onSelectionChange) rather than the old tap-sentence mechanic -- simpler, though it
// inherits Android's real, still-unresolved RN platform limitation that multiline
// TextInput drag-to-extend-selection is unreliable (often only ever grows to one word);
// single/double-tap-to-select-word still works, which is enough to flag a phrase.
// Whenever start !== end, a floating "⋮" popup appears near the selection (positioned by
// measuring how many lines of text precede the selection start against an offscreen
// mirror Text, since RN exposes no direct layout API for a caret/selection position) --
// tapping it opens the Plant/Reveal/Note picker directly with that exact substring.
//
// Deferred to Phase 3 (continuity checker / POV tracker), same as the drawer's scene
// fields: linked-plant search for reveals, auto-feeding scene requires/provides, and
// thread-based Mythic Threads. Annotations here store type/text/label(+thread for
// notes) only.
export default function EditorScreen({ route, navigation }: Props) {
  const { chapterId, jumpToText } = route.params;
  const chapter = useChapterStore((s) => s.chapters.find((c) => c.id === chapterId));
  const allChapters = useChapterStore((s) => s.chapters);
  const updateChapter = useChapterStore((s) => s.updateChapter);

  const chapterNumber = useMemo(
    () => (chapter ? chapterNumberInBook(chapter, allChapters) : null),
    [allChapters, chapter],
  );

  const [content, setContent] = useState(chapter?.content ?? '');
  const [annotations, setAnnotations] = useState<Annotation[]>(chapter?.annotations ?? []);
  const [status, setStatus] = useState('');
  const [historyVisible, setHistoryVisible] = useState(false);
  const [flagsVisible, setFlagsVisible] = useState(false);
  const [flagPickerVisible, setFlagPickerVisible] = useState(false);
  const [pendingFlag, setPendingFlag] = useState<{ type: FlagType; text: string } | null>(null);
  const [labelInput, setLabelInput] = useState('');
  const [threadInput, setThreadInput] = useState('');
  const [selection, setSelection] = useState<{ start: number; end: number }>({ start: 0, end: 0 });
  const [linesBeforeSelection, setLinesBeforeSelection] = useState(0);

  const insets = useSafeAreaInsets();
  const { width: winWidth, height: winHeight } = useWindowDimensions();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const savedContentRef = useRef(chapter?.content ?? '');
  const savedAnnotationsRef = useRef<Annotation[]>(chapter?.annotations ?? []);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textInputRef = useRef<TextInput>(null);
  // A ref, not state -- onScroll fires many times a second while dragging, and setting
  // React state on every one of those forced a re-render per frame, which was fighting
  // the TextInput's own native scroll momentum (reported as "can't scroll down" /
  // inconsistent scrolling once the keyboard and cursor were both active). The popup's Y
  // position only actually needs to be current at the moment a selection changes, which
  // already triggers a render via onSelectionChange -- so reading the ref there is enough.
  const inputScrollYRef = useRef(0);

  // Header shows just the back arrow, nothing else -- per explicit feedback, no title
  // text (the chapter's position/title already appear in the in-page `position` line).
  useLayoutEffect(() => {
    navigation.setOptions({ title: '' });
  }, [navigation]);

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
    // Keep the assistant's view of this chapter current. A no-op while the assistant is
    // off, and even when on it only re-embeds chunks whose text actually changed -- editing
    // one paragraph costs one embedding, not a whole chapter's worth.
    if (!error) {
      useAssistantStore
        .getState()
        .indexChapter(chapter.project_id, chapterId, chapter.title ?? '', latestContent);
    }
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

  // Returns the write so callers that depend on the saved copy can wait for it. The
  // Reader jump does: it searches the chapter as the STORE has it, so navigating while the
  // save is still in flight means searching a stale copy of the prose.
  function flushSave(): Promise<void> {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    if (content !== savedContentRef.current || annotations !== savedAnnotationsRef.current) {
      return persist(content, annotations).then(runGraphExtraction);
    }
    return Promise.resolve();
  }

  // Leaving the editor is the first moment a paragraph is plausibly finished, which is why
  // graph extraction happens here rather than on every autosave. Fire-and-forget: the
  // writer is already navigating away and should never wait on it.
  function runGraphExtraction() {
    if (!chapter) return;
    useAssistantStore.getState().extractGraph({
      projectId: chapter.project_id,
      chapterId,
      title: chapter.title ?? '',
      content,
      book: chapter.book,
      act: chapter.act,
    });
  }

  useEffect(() => {
    return () => {
      flushSave();
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reader highlights live in the same array but are not story flags -- they carry no
  // label and would only pad the Flags list and its count.
  const flagAnnotations = useMemo(
    () => annotations.filter((a): a is Annotation & { type: FlagType } => a.type !== 'highlight'),
    [annotations],
  );

  // A thread has to name whose arc it echoes, so the editor needs the cast. Fetched once
  // when the thread sheet is first opened rather than on mount -- most editing sessions
  // never flag a thread, and this is a network round trip.
  const [cast, setCast] = useState<GraphNode[]>([]);
  const [threadFor, setThreadFor] = useState<Annotation | null>(null);
  const [threadName, setThreadName] = useState('');
  const [threadCharacter, setThreadCharacter] = useState<string | null>(null);

  useEffect(() => {
    if (!threadFor || cast.length > 0 || !chapter) return;
    fetchCharacterGraph(chapter.project_id).then(({ data }) => {
      if (data) setCast(data.nodes.filter((n) => n.type === 'character'));
    });
  }, [threadFor, cast.length, chapter]);

  // Every thread already used in this chapter, so a recurring parallel is picked rather
  // than retyped -- a thread only means anything when the same name is reused.
  const knownThreads = useMemo(
    () => [...new Set(annotations.map((a) => a.thread).filter((t): t is string => !!t))].sort(),
    [annotations],
  );

  // Pairing. The groupings offered are every one already used anywhere in this chapter's
  // flags, so an existing setup is joined rather than a near-duplicate typed. Cross-chapter
  // groupings are not offered here -- the editor only holds one chapter -- which is a real
  // limit worth knowing: a reveal three chapters later has to be joined from its own side.
  const [pairFor, setPairFor] = useState<Annotation | null>(null);
  const [pairSelection, setPairSelection] = useState<{ id: string; label: string }[]>([]);
  const [newPairLabel, setNewPairLabel] = useState('');

  const knownPairs = useMemo(() => {
    const byId = new Map<string, string>();
    for (const a of annotations) {
      for (const p of a.pairs ?? []) if (!byId.has(p.id)) byId.set(p.id, p.label);
      // Anything written before the array shape existed.
      if (a.pairId && !byId.has(a.pairId)) byId.set(a.pairId, a.pairLabel ?? '');
    }
    return [...byId.entries()]
      .map(([id, label]) => ({ id, label }))
      .sort((x, y) => x.label.localeCompare(y.label));
  }, [annotations]);

  function membershipsOf(a: Annotation): { id: string; label: string }[] {
    if (a.pairs && a.pairs.length) return a.pairs;
    if (a.pairId) return [{ id: a.pairId, label: a.pairLabel ?? '' }];
    return [];
  }

  function openPairSheet(a: Annotation) {
    setPairFor(a);
    setPairSelection(membershipsOf(a));
    setNewPairLabel('');
  }

  function togglePair(entry: { id: string; label: string }) {
    setPairSelection((prev) =>
      prev.some((p) => p.id === entry.id)
        ? prev.filter((p) => p.id !== entry.id)
        : [...prev, entry],
    );
  }

  function addNewPair() {
    const label = newPairLabel.trim();
    if (!label) return;
    // Content-free id: the label is what the writer sees and may want to rename later, so it
    // should not also be the key that ties the two ends together.
    const id = `pair-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    setPairSelection((prev) => [...prev, { id, label }]);
    setNewPairLabel('');
  }

  function savePairs() {
    if (!pairFor) return;
    const next = annotations.map((a) => {
      if (a.id !== pairFor.id) return a;
      // The legacy single fields are dropped on write, so a flag is never described by both
      // shapes at once.
      const { pairId, pairLabel, ...rest } = a;
      return { ...rest, pairs: pairSelection } as Annotation;
    });
    setAnnotations(next);
    scheduleAutosave(content, next);
    setPairFor(null);
  }

  function openThreadSheet(a: Annotation) {
    setThreadFor(a);
    setThreadName(a.thread ?? '');
    setThreadCharacter(a.characterId ?? null);
  }

  function saveThread(clear = false) {
    if (!threadFor) return;
    const name = threadName.trim();
    const next = annotations.map((a) => {
      if (a.id !== threadFor.id) return a;
      if (clear || !name) {
        // Unmarking leaves an ordinary note behind rather than deleting it: the idea was
        // worth writing down whether or not it turned out to echo anything.
        const { thread, characterId, ...rest } = a;
        return rest as Annotation;
      }
      return { ...a, thread: name, characterId: threadCharacter ?? undefined };
    });
    setAnnotations(next);
    scheduleAutosave(content, next);
    setThreadFor(null);
  }

  const hasSelection = selection.end > selection.start;
  const selectedText = hasSelection ? content.slice(selection.start, selection.end) : null;

  const popupTop = Math.min(
    Math.max(insets.top + 60, TEXTINPUT_TOP_OFFSET + linesBeforeSelection * LINE_HEIGHT - inputScrollYRef.current),
    winHeight - 90,
  );
  const popupLeft = winWidth / 2 - 60;

  // Awaits the flush before navigating: the Reader searches the chapter as the store has
  // it, so leaving while the save is still in flight means it hunts for text that only
  // exists in this screen's state and silently gives up.
  async function viewInReader() {
    if (!selectedText || !chapter) return;
    const text = selectedText;
    const projectId = chapter.project_id;
    await flushSave();
    navigation.navigate('Reader', { projectId, chapterId, jumpToText: text });
  }

  function openFlagPicker() {
    if (!selectedText) return;
    setFlagPickerVisible(true);
  }

  function beginFlag(type: FlagType) {
    if (!selectedText) return;
    setFlagPickerVisible(false);
    setPendingFlag({ type, text: selectedText });
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
    setSelection({ start: 0, end: 0 });
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

  // Jump in from ReaderScreen's "View in Editor": select the exact matched substring so
  // it shows highlighted via the TextInput's own native selection UI. Applied imperatively
  // (setNativeProps, not a controlled `selection` prop) -- a continuously-controlled
  // selection prop is a known way to fight/reset the native selection handles on Android
  // mid-gesture, so it's only ever set here, once, for this one programmatic jump.
  // Waits for InteractionManager (not just one requestAnimationFrame) before touching the
  // TextInput -- firing this while the screen's own push transition/layout is still
  // settling was the likely reason the landing was unreliable (focus + setNativeProps on
  // a TextInput that hasn't finished mounting/laying out doesn't reliably take).
  const consumedJump = useRef<string | null>(null);
  useEffect(() => {
    if (!jumpToText || !content || consumedJump.current === jumpToText) return;
    consumedJump.current = jumpToText;
    const idx = content.indexOf(jumpToText);
    if (idx === -1) return;
    const range = { start: idx, end: idx + jumpToText.length };
    setSelection(range);

    // setSelection, not setNativeProps({selection}): the imperative method moves the
    // native cursor, and Android's EditText scrolls a moved cursor into view. Assigning
    // the prop only restyles the selection where it already is, which is why the jump
    // highlighted the right words but left the view wherever it had opened.
    //
    // Re-applied a couple of times because the first attempt can land before a long
    // chapter has finished laying out, and scroll-to-cursor on an unmeasured text does
    // nothing. Each retry is idempotent -- same range, same result once it takes.
    let attempts = 0;
    let retry: ReturnType<typeof setTimeout> | null = null;
    const apply = () => {
      const input = textInputRef.current;
      if (!input) return;
      input.focus();
      input.setSelection(range.start, range.end);
      attempts += 1;
      if (attempts < 3) retry = setTimeout(apply, 180);
    };
    const task = InteractionManager.runAfterInteractions(apply);
    return () => {
      task.cancel();
      if (retry) clearTimeout(retry);
    };
  }, [jumpToText, content]);

  if (!chapter) return null;

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <Text style={styles.position}>
        {BOOKS[chapter.book]}, Act {chapter.act}
        {chapterNumber !== null ? `, Chapter ${chapterNumber}` : ''}
      </Text>
      <View style={styles.toolbar}>
        <Pressable onPress={() => navigation.navigate('Reader', { projectId: chapter.project_id, chapterId })}>
          <Text style={styles.toolbarBtn}>Reader</Text>
        </Pressable>
        <Pressable
          onPress={() =>
            navigation.navigate('CharacterWeb', {
              projectId: chapter.project_id,
              // The chapter node, which carries its scenes, its flags and its moment.
              focusNodeId: chapterId,
            })
          }
        >
          <Text style={styles.toolbarBtn}>Web</Text>
        </Pressable>
        <Text style={styles.status}>{status}</Text>
        <Pressable onPress={() => setFlagsVisible(true)}>
          <Text style={styles.toolbarBtn}>Flags{flagAnnotations.length > 0 ? ` (${flagAnnotations.length})` : ''}</Text>
        </Pressable>
        <Pressable onPress={() => setHistoryVisible(true)}>
          <Text style={styles.toolbarBtn}>History</Text>
        </Pressable>
      </View>

      {/* Off-screen mirror of the text up to the selection start, used only to measure how
          many lines precede it (onTextLayout) so the "⋮" popup can land near the
          selection -- RN gives no direct caret/selection layout API. */}
      <Text
        style={[styles.editInput, styles.measurer]}
        onTextLayout={(e) => setLinesBeforeSelection(e.nativeEvent.lines.length)}
      >
        {content.slice(0, selection.start)}
      </Text>

      <TextInput
        ref={textInputRef}
        style={styles.editInput}
        value={content}
        onChangeText={handleContentChange}
        onSelectionChange={(e) => setSelection(e.nativeEvent.selection)}
        onScroll={(e) => {
          inputScrollYRef.current = e.nativeEvent.contentOffset.y;
        }}
        multiline
        autoFocus
        textAlignVertical="top"
        placeholder="Start writing..."
        placeholderTextColor={colors.textFaint}
      />

      {/* The mirror of the Reader's "Editor" action: flag the selection, or follow it into
          the Reader and land on the same words. Both directions now pass the selected
          substring rather than a position, so the destination finds it by searching its own
          copy of the prose -- the same way annotations relocate themselves. */}
      {hasSelection && (
        <View style={[styles.jumpPopup, { top: popupTop, left: popupLeft }]}>
          <Pressable style={styles.jumpPopupBtn} onPress={openFlagPicker}>
            <Icon name="flag" size={16} color="#2b1a05" />
            <Text style={styles.jumpPopupText}>Flag</Text>
          </Pressable>
          <View style={styles.jumpPopupDivider} />
          <Pressable style={styles.jumpPopupBtn} onPress={viewInReader}>
            <Icon name="book-open" size={16} color="#2b1a05" />
            <Text style={styles.jumpPopupText}>Reader</Text>
          </Pressable>
        </View>
      )}

      {/* Plant/Reveal/Note picker -- opened directly from the "⋮" popup on a selection */}
      <Modal visible={flagPickerVisible} animationType="slide" onRequestClose={() => setFlagPickerVisible(false)}>
        <View style={[styles.flagPickerScreen, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.flagPickerHeader}>
            <Text style={styles.modalTitle}>Flag this text</Text>
            <Pressable onPress={() => setFlagPickerVisible(false)} hitSlop={10}>
              <Text style={styles.flagPickerClose}>×</Text>
            </Pressable>
          </View>
          <Text style={styles.modalSelectedText} numberOfLines={4}>
            "{selectedText ?? ''}"
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
              style={[styles.modalInput, styles.modalInputMultiline]}
              value={labelInput}
              onChangeText={setLabelInput}
              placeholder="Label (what does this pay off / complete / mean?)"
              placeholderTextColor={colors.textFaint}
              multiline
              textAlignVertical="top"
              autoFocus
            />
            {pendingFlag?.type === 'note' && (
              <TextInput
                style={[styles.modalInput, styles.modalInputMultiline]}
                value={threadInput}
                onChangeText={setThreadInput}
                placeholder="Thread name (optional -- for recurring motifs)"
                placeholderTextColor={colors.textFaint}
                multiline
                textAlignVertical="top"
              />
            )}
            <View style={styles.modalActions}>
              <Pressable onPress={() => setPendingFlag(null)}>
                <Text style={styles.modalCancel}>Cancel</Text>
              </Pressable>
              <Pressable onPress={confirmFlag}>
                <Text style={styles.modalConfirm}>Flag</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Flags list -- every Plant/Reveal/Note on this chapter, removable. Read mode used
          to show these inline; now it's a small toolbar-triggered list instead. */}
      <Modal visible={flagsVisible} transparent animationType="fade" onRequestClose={() => setFlagsVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Flags</Text>
            {flagAnnotations.length === 0 ? (
              <Text style={styles.modalEmpty}>No flags yet -- select text and tap the "⋮" popup to add one.</Text>
            ) : (
              <ScrollView style={{ maxHeight: 360 }}>
                {flagAnnotations.map((a) => (
                  <View key={a.id} style={styles.flagRow}>
                    <View style={[styles.flagSwatch, { backgroundColor: ANNOTATION_COLORS[a.type] }]} />
                    <View style={styles.flagBody}>
                      <Text style={styles.flagType}>{FLAG_LABELS[a.type]}</Text>
                      <Text style={styles.flagText} numberOfLines={1}>
                        "{a.text}"
                      </Text>
                      {!!a.label && <Text style={styles.flagLabel}>{a.label}</Text>}
                    </View>
                    {/* Which setup/payoff groupings this end belongs to. Offered on plants
                        and reveals only -- a note is not one end of anything. */}
                    {(a.type === 'plant' || a.type === 'reveal') && (
                      <Pressable onPress={() => openPairSheet(a)} hitSlop={8}>
                        <Text style={styles.flagWeb}>
                          {membershipsOf(a).length > 0 ? `⇄${membershipsOf(a).length}` : 'pair'}
                        </Text>
                      </Pressable>
                    )}
                    {/* A mythic thread is a note the writer has marked as echoing a known
                        arc. Offered only on notes, because that is the only place it means
                        anything. */}
                    {a.type === 'note' && (
                      <Pressable onPress={() => openThreadSheet(a)} hitSlop={8}>
                        <Text style={[styles.flagWeb, a.thread && styles.flagThreadOn]}>
                          {a.thread ? '🧭' : 'thread'}
                        </Text>
                      </Pressable>
                    )}
                    {/* Straight to this one flag in the character web -- the same jump the
                        Reader offers, from the list where flags are actually managed. */}
                    <Pressable
                      onPress={() => {
                        setFlagsVisible(false);
                        navigation.navigate('CharacterWeb', {
                          projectId: chapter.project_id,
                          focusNodeId: a.id,
                        });
                      }}
                      hitSlop={8}
                    >
                      <Text style={styles.flagWeb}>web</Text>
                    </Pressable>
                    <Pressable onPress={() => removeAnnotation(a.id)} hitSlop={10}>
                      <Text style={styles.flagRemove}>×</Text>
                    </Pressable>
                  </View>
                ))}
              </ScrollView>
            )}
            <Pressable onPress={() => setFlagsVisible(false)} style={{ marginTop: 14, alignSelf: 'flex-end' }}>
              <Text style={styles.modalCancel}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Version history -- ports renderVersionList()/restore (index.html) */}
      <Modal visible={pairFor !== null} transparent animationType="slide" onRequestClose={() => setPairFor(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {pairFor?.type === 'plant' ? 'What pays this off' : 'What sets this up'}
            </Text>
            <Text style={styles.flagText} numberOfLines={2}>"{pairFor?.text}"</Text>
            <Text style={styles.threadLabel}>Groupings</Text>
            <Text style={styles.flagLabel}>
              A plant can belong to several, and several plants can share one. Pick every
              grouping this line takes part in.
            </Text>

            <ScrollView style={{ maxHeight: 220 }}>
              <View style={styles.threadChips}>
                {knownPairs.length === 0 && (
                  <Text style={styles.flagLabel}>None in this chapter yet — name one below.</Text>
                )}
                {knownPairs.map((entry) => {
                  const on = pairSelection.some((p) => p.id === entry.id);
                  return (
                    <Pressable
                      key={entry.id}
                      style={[styles.threadChip, on && styles.threadChipOn]}
                      onPress={() => togglePair(entry)}
                    >
                      <Text style={styles.threadChipText}>{entry.label || 'Untitled'}</Text>
                    </Pressable>
                  );
                })}
                {/* Selections made in this sheet that do not exist elsewhere yet. */}
                {pairSelection
                  .filter((p) => !knownPairs.some((k) => k.id === p.id))
                  .map((p) => (
                    <Pressable
                      key={p.id}
                      style={[styles.threadChip, styles.threadChipOn]}
                      onPress={() => togglePair(p)}
                    >
                      <Text style={styles.threadChipText}>{p.label}</Text>
                    </Pressable>
                  ))}
              </View>
            </ScrollView>

            <Text style={styles.threadLabel}>New grouping</Text>
            <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
              <TextInput
                style={[styles.threadInput, { flex: 1 }]}
                value={newPairLabel}
                onChangeText={setNewPairLabel}
                placeholder="e.g. The Durgashtami deadline"
                placeholderTextColor={colors.textFaint}
                onSubmitEditing={addNewPair}
              />
              <Pressable onPress={addNewPair} hitSlop={8}>
                <Text style={styles.modalConfirm}>Add</Text>
              </Pressable>
            </View>

            <View style={styles.threadActions}>
              <View style={{ flex: 1 }} />
              <Pressable onPress={() => setPairFor(null)} hitSlop={8}>
                <Text style={styles.modalCancel}>Cancel</Text>
              </Pressable>
              <Pressable onPress={savePairs} hitSlop={8}>
                <Text style={styles.modalConfirm}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={threadFor !== null} transparent animationType="slide" onRequestClose={() => setThreadFor(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Mythic thread</Text>
            <Text style={styles.flagText} numberOfLines={2}>"{threadFor?.text}"</Text>

            <Text style={styles.threadLabel}>The parallel</Text>
            <TextInput
              style={styles.threadInput}
              value={threadName}
              onChangeText={setThreadName}
              placeholder="e.g. The forbidden chamber"
              placeholderTextColor={colors.textFaint}
              autoFocus
            />
            {knownThreads.length > 0 && (
              <View style={styles.threadChips}>
                {knownThreads.map((t) => (
                  <Pressable key={t} style={styles.threadChip} onPress={() => setThreadName(t)}>
                    <Text style={styles.threadChipText}>{t}</Text>
                  </Pressable>
                ))}
              </View>
            )}

            <Text style={styles.threadLabel}>Whose arc</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.threadChips}>
                {cast.length === 0 ? (
                  <Text style={styles.flagLabel}>No cast yet — add characters in the web first.</Text>
                ) : (
                  cast.map((c) => (
                    <Pressable
                      key={c.id}
                      style={[styles.threadChip, threadCharacter === c.id && styles.threadChipOn]}
                      onPress={() => setThreadCharacter(threadCharacter === c.id ? null : c.id)}
                    >
                      <Text style={styles.threadChipText}>{c.label}</Text>
                    </Pressable>
                  ))
                )}
              </View>
            </ScrollView>

            <View style={styles.threadActions}>
              {!!threadFor?.thread && (
                <Pressable onPress={() => saveThread(true)} hitSlop={8}>
                  <Text style={styles.threadClear}>Unmark</Text>
                </Pressable>
              )}
              <View style={{ flex: 1 }} />
              <Pressable onPress={() => setThreadFor(null)} hitSlop={8}>
                <Text style={styles.modalCancel}>Cancel</Text>
              </Pressable>
              <Pressable onPress={() => saveThread()} hitSlop={8}>
                <Text style={styles.modalConfirm}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

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

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg },
    position: {
      color: colors.textFaint,
      fontFamily: FONTS.mono,
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
      borderBottomColor: colors.borderDim,
      gap: 12,
    },
    toolbarBtn: { color: colors.gold, fontFamily: FONTS.bodySemiBold, fontSize: 14 },
    status: { color: colors.textFaint, fontFamily: FONTS.mono, fontSize: 11, flex: 1, textAlign: 'center' },
    measurer: { position: 'absolute', left: -9999, top: 0, opacity: 0 },
    editInput: {
      flex: 1,
      color: colors.text,
      fontFamily: FONTS.literary,
      fontSize: 16.5,
      lineHeight: LINE_HEIGHT,
      padding: 20,
    },
    jumpPopup: {
      position: 'absolute',
      flexDirection: 'row',
      alignItems: 'center',
      height: 38,
      paddingHorizontal: 4,
      backgroundColor: colors.gold,
      borderRadius: 19,
      shadowColor: '#000',
      shadowOpacity: 0.4,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
      elevation: 6,
    },
    jumpPopupBtn: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 12, paddingVertical: 2 },
    jumpPopupDivider: { width: 1, alignSelf: 'stretch', backgroundColor: 'rgba(43,26,5,0.25)' },
    jumpPopupText: { color: '#2b1a05', fontFamily: FONTS.bodySemiBold, fontSize: 14 },
    flagPickerScreen: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 20 },
    flagPickerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
    flagPickerClose: { color: colors.textDim, fontSize: 26, lineHeight: 26 },
    flagPickerOption: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      backgroundColor: colors.panel,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      padding: 16,
      marginTop: 12,
    },
    flagPickerOptionEmoji: { fontSize: 26 },
    flagPickerOptionTitle: { color: colors.text, fontFamily: FONTS.headingBold, fontSize: 16 },
    flagPickerOptionDesc: { color: colors.textFaint, fontSize: 12, marginTop: 2 },
    flagRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
    flagSwatch: { width: 10, height: 10, borderRadius: 5 },
    flagBody: { flex: 1 },
    flagType: { color: colors.textDim, fontSize: 11 },
    flagText: { color: colors.textDim, fontSize: 13, fontStyle: 'italic' },
    flagLabel: { color: colors.textFaint, fontSize: 12 },
    flagRemove: { color: colors.error, fontSize: 18, paddingHorizontal: 4 },
    flagWeb: { color: colors.gold, fontSize: 11, paddingHorizontal: 6 },
    flagThreadOn: { fontSize: 14 },
    threadLabel: {
      color: colors.textFaint,
      fontFamily: FONTS.mono,
      fontSize: 10,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginTop: 14,
      marginBottom: 6,
    },
    threadInput: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: colors.text,
      fontSize: 15,
    },
    threadChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
    threadChip: {
      borderWidth: 1,
      borderColor: colors.borderDim,
      borderRadius: 14,
      paddingVertical: 6,
      paddingHorizontal: 11,
    },
    threadChipOn: { borderColor: colors.gold, backgroundColor: withOpacity(colors.gold, 0.16) },
    threadChipText: { color: colors.textDim, fontSize: 12 },
    threadActions: { flexDirection: 'row', alignItems: 'center', gap: 20, marginTop: 18 },
    threadClear: { color: colors.error, fontSize: 13 },
    modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 24 },
    modalCard: { backgroundColor: colors.panel, borderRadius: 10, padding: 20, borderWidth: 1, borderColor: colors.border },
    modalTitle: { color: colors.text, fontFamily: FONTS.headingBold, fontSize: 16, marginBottom: 10 },
    modalSelectedText: { color: colors.textFaint, fontSize: 13, fontStyle: 'italic', marginBottom: 12 },
    modalInput: {
      backgroundColor: colors.bg,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 6,
      padding: 10,
      color: colors.text,
      fontSize: 14,
      marginBottom: 10,
    },
    modalInputMultiline: { minHeight: 76 },
    modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 20, marginTop: 8 },
    modalCancel: { color: colors.textDim, fontSize: 14 },
    modalConfirm: { color: colors.gold, fontSize: 14, fontWeight: '700' },
    modalEmpty: { color: colors.textFaint, fontSize: 13, fontStyle: 'italic' },
    versionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderDim,
    },
    versionTime: { color: colors.textFaint, fontSize: 11 },
    versionPreview: { color: colors.textDim, fontSize: 12.5, fontStyle: 'italic' },
  });
}
