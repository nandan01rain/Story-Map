import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as DocumentPicker from 'expo-document-picker';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
import { WebView } from 'react-native-webview';

import { JOURNAL_HTML } from '../lib/journalHtml';
import { bookName } from '../lib/storyData';
import type { SignedInStackParamList } from '../navigation/types';
import { useAuthStore } from '../store/authStore';
import { documentType, useDocumentStore } from '../store/documentStore';
import { type JournalItem, useJournalStore } from '../store/journalStore';
import { useStoryboardStore } from '../store/storyboardStore';
import { treatmentTitle, useTreatmentStore } from '../store/treatmentStore';
import { FONTS, type ThemeColors, useTheme } from '../theme';
import { journalDay } from './JournalScreen';

type Props = NativeStackScreenProps<SignedInStackParamList, 'JournalPage'>;

const PAPERS: [string, string][] = [['lined', 'Lined'], ['grid', 'Grid'], ['dot', 'Dotted'], ['plain', 'Plain'], ['kraft', 'Kraft'], ['parchment', 'Parchment']];
const SCENE_PREFIX = /^(Backstory|Prologue|B\d+|Skip|After|Unplaced) · /;

// One journal page. The page itself -- drawing, moving, turning, sizing, the palette -- is
// journal/journal-kit.js running in a WebView, the same code as the studio's Journal tab, so a
// page looks the same in both apps by construction. This screen holds the data: it posts the page
// in, mirrors every change into the store (which saves it), answers requests for picture links,
// and does the writing of words in a native sheet, where the system keyboard behaves.
export default function JournalPageScreen({ route, navigation }: Props) {
  const { projectId, pageId } = route.params;
  const user = useAuthStore((s) => s.user);
  const journal = useJournalStore();
  const page = journal.pages.find((p) => p.id === pageId);
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const web = useRef<WebView>(null);
  const ready = useRef(false);

  const [title, setTitle] = useState(page?.title ?? '');
  const [day, setDay] = useState(String(page?.day ?? '').slice(0, 10));
  const [editing, setEditing] = useState<JournalItem | null>(null);
  const [words, setWords] = useState('');

  const send = useCallback((m: object) => web.current?.postMessage(JSON.stringify(m)), []);

  useEffect(() => {
    if (!page) void journal.fetch(projectId);
    // The palette's Project tab: whatever is not loaded yet is fetched once, quietly.
    const board = useStoryboardStore.getState();
    if (board.projectId !== projectId) void board.fetch(projectId).then(sendLibrary);
    if (!useTreatmentStore.getState().treatments.length) void useTreatmentStore.getState().fetchTreatments(projectId).then(sendLibrary);
    if (!useDocumentStore.getState().documents.length) void useDocumentStore.getState().fetchDocuments(projectId).then(sendLibrary);
    return () => { void useJournalStore.getState().flush(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, pageId]);

  const uploads = useRef<string[]>([]);
  async function sendLibrary() {
    if (!ready.current) return;
    const board = useStoryboardStore.getState();
    const tr = useTreatmentStore.getState();
    const docs = useDocumentStore.getState().documents;
    send({
      type: 'library',
      library: {
        uploads: uploads.current,
        cast: board.cast.map((c) => ({ id: c.id, name: c.name, color: c.color, image_path: c.image_path ?? null, description: c.description ?? '' })),
        notes: board.events.map((e) => ({ id: e.id, title: e.title, summary: e.summary, book: bookName(e.book) })),
        scenes: tr.treatments.map((t) => {
          const live = tr.liveVersion(t.id);
          const text = (live?.content ?? '').replace(/^#+.*\n/, '').replace(/[*_#>`]/g, '').trim().slice(0, 320);
          return { id: t.id, title: treatmentTitle(t, live).replace(SCENE_PREFIX, ''), text };
        }),
        docs: docs.filter((d) => documentType(d.type) !== 'Archive').map((d) => ({ id: d.id, title: d.title })),
      },
    });
  }
  async function refreshUploads() {
    if (!user) return;
    uploads.current = await journal.listUploads(user.id);
    void sendLibrary();
  }

  async function onMessage(raw: string) {
    let m: { type: string; [k: string]: unknown };
    try { m = JSON.parse(raw); } catch { return; }
    const current = useJournalStore.getState().pages.find((p) => p.id === pageId);
    if (m.type === 'ready') {
      ready.current = true;
      if (current) send({ type: 'page', page: current });
      void sendLibrary();
      void refreshUploads();
    } else if (m.type === 'url') {
      const url = await journal.urlFor(String(m.bucket), String(m.path));
      send({ type: 'url', rid: m.rid, url });
    } else if (m.type === 'changed') {
      journal.update(pageId, { items: m.items as JournalItem[] });
    } else if (m.type === 'editText') {
      const it = m.item as JournalItem;
      setEditing(it);
      setWords(String(it.text ?? ''));
    } else if (m.type === 'pickDocument') {
      const { document } = await useDocumentStore.getState().fetchDocument(String(m.id));
      if (!document) return;
      const firstPara = String(document.content ?? '').split(/\n\s*\n/).map((p) => p.replace(/[*_#>`|]/g, '').trim()).find((p) => p.length > 40) ?? '';
      send({ type: 'add', fields: { kind: 'cutout', source: 'document', ref: document.id, title: document.title, text: firstPara.slice(0, 360), paper: 'grid', w: 270, h: 230 } });
    } else if (m.type === 'uploadPictures') {
      if (!user) return;
      const res = await DocumentPicker.getDocumentAsync({ type: 'image/*', copyToCacheDirectory: true, multiple: true });
      if (res.canceled) return;
      for (const a of res.assets ?? []) {
        const ext = (a.name.split('.').pop() || 'jpg').toLowerCase();
        const up = await journal.upload({ userId: user.id, uri: a.uri, ext, mimeType: a.mimeType ?? `image/${ext}` });
        if (up.error) { Alert.alert('Picture not added', up.error); break; }
      }
      await refreshUploads();
    }
  }

  function saveWords() {
    const it = editing;
    setEditing(null);
    if (!it) return;
    const fields: Record<string, unknown> = { text: words };
    if (it.kind === 'stamp' && it.shape === 'letters') fields.w = Math.min(560, 34 * words.length + 10);
    else if (it.kind === 'stamp') fields.text = words.toUpperCase();
    send({ type: 'patch', itemId: it.id, fields });
  }

  function setPaper(paper: string) {
    if (!page) return;
    journal.update(pageId, { paper });
    send({ type: 'page', page: { ...page, paper } });
  }

  function remove() {
    if (!page || !user) return;
    Alert.alert('Move this page to the Trash?', 'It can be restored from Trash, in either app.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Move to Trash',
        style: 'destructive',
        onPress: async () => {
          const { error } = await journal.trash({ userId: user.id, page });
          if (error) Alert.alert('Not moved', error);
          else navigation.goBack();
        },
      },
    ]);
  }

  if (!page) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator color={colors.gold} />
      </View>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.top}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Text style={styles.back}>‹</Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <TextInput
            style={styles.title}
            value={title}
            onChangeText={(t) => { setTitle(t); journal.update(pageId, { title: t }); }}
            placeholder={journalDay(page.day)}
            placeholderTextColor={colors.textFaint}
          />
          <TextInput
            style={styles.day}
            value={day}
            onChangeText={setDay}
            onEndEditing={() => {
              if (/^\d{4}-\d{2}-\d{2}$/.test(day) && !isNaN(Date.parse(day))) journal.update(pageId, { day });
              else setDay(String(page.day).slice(0, 10));
            }}
            placeholder="yyyy-mm-dd"
            placeholderTextColor={colors.textFaint}
            keyboardType="numbers-and-punctuation"
          />
        </View>
        <Pressable onPress={remove} hitSlop={10}>
          <Text style={styles.trash}>Trash</Text>
        </Pressable>
      </View>
      {!page.scan_path && (
        <ScrollView horizontal style={styles.papers} contentContainerStyle={styles.papersRow} showsHorizontalScrollIndicator={false}>
          {PAPERS.map(([k, label]) => (
            <Pressable key={k} style={[styles.chip, page.paper === k && styles.chipOn]} onPress={() => setPaper(k)}>
              <Text style={[styles.chipText, page.paper === k && styles.chipTextOn]}>{label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
      <WebView
        ref={web}
        style={[styles.web, { marginBottom: insets.bottom }]}
        originWhitelist={['*']}
        source={{ html: JOURNAL_HTML }}
        onMessage={(e) => void onMessage(e.nativeEvent.data)}
        javaScriptEnabled
        domStorageEnabled
        // A fixed local document; nothing on a page should navigate anywhere.
        onShouldStartLoadWithRequest={(r) => r.url === 'about:blank' || r.url.startsWith('data:')}
      />

      <Modal visible={!!editing} transparent animationType="fade" onRequestClose={saveWords}>
        <KeyboardAvoidingView style={styles.sheetWrap} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <Pressable style={StyleSheet.absoluteFill} onPress={saveWords} />
          <View style={styles.sheet}>
            <Text style={styles.sheetLabel}>
              {editing?.kind === 'stamp' ? (editing.shape === 'letters' ? 'The word to stamp, letter by letter' : 'Stamp') : editing?.kind === 'cutout' ? 'Cutout' : 'Write'}
            </Text>
            <TextInput
              style={[styles.words, editing?.kind === 'text' && styles.wordsHand]}
              value={words}
              onChangeText={setWords}
              autoFocus
              multiline={editing?.kind !== 'stamp'}
              placeholder="Write…"
              placeholderTextColor="#9a8a70"
            />
            <Pressable style={styles.done} onPress={saveWords}>
              <Text style={styles.doneText}>Done</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: '#2a1c11' },
    center: { alignItems: 'center', justifyContent: 'center' },
    top: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: colors.chrome },
    back: { color: colors.gold, fontSize: 34, lineHeight: 36, paddingHorizontal: 4 },
    title: { color: colors.text, fontFamily: FONTS.handBold, fontSize: 24, paddingVertical: 0 },
    day: { color: colors.textFaint, fontFamily: FONTS.mono, fontSize: 11, paddingVertical: 0 },
    trash: { color: colors.textFaint, fontFamily: FONTS.body, fontSize: 14 },
    papers: { flexGrow: 0, backgroundColor: colors.chrome },
    papersRow: { gap: 6, paddingHorizontal: 12, paddingBottom: 8 },
    chip: { borderWidth: 1, borderColor: colors.border, borderRadius: 14, paddingHorizontal: 11, paddingVertical: 4 },
    chipOn: { backgroundColor: colors.gold, borderColor: colors.gold },
    chipText: { color: colors.textDim, fontFamily: FONTS.body, fontSize: 13 },
    chipTextOn: { color: '#2b1a05' },
    web: { flex: 1, backgroundColor: '#5a3c25' },
    sheetWrap: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
    sheet: { backgroundColor: '#f4ead6', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16, gap: 10 },
    sheetLabel: { fontFamily: FONTS.heading, fontSize: 12, letterSpacing: 1.5, color: '#8a6420', textTransform: 'uppercase' },
    words: { minHeight: 48, maxHeight: 260, fontFamily: FONTS.body, fontSize: 17, color: '#2b2118', backgroundColor: '#fbf6ea', borderWidth: 1, borderColor: '#c9b48e', borderRadius: 8, padding: 10, textAlignVertical: 'top' },
    wordsHand: { fontFamily: FONTS.handBold, fontSize: 24, minHeight: 120 },
    done: { alignSelf: 'flex-end', backgroundColor: '#c69a3a', borderRadius: 10, paddingHorizontal: 22, paddingVertical: 10 },
    doneText: { color: '#2b1a05', fontFamily: FONTS.bodySemiBold, fontSize: 15 },
  });
}
