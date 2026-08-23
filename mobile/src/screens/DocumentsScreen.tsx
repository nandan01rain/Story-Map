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

import Icon from '../components/Icon';
import type { SignedInStackParamList } from '../navigation/types';
import { useAuthStore } from '../store/authStore';
import { useTrashStore } from '../store/trashStore';
import {
  DOCUMENT_TYPES,
  DOCUMENT_TYPE_LABELS,
  type DocumentType,
  type StoryDocument,
  useDocumentStore,
} from '../store/documentStore';
import { FONTS, type ThemeColors, useTheme, withOpacity } from '../theme';

type Props = NativeStackScreenProps<SignedInStackParamList, 'Documents'>;

const AUTOSAVE_DELAY_MS = 1200; // same cadence as the chapter editor

// The PWA's Documents library, finally on mobile: Master Bible, character bibles, scene
// references, timelines. A list that opens into a plain full-screen editor -- these are
// free text, with none of the chapter editor's flagging or version machinery, because
// nothing here is prose being drafted.
export default function DocumentsScreen({ route, navigation }: Props) {
  const { projectId } = route.params;
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const user = useAuthStore((s) => s.user);
  // Documents go to the trash rather than being destroyed -- an imported reference doc is
  // exactly the kind of thing worth being able to get back.
  const trashDocument = useTrashStore((s) => s.trashDocument);
  const { documents, loading, error, fetchDocuments, createDocument, updateDocument, deleteDocument } =
    useDocumentStore();

  const [openDoc, setOpenDoc] = useState<StoryDocument | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [status, setStatus] = useState('');
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    navigation.setOptions({ title: openDoc ? '' : 'Documents' });
  }, [navigation, openDoc]);

  useEffect(() => {
    fetchDocuments(projectId);
  }, [projectId, fetchDocuments]);

  const grouped = useMemo(() => {
    const map = new Map<string, StoryDocument[]>();
    for (const doc of documents) {
      const key = doc.type || 'reference';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(doc);
    }
    return map;
  }, [documents]);

  function open(doc: StoryDocument) {
    setOpenDoc(doc);
    setTitle(doc.title);
    setBody(doc.content ?? '');
    setStatus('');
  }

  function scheduleSave(nextTitle: string, nextBody: string) {
    if (!openDoc) return;
    setStatus('Unsaved changes…');
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const { error: err } = await updateDocument(openDoc.id, { title: nextTitle, content: nextBody });
      setStatus(err ? `Not saved: ${err}` : 'Saved.');
      if (!err) setTimeout(() => setStatus((s) => (s === 'Saved.' ? '' : s)), 2000);
    }, AUTOSAVE_DELAY_MS);
  }

  function close() {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    if (openDoc && (title !== openDoc.title || body !== (openDoc.content ?? ''))) {
      updateDocument(openDoc.id, { title, content: body });
    }
    setOpenDoc(null);
  }

  async function handleCreate() {
    if (!user) return;
    const { document, error: err } = await createDocument(projectId, user.id, 'Untitled', 'reference', '');
    if (err || !document) {
      Alert.alert('Could not create', err ?? 'Unknown error');
      return;
    }
    open(document);
  }

  function confirmDelete(doc: StoryDocument) {
    // Not permanent any more -- an imported reference doc is exactly the kind of thing worth
    // being able to get back.
    Alert.alert('Delete document', `Move "${doc.title}" to the trash?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (!user) return;
          const { error: err } = await trashDocument(projectId, user.id, doc);
          if (err) {
            setOpenDoc(null);
            return;
          }
          fetchDocuments(projectId);
          setOpenDoc(null);
        },
      },
    ]);
  }

  if (openDoc) {
    return (
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={styles.editorHeader}>
          <Pressable onPress={close} hitSlop={10}>
            <Text style={styles.headerBtn}>Done</Text>
          </Pressable>
          <Text style={styles.status}>{status}</Text>
          <Pressable onPress={() => confirmDelete(openDoc)} hitSlop={10}>
            <Icon name="trash" size={17} color={colors.textFaint} />
          </Pressable>
        </View>

        <TextInput
          style={styles.titleInput}
          value={title}
          onChangeText={(t) => {
            setTitle(t);
            scheduleSave(t, body);
          }}
          placeholder="Title"
          placeholderTextColor={colors.textFaint}
        />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.typeRow}>
          {DOCUMENT_TYPES.map((type) => (
            <Pressable
              key={type}
              style={[styles.typeChip, openDoc.type === type && styles.typeChipOn]}
              onPress={async () => {
                await updateDocument(openDoc.id, { type });
                setOpenDoc({ ...openDoc, type });
              }}
            >
              <Text style={[styles.typeChipText, openDoc.type === type && styles.typeChipTextOn]}>
                {DOCUMENT_TYPE_LABELS[type as DocumentType]}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        <TextInput
          style={styles.bodyInput}
          value={body}
          onChangeText={(t) => {
            setBody(t);
            scheduleSave(title, t);
          }}
          multiline
          textAlignVertical="top"
          placeholder="Write freely…"
          placeholderTextColor={colors.textFaint}
        />
      </KeyboardAvoidingView>
    );
  }

  return (
    <View style={styles.screen}>
      {loading && <ActivityIndicator style={{ marginTop: 24 }} color={colors.gold} />}
      {!!error && <Text style={styles.error}>{error}</Text>}

      <ScrollView contentContainerStyle={styles.list}>
        {!loading && documents.length === 0 && (
          <Text style={styles.empty}>
            No documents yet. Create one, or import your notes from Google Drive.
          </Text>
        )}

        {[...grouped.entries()].map(([type, docs]) => (
          <View key={type} style={styles.group}>
            <Text style={styles.groupLabel}>
              {DOCUMENT_TYPE_LABELS[type as DocumentType] ?? type}
            </Text>
            {docs.map((doc) => (
              <Pressable key={doc.id} style={styles.row} onPress={() => open(doc)}>
                <Icon name="list" size={16} color={colors.gold} />
                <View style={styles.rowBody}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {doc.title}
                  </Text>
                  <Text style={styles.rowMeta} numberOfLines={1}>
                    {doc.content ? `${doc.content.trim().split(/\s+/).length} words` : 'Empty'}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable style={styles.footerBtn} onPress={handleCreate}>
          <Icon name="plus" size={16} color={colors.gold} />
          <Text style={styles.footerBtnText}>New document</Text>
        </Pressable>
        <Pressable
          style={styles.footerBtn}
          onPress={() => navigation.navigate('DriveImport', { projectId })}
        >
          <Icon name="download" size={16} color={colors.gold} />
          <Text style={styles.footerBtnText}>Import from Drive</Text>
        </Pressable>
      </View>
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg },
    list: { padding: 16, paddingBottom: 30 },
    group: { marginBottom: 22 },
    groupLabel: {
      color: colors.textFaint,
      fontFamily: FONTS.mono,
      fontSize: 10,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 8,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 12,
      paddingHorizontal: 12,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.borderDim,
      marginBottom: 8,
    },
    rowBody: { flex: 1 },
    rowTitle: { color: colors.text, fontSize: 14.5 },
    rowMeta: { color: colors.textFaint, fontSize: 11.5, marginTop: 2 },
    empty: { color: colors.textFaint, fontSize: 13, textAlign: 'center', marginTop: 40, lineHeight: 20 },
    error: { color: '#e0764a', fontSize: 12.5, padding: 16 },
    footer: {
      flexDirection: 'row',
      borderTopWidth: 1,
      borderTopColor: colors.borderDim,
      backgroundColor: colors.panel,
    },
    footerBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16 },
    footerBtnText: { color: colors.gold, fontFamily: FONTS.bodySemiBold, fontSize: 13.5 },
    editorHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderDim,
    },
    headerBtn: { color: colors.gold, fontFamily: FONTS.bodySemiBold, fontSize: 14 },
    status: { color: colors.textFaint, fontFamily: FONTS.mono, fontSize: 11 },
    titleInput: {
      color: colors.text,
      fontFamily: FONTS.heading,
      fontSize: 19,
      paddingHorizontal: 16,
      paddingTop: 14,
      paddingBottom: 6,
    },
    typeRow: { gap: 8, paddingHorizontal: 16, paddingVertical: 8 },
    typeChip: { paddingVertical: 6, paddingHorizontal: 11, borderRadius: 15, borderWidth: 1, borderColor: colors.border },
    typeChipOn: { borderColor: colors.gold, backgroundColor: withOpacity(colors.gold, 0.14) },
    typeChipText: { color: colors.textDim, fontSize: 12 },
    typeChipTextOn: { color: colors.text },
    bodyInput: {
      flex: 1,
      color: colors.text,
      fontFamily: FONTS.literary,
      fontSize: 16,
      lineHeight: 26,
      paddingHorizontal: 16,
      paddingBottom: 16,
    },
  });
}
