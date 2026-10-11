import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import DocumentTypeChips from '../components/DocumentTypeChips';
import { MarkdownBlock, type MarkdownLook } from '../components/MarkdownBlock';
import { parseMarkdown } from '../lib/markdown';
import type { SignedInStackParamList } from '../navigation/types';
import { useAuthStore } from '../store/authStore';
import { type DocumentType, useDocumentStore } from '../store/documentStore';
import { FONTS, type ThemeColors, useTheme } from '../theme';

type Props = NativeStackScreenProps<SignedInStackParamList, 'PatchImport'>;

// A patch from Claude, into the library (2026-10-11). Paste what Claude wrote, or pick the .md
// file it gave you (Claude's app can save or share a file; it lands where the picker can reach
// it). It becomes one document, titled from its first heading, previewed rendered before it is
// saved. The web studio has the same box, which also takes several files at once.
function titleOf(text: string): string {
  const line = text.split('\n').map((l) => l.trim()).find((l) => /^#{1,3}\s+\S/.test(l));
  return line ? line.replace(/^#+\s*/, '').replace(/[*_`]/g, '').trim() : '';
}

export default function PatchImportScreen({ route, navigation }: Props) {
  const { projectId } = route.params;
  const user = useAuthStore((s) => s.user);
  const createDocument = useDocumentStore((s) => s.createDocument);
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [text, setText] = useState('');
  const [title, setTitle] = useState('');
  const [titleTouched, setTitleTouched] = useState(false);
  const [type, setType] = useState<DocumentType>('Other');
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);

  const look: MarkdownLook = useMemo(() => ({ colors, fontFamily: FONTS.literary, fontSize: 15.5, lineHeight: 24, align: 'left' }), [colors]);
  const blocks = useMemo(() => (preview ? parseMarkdown(text) : []), [preview, text]);

  function setBody(t: string) {
    setText(t);
    if (!titleTouched) setTitle(titleOf(t));
  }

  async function pickFile() {
    const res = await DocumentPicker.getDocumentAsync({ type: ['text/markdown', 'text/plain', 'text/*', 'application/octet-stream'], copyToCacheDirectory: true });
    if (res.canceled || !res.assets?.[0]) return;
    const a = res.assets[0];
    try {
      const body = await new File(a.uri).text();
      setBody(body);
      if (!titleOf(body) && !titleTouched) setTitle(a.name.replace(/\.(md|markdown|txt)$/i, ''));
    } catch (e) {
      Alert.alert('Could not read that file', e instanceof Error ? e.message : 'Unknown error');
    }
  }

  async function save() {
    if (!user || !text.trim()) return;
    setSaving(true);
    const name = title.trim() || `Patch ${new Date().toISOString().slice(0, 10)}`;
    const { document, error } = await createDocument(projectId, user.id, name, type, text);
    setSaving(false);
    if (error || !document) {
      Alert.alert('Not saved', error ?? 'Unknown error');
      return;
    }
    navigation.replace('DocumentReader', { projectId, documentId: document.id });
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Text style={styles.lead}>Paste a patch Claude wrote, or pick the .md file it gave you. It goes into Documents as one document.</Text>
        <Pressable style={styles.pick} onPress={pickFile}>
          <Text style={styles.pickText}>Choose a .md file…</Text>
        </Pressable>

        <Text style={styles.label}>Title</Text>
        <TextInput
          style={styles.title}
          value={title}
          onChangeText={(t) => {
            setTitle(t);
            setTitleTouched(true);
          }}
          placeholder="Taken from the patch's first heading"
          placeholderTextColor={colors.textFaint}
        />
        <Text style={styles.label}>Type</Text>
        <DocumentTypeChips value={type} onChange={(t) => setType(t === 'Archive' ? 'Other' : t)} />

        <View style={styles.tabs}>
          <Pressable onPress={() => setPreview(false)}>
            <Text style={[styles.tab, !preview && styles.tabOn]}>Text</Text>
          </Pressable>
          <Pressable onPress={() => setPreview(true)} disabled={!text.trim()}>
            <Text style={[styles.tab, preview && styles.tabOn]}>Preview</Text>
          </Pressable>
        </View>
        {preview ? (
          <View style={styles.preview}>
            {blocks.map((b, i) => (
              <MarkdownBlock key={`${i}:${b.at}`} block={b} look={look} />
            ))}
          </View>
        ) : (
          <TextInput
            style={styles.paste}
            value={text}
            onChangeText={setBody}
            multiline
            textAlignVertical="top"
            placeholder="Paste the patch here…"
            placeholderTextColor={colors.textFaint}
          />
        )}

        <Pressable style={[styles.save, !text.trim() && { opacity: 0.4 }]} onPress={save} disabled={!text.trim() || saving}>
          {saving ? <ActivityIndicator color="#2b1a05" /> : <Text style={styles.saveText}>Add to Documents</Text>}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg },
    body: { padding: 18, paddingBottom: 60 },
    lead: { color: colors.textDim, fontFamily: FONTS.body, fontSize: 14, lineHeight: 21 },
    pick: { marginTop: 12, paddingVertical: 11, borderRadius: 10, borderWidth: 1, borderColor: colors.gold, alignItems: 'center' },
    pickText: { color: colors.gold, fontFamily: FONTS.bodySemiBold, fontSize: 14 },
    label: { color: colors.gold, fontFamily: FONTS.heading, fontSize: 11, letterSpacing: 2, marginTop: 18, marginBottom: 6 },
    title: { color: colors.text, fontFamily: FONTS.heading, fontSize: 18, borderBottomWidth: 1, borderBottomColor: colors.borderDim, paddingVertical: 6 },
    tabs: { flexDirection: 'row', gap: 20, marginTop: 18, marginBottom: 8 },
    tab: { color: colors.textFaint, fontFamily: FONTS.bodySemiBold, fontSize: 14 },
    tabOn: { color: colors.gold },
    paste: {
      minHeight: 260,
      color: colors.text,
      fontFamily: FONTS.mono,
      fontSize: 13,
      lineHeight: 19,
      padding: 10,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.borderDim,
      backgroundColor: colors.panel,
    },
    preview: { padding: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.borderDim },
    save: { marginTop: 20, paddingVertical: 14, borderRadius: 12, backgroundColor: colors.gold, alignItems: 'center' },
    saveText: { color: '#2b1a05', fontFamily: FONTS.bodySemiBold, fontSize: 15 },
  });
}
