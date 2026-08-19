import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { SignedInStackParamList } from '../navigation/types';
import { useAuthStore } from '../store/authStore';
import { type StickyNote, useStickyNoteStore } from '../store/stickyNoteStore';
import { FONTS, type ThemeColors, useTheme } from '../theme';

type Props = NativeStackScreenProps<SignedInStackParamList, 'StickyNotes'>;

const AUTOSAVE_DELAY_MS = 800;

// "The Margin" (CLAUDE.md's Full feature list) -- quick, unstructured idea capture,
// ported as-is from the PWA: a wrapping board of parchment-toned cards, each just free
// text with autosave, a slight per-card rotation so the board doesn't read as a rigid
// list. No titles, no folders, no structure -- that's the point of it.
//
// Cards themselves are a read-only preview now, not directly editable -- tapping one
// opens a full-screen editor sheet instead (per explicit feedback: a 160x160 card is too
// small to actually type an idea out in). The card's own look is unchanged, it's just no
// longer where typing happens.
export default function StickyNotesScreen({ route, navigation }: Props) {
  const { projectId, noteId } = route.params;
  const user = useAuthStore((s) => s.user);
  const { notes, loading, fetchNotes, createNote, deleteNote } = useStickyNoteStore();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    navigation.setOptions({ title: 'Notes' });
  }, [navigation]);

  useEffect(() => {
    fetchNotes(projectId);
  }, [projectId, fetchNotes]);

  // Arriving from a search hit -- open that note's editor straight away.
  useEffect(() => {
    if (noteId) setEditingId(noteId);
  }, [noteId]);

  async function handleAdd() {
    if (!user) return;
    setCreating(true);
    const { note } = await createNote(user.id, projectId);
    setCreating(false);
    if (note) setEditingId(note.id);
  }

  function handleDelete(note: StickyNote) {
    Alert.alert('Delete note', 'This note will be gone for good.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteNote(note.id) },
    ]);
  }

  const editingNote = notes.find((n) => n.id === editingId) ?? null;

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.board}>
        {notes.length === 0 && !loading && <Text style={styles.empty}>No notes yet -- tap + to jot one down.</Text>}
        {notes.map((note) => (
          <StickyNoteCard
            key={note.id}
            note={note}
            styles={styles}
            onOpen={() => setEditingId(note.id)}
            onDelete={() => handleDelete(note)}
          />
        ))}
      </ScrollView>
      <Pressable style={styles.addBtn} onPress={handleAdd} disabled={creating}>
        <Text style={styles.addBtnText}>+</Text>
      </Pressable>

      <StickyNoteEditorSheet note={editingNote} styles={styles} onClose={() => setEditingId(null)} />
    </View>
  );
}

function StickyNoteCard({
  note,
  styles,
  onOpen,
  onDelete,
}: {
  note: StickyNote;
  styles: Styles;
  onOpen: () => void;
  onDelete: () => void;
}) {
  return (
    <Pressable style={[styles.card, { transform: [{ rotate: `${note.rotation}deg` }] }]} onPress={onOpen}>
      <Pressable style={styles.cardDelete} onPress={onDelete} hitSlop={8}>
        <Text style={styles.cardDeleteText}>×</Text>
      </Pressable>
      {note.content ? (
        <Text style={styles.cardPreview} numberOfLines={7}>
          {note.content}
        </Text>
      ) : (
        <Text style={styles.cardPlaceholder}>Jot something down...</Text>
      )}
    </Pressable>
  );
}

// Full-screen editor, opened by tapping a card -- the card itself stays a small fixed-
// size preview, this is where the actual typing happens. Same autosave debounce pattern
// as EditorScreen/the old inline card version.
function StickyNoteEditorSheet({
  note,
  styles,
  onClose,
}: {
  note: StickyNote | null;
  styles: Styles;
  onClose: () => void;
}) {
  const updateNote = useStickyNoteStore((s) => s.updateNote);
  const [content, setContent] = useState('');
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noteIdRef = useRef<string | null>(null);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (note && note.id !== noteIdRef.current) {
      noteIdRef.current = note.id;
      setContent(note.content);
    }
  }, [note]);

  function handleChange(text: string) {
    setContent(text);
    if (!note) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => updateNote(note.id, text), AUTOSAVE_DELAY_MS);
  }

  function handleClose() {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    if (note && content !== note.content) updateNote(note.id, content);
    onClose();
  }

  return (
    <Modal visible={!!note} animationType="slide" onRequestClose={handleClose}>
      <View style={[styles.sheetScreen, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.sheetHeader}>
          <Pressable onPress={handleClose} hitSlop={10}>
            <Text style={styles.sheetClose}>✕</Text>
          </Pressable>
        </View>
        <TextInput
          style={styles.sheetInput}
          value={content}
          onChangeText={handleChange}
          multiline
          autoFocus
          textAlignVertical="top"
          placeholder="Jot something down..."
          placeholderTextColor="#8a7355"
        />
      </View>
    </Modal>
  );
}

type Styles = ReturnType<typeof makeStyles>;

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg },
    board: { flexDirection: 'row', flexWrap: 'wrap', padding: 14, paddingBottom: 90, gap: 14 },
    empty: { color: colors.textDim, fontSize: 13, padding: 10 },
    card: {
      width: 160,
      height: 160,
      backgroundColor: '#f0e3ba',
      borderRadius: 3,
      padding: 12,
      shadowColor: '#000',
      shadowOpacity: 0.35,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 3 },
      elevation: 5,
    },
    cardPreview: { flex: 1, color: '#3a2e14', fontFamily: FONTS.literary, fontSize: 13.5, lineHeight: 18 },
    cardPlaceholder: { flex: 1, color: '#8a7355', fontFamily: FONTS.literaryItalic, fontSize: 13, fontStyle: 'italic' },
    cardDelete: { position: 'absolute', top: 4, right: 6, zIndex: 1, padding: 4 },
    cardDeleteText: { color: '#6b5d3a', fontSize: 16 },
    addBtn: {
      position: 'absolute',
      bottom: 24,
      right: 24,
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.gold,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOpacity: 0.4,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 3 },
      elevation: 6,
    },
    addBtnText: { color: '#2b1a05', fontSize: 28, lineHeight: 30, fontFamily: FONTS.bodySemiBold },
    sheetScreen: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 20 },
    sheetHeader: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 10 },
    sheetClose: { color: colors.textDim, fontSize: 26, lineHeight: 26 },
    sheetInput: { flex: 1, color: colors.text, fontFamily: FONTS.literary, fontSize: 17, lineHeight: 26 },
  });
}
