import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import DocumentTypeChips from '../components/DocumentTypeChips';
import Icon from '../components/Icon';
import ProgressionsPanel from '../components/ProgressionsPanel';
import { sectionRange } from '../lib/markdown';
import type { SignedInStackParamList } from '../navigation/types';
import { useAuthStore } from '../store/authStore';
import { type StoryDocument, useDocumentStore } from '../store/documentStore';
import { useTrashStore } from '../store/trashStore';
import { FONTS, type ThemeColors, useTheme } from '../theme';

type Props = NativeStackScreenProps<SignedInStackParamList, 'DocumentEditor'>;

const AUTOSAVE_DELAY_MS = 1200; // the chapter editor's cadence
// Above this a document opens one section at a time. A phone's text box stalls on the
// keystroke well before the Working Bible's 726 KB; a section of it is a few thousand words.
const WHOLE_DOCUMENT_LIMIT = 40_000;
// A multiline TextInput with anything to scroll internally keeps a vertical drag for itself
// (§36.3), so it is sized to its own content plus this much air.
const INPUT_SLACK = 6;

// A document, edited (2026-10-11) -- its own screen, as the chapter Editor is beside the
// Reader. Reached from the document reader's pencil, which passes `at`: the raw-text offset of
// what was on screen.
//
// A long document opens on the SECTION containing `at` -- from its `#`/`##` heading to the
// next -- and saves that section back into place, leaving the rest of the text exactly as it
// was. "Whole document" opens all of it, for the rare edit that spans sections.
//
// Saves are debounced and also forced when leaving, from refs rather than state: the chapter
// editor once wrote stale text on exit through a closure captured at mount (§33.1).
export default function DocumentEditorScreen({ route, navigation }: Props) {
  const { projectId, documentId, at = 0 } = route.params;
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const user = useAuthStore((s) => s.user);
  const fetchDocument = useDocumentStore((s) => s.fetchDocument);
  const updateDocument = useDocumentStore((s) => s.updateDocument);
  const trashDocument = useTrashStore((s) => s.trashDocument);

  const [doc, setDoc] = useState<StoryDocument | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [sectionTitle, setSectionTitle] = useState<string | null>(null);
  const [partial, setPartial] = useState(false);
  const [status, setStatus] = useState('');
  const [inputHeight, setInputHeight] = useState(320);

  // The whole stored text, and where the section being edited sits in it.
  const raw = useRef('');
  const range = useRef({ start: 0, end: 0 });
  const latest = useRef({ title: '', body: '' });
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function openRange(full: string, whole: boolean) {
    const r = whole || full.length <= WHOLE_DOCUMENT_LIMIT ? { start: 0, end: full.length, title: null } : sectionRange(full, at);
    range.current = { start: r.start, end: r.end };
    const text = full.slice(r.start, r.end);
    setBody(text);
    latest.current.body = text;
    setPartial(r.start !== 0 || r.end !== full.length);
    setSectionTitle(r.title);
  }

  useEffect(() => {
    void fetchDocument(documentId).then(({ document, error: err }) => {
      if (err || !document) {
        setError(err ?? 'Document not found.');
        return;
      }
      setDoc(document);
      setTitle(document.title);
      latest.current.title = document.title;
      raw.current = document.content ?? '';
      openRange(raw.current, false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId]);

  async function save(): Promise<void> {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (!dirty.current) return;
    dirty.current = false;
    const { start, end } = range.current;
    const full = raw.current.slice(0, start) + latest.current.body + raw.current.slice(end);
    const { error: err } = await updateDocument(documentId, { title: latest.current.title, content: full });
    if (err) {
      dirty.current = true;
      setStatus(`Not saved: ${err}`);
      return;
    }
    raw.current = full;
    range.current = { start, end: start + latest.current.body.length };
    setStatus('Saved');
    setTimeout(() => setStatus((s) => (s === 'Saved' ? '' : s)), 1800);
  }

  function changed(next: { title?: string; body?: string }) {
    if (next.title !== undefined) {
      setTitle(next.title);
      latest.current.title = next.title;
    }
    if (next.body !== undefined) {
      setBody(next.body);
      latest.current.body = next.body;
    }
    dirty.current = true;
    setStatus('Editing…');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void save(), AUTOSAVE_DELAY_MS);
  }

  // Leaving by any route -- the back button, the gesture, Done -- writes what is pending.
  useEffect(() => {
    const unsub = navigation.addListener('beforeRemove', () => {
      void save();
    });
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation]);

  async function openWhole() {
    await save();
    openRange(raw.current, true);
  }

  async function changeType(type: string) {
    if (!doc) return;
    setDoc({ ...doc, type });
    const { error: err } = await updateDocument(documentId, { type });
    if (err) Alert.alert('Type not saved', err);
  }

  function confirmDelete() {
    if (!doc || !user) return;
    Alert.alert('Delete document', `Move "${title}" to the trash? It can be restored from there.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await save();
          // The trash keeps the whole document, so it is passed with its full current text.
          const { error: err } = await trashDocument(projectId, user.id, { ...doc, title, content: raw.current });
          if (err) {
            Alert.alert('Not deleted', err);
            return;
          }
          void useDocumentStore.getState().fetchDocuments(projectId);
          navigation.navigate('Documents', { projectId });
        },
      },
    ]);
  }

  if (error) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <Text style={styles.error}>{error}</Text>
      </View>
    );
  }
  if (!doc) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <ActivityIndicator color={colors.gold} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.bar}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10}>
          <Text style={styles.done}>Done</Text>
        </Pressable>
        <Text style={styles.status}>{status}</Text>
        <Pressable onPress={confirmDelete} hitSlop={10}>
          <Icon name="trash" size={17} color={colors.textFaint} />
        </Pressable>
      </View>

      <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled">
        <TextInput
          style={styles.titleInput}
          value={title}
          onChangeText={(t) => changed({ title: t })}
          placeholder="Title"
          placeholderTextColor={colors.textFaint}
        />
        <DocumentTypeChips value={doc.type} onChange={changeType} />

        {partial && (
          <View style={styles.sectionBar}>
            <Text style={styles.sectionText} numberOfLines={2}>
              {`Editing one section${sectionTitle ? `: ${sectionTitle}` : ''}. The rest of the document is unchanged.`}
            </Text>
            <Pressable onPress={openWhole} hitSlop={8}>
              <Text style={styles.sectionBtn}>Whole document</Text>
            </Pressable>
          </View>
        )}

        <TextInput
          style={[styles.bodyInput, { height: inputHeight }]}
          value={body}
          onChangeText={(t) => changed({ body: t })}
          onContentSizeChange={(e) => setInputHeight(Math.max(320, e.nativeEvent.contentSize.height + INPUT_SLACK))}
          multiline
          scrollEnabled={false}
          textAlignVertical="top"
          placeholder="Write freely… Markdown works: # headings, **bold**, *italics*, - lists, | tables |"
          placeholderTextColor={colors.textFaint}
        />

        {user && <ProgressionsPanel documentId={documentId} projectId={projectId} userId={user.id} />}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg },
    centered: { alignItems: 'center', justifyContent: 'center', padding: 30 },
    error: { color: colors.error, fontFamily: FONTS.body, fontSize: 14, textAlign: 'center' },
    bar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderDim,
    },
    done: { color: colors.gold, fontFamily: FONTS.bodySemiBold, fontSize: 14.5 },
    status: { color: colors.textFaint, fontFamily: FONTS.mono, fontSize: 11 },
    titleInput: {
      color: colors.text,
      fontFamily: FONTS.heading,
      fontSize: 19,
      paddingHorizontal: 16,
      paddingTop: 14,
      paddingBottom: 4,
    },
    sectionBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginHorizontal: 16,
      marginVertical: 6,
      paddingHorizontal: 12,
      paddingVertical: 9,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.borderDim,
      backgroundColor: colors.panel,
    },
    sectionText: { flex: 1, color: colors.textDim, fontFamily: FONTS.body, fontSize: 12.5, lineHeight: 17 },
    sectionBtn: { color: colors.gold, fontFamily: FONTS.bodySemiBold, fontSize: 12.5 },
    bodyInput: {
      color: colors.text,
      fontFamily: FONTS.literary,
      fontSize: 16,
      lineHeight: 26,
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 16,
    },
  });
}
