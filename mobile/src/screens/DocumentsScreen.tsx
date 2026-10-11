import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import Icon from '../components/Icon';
import type { SignedInStackParamList } from '../navigation/types';
import { useAuthStore } from '../store/authStore';
import { DOCUMENT_TYPES, DOCUMENT_TYPE_LABELS, type DocumentType, documentType, useDocumentStore } from '../store/documentStore';
import { FONTS, type ThemeColors, useTheme, withOpacity } from '../theme';

type Props = NativeStackScreenProps<SignedInStackParamList, 'Documents'>;

// The Documents library: Master Bible, character bibles, scene references, timelines, and the
// saga's reference set. A LIBRARY now, not an editor (2026-10-11): tapping a document opens it
// in the document reader, rendered; the pencil opens the editor. That split is the chapter
// Reader / chapter Editor split, for the same reason -- reading a 700 KB bible in a text box,
// one stray tap from changing it, is neither reading nor editing.
//
// In the order the documents arrived (created_at, newest first), which for the reference set
// is its intended reading order, with a filter by type rather than groups: grouping scattered
// that order across five headings.
export default function DocumentsScreen({ route, navigation }: Props) {
  const { projectId } = route.params;
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const user = useAuthStore((s) => s.user);
  const { documents, loading, error, fetchDocuments, createDocument } = useDocumentStore();
  const [filter, setFilter] = useState<DocumentType | null>(null);

  useEffect(() => {
    navigation.setOptions({ title: 'Documents' });
  }, [navigation]);

  useEffect(() => {
    const unsub = navigation.addListener('focus', () => fetchDocuments(projectId));
    return unsub;
  }, [navigation, projectId, fetchDocuments]);

  const counts = useMemo(() => {
    const c = new Map<DocumentType, number>();
    for (const d of documents) c.set(documentType(d.type), (c.get(documentType(d.type)) ?? 0) + 1);
    return c;
  }, [documents]);

  // The archive is kept but out of the way: never in "All", only behind its own filter.
  const live = useMemo(() => documents.filter((d) => documentType(d.type) !== 'Archive'), [documents]);
  const shown = useMemo(
    () => (filter ? documents.filter((d) => documentType(d.type) === filter) : live),
    [documents, live, filter],
  );

  async function handleCreate() {
    if (!user) return;
    const { document, error: err } = await createDocument(projectId, user.id, 'Untitled', 'Other', '');
    if (err || !document) {
      Alert.alert('Could not create', err ?? 'Unknown error');
      return;
    }
    navigation.navigate('DocumentEditor', { projectId, documentId: document.id });
  }

  return (
    <View style={styles.screen}>
      {documents.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterRow}>
          <Pressable style={[styles.chip, filter === null && styles.chipOn]} onPress={() => setFilter(null)}>
            <Text style={[styles.chipText, filter === null && styles.chipTextOn]}>{`All ${live.length}`}</Text>
          </Pressable>
          {DOCUMENT_TYPES.filter((t) => counts.get(t)).map((t) => (
            <Pressable key={t} style={[styles.chip, filter === t && styles.chipOn]} onPress={() => setFilter(filter === t ? null : t)}>
              <Text style={[styles.chipText, filter === t && styles.chipTextOn]}>{`${DOCUMENT_TYPE_LABELS[t]} ${counts.get(t)}`}</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      {!!error && <Text style={styles.error}>{error}</Text>}

      <FlatList
        data={shown}
        keyExtractor={(d) => d.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator style={{ marginTop: 30 }} color={colors.gold} />
          ) : (
            <Text style={styles.empty}>No documents yet. Create one, or import your notes from Google Drive.</Text>
          )
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Pressable style={styles.rowMain} onPress={() => navigation.navigate('DocumentReader', { projectId, documentId: item.id })}>
              <Text style={styles.rowTitle} numberOfLines={2}>
                {item.title || 'Untitled document'}
              </Text>
              <Text style={styles.rowMeta}>{DOCUMENT_TYPE_LABELS[documentType(item.type)]}</Text>
            </Pressable>
            <Pressable
              style={styles.editBtn}
              hitSlop={6}
              onPress={() => navigation.navigate('DocumentEditor', { projectId, documentId: item.id })}
            >
              <Icon name="pencil" size={16} color={colors.gold} />
            </Pressable>
          </View>
        )}
      />

      <View style={styles.footer}>
        <Pressable style={styles.footerBtn} onPress={handleCreate}>
          <Icon name="plus" size={16} color={colors.gold} />
          <Text style={styles.footerBtnText}>New document</Text>
        </Pressable>
        <Pressable style={styles.footerBtn} onPress={() => navigation.navigate('DriveImport', { projectId })}>
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
    // flexGrow 0: a horizontal ScrollView in a column otherwise stretches its chips (§36.3).
    filterScroll: { flexGrow: 0, flexShrink: 0 },
    filterRow: { gap: 8, paddingHorizontal: 16, paddingVertical: 10, alignItems: 'center' },
    chip: { paddingVertical: 5, paddingHorizontal: 11, borderRadius: 14, borderWidth: 1, borderColor: colors.borderDim },
    chipOn: { borderColor: colors.gold, backgroundColor: withOpacity(colors.gold, 0.12) },
    chipText: { color: colors.textDim, fontFamily: FONTS.body, fontSize: 12.5 },
    chipTextOn: { color: colors.gold },
    list: { paddingHorizontal: 16, paddingBottom: 30 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.borderDim,
      marginBottom: 8,
    },
    rowMain: { flex: 1, paddingVertical: 11, paddingLeft: 13, paddingRight: 6 },
    rowTitle: { color: colors.text, fontFamily: FONTS.body, fontSize: 14.5, lineHeight: 19 },
    rowMeta: { color: colors.textFaint, fontFamily: FONTS.mono, fontSize: 10.5, marginTop: 3, textTransform: 'uppercase', letterSpacing: 0.4 },
    editBtn: { paddingHorizontal: 14, paddingVertical: 14, borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: colors.borderDim },
    empty: { color: colors.textFaint, fontSize: 13, textAlign: 'center', marginTop: 40, lineHeight: 20 },
    error: { color: colors.error, fontSize: 12.5, padding: 16 },
    footer: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: colors.borderDim, backgroundColor: colors.panel },
    footerBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16 },
    footerBtnText: { color: colors.gold, fontFamily: FONTS.bodySemiBold, fontSize: 13.5 },
  });
}
