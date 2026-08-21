import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import Icon from '../components/Icon';
import {
  type DriveFile,
  FOLDER_MIME,
  clearStoredToken,
  connectDrive,
  fetchFileText,
  getStoredToken,
  isImportable,
  listFiles,
} from '../lib/googleDrive';
import type { SignedInStackParamList } from '../navigation/types';
import { useAuthStore } from '../store/authStore';
import { DOCUMENT_TYPES, DOCUMENT_TYPE_LABELS, type DocumentType, useDocumentStore } from '../store/documentStore';
import { FONTS, type ThemeColors, useTheme, withOpacity } from '../theme';

type Props = NativeStackScreenProps<SignedInStackParamList, 'DriveImport'>;
type Crumb = { id: string; name: string };

// Pick files out of Google Drive and pull them into this project's Documents. Browse by
// folder or search the whole Drive, tick what matters, choose what kind of document the
// batch becomes, import.
//
// Files already imported are marked and cannot be selected again -- re-importing would
// silently create a second copy of a character bible rather than updating the first, and a
// duplicate is worse than a missing one. Matching is by title, which is the only handle we
// keep; the documents table has nowhere to record a Drive file id.
export default function DriveImportScreen({ route, navigation }: Props) {
  const { projectId } = route.params;
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const user = useAuthStore((s) => s.user);
  const { documents, fetchDocuments, createDocument } = useDocumentStore();

  const [connected, setConnected] = useState<boolean | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [crumbs, setCrumbs] = useState<Crumb[]>([{ id: 'root', name: 'My Drive' }]);
  const [search, setSearch] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [docType, setDocType] = useState<DocumentType>('reference');
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');

  const folderId = crumbs[crumbs.length - 1]?.id ?? 'root';

  useEffect(() => {
    navigation.setOptions({ title: 'Import from Drive' });
  }, [navigation]);

  useEffect(() => {
    fetchDocuments(projectId);
  }, [projectId, fetchDocuments]);

  useEffect(() => {
    getStoredToken().then((token) => setConnected(!!token));
  }, []);

  const alreadyImported = useMemo(
    () => new Set(documents.map((d) => d.title.toLowerCase())),
    [documents],
  );

  const load = useCallback(async () => {
    const token = await getStoredToken();
    if (!token) {
      setConnected(false);
      return;
    }
    setLoading(true);
    setError('');
    const { files: found, error: err } = await listFiles(token.accessToken, {
      folderId,
      query: activeSearch,
    });
    setLoading(false);
    if (err === 'AUTH') {
      // The stored token expired or was revoked -- drop it and ask for a fresh connection
      // rather than showing an empty folder and letting the user think Drive is empty.
      await clearStoredToken();
      setConnected(false);
      setError('Google access expired. Reconnect to continue.');
      return;
    }
    if (err) {
      setError(err);
      return;
    }
    setFiles(found);
  }, [folderId, activeSearch]);

  useEffect(() => {
    if (connected) load();
  }, [connected, load]);

  async function handleConnect() {
    setConnecting(true);
    setError('');
    const { error: err } = await connectDrive();
    setConnecting(false);
    if (err) {
      setError(err);
      return;
    }
    setConnected(true);
  }

  async function handleDisconnect() {
    await clearStoredToken();
    setConnected(false);
    setFiles([]);
    setSelected(new Set());
  }

  function openFolder(file: DriveFile) {
    setSelected(new Set());
    setActiveSearch('');
    setSearch('');
    setCrumbs((prev) => [...prev, { id: file.id, name: file.name }]);
  }

  function goToCrumb(index: number) {
    setSelected(new Set());
    setActiveSearch('');
    setSearch('');
    setCrumbs((prev) => prev.slice(0, index + 1));
  }

  function toggle(file: DriveFile) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(file.id)) next.delete(file.id);
      else next.add(file.id);
      return next;
    });
  }

  async function handleImport() {
    if (!user || selected.size === 0) return;
    const token = await getStoredToken();
    if (!token) {
      setConnected(false);
      return;
    }
    const queue = files.filter((f) => selected.has(f.id));
    setImporting(true);
    setError('');
    const failures: string[] = [];

    // Sequential, not Promise.all: a folder of twenty bibles fired at once is a good way
    // to be rate-limited by Drive, and the progress line is only meaningful in order.
    for (let i = 0; i < queue.length; i += 1) {
      const file = queue[i];
      setProgress(`Importing ${i + 1} of ${queue.length} — ${file.name}`);
      const { text, error: err } = await fetchFileText(token.accessToken, file);
      if (err === 'AUTH') {
        await clearStoredToken();
        setConnected(false);
        setError('Google access expired partway through. Reconnect and import the rest.');
        break;
      }
      if (err || text === null) {
        failures.push(file.name);
        continue;
      }
      const { error: createError } = await createDocument(projectId, user.id, file.name, docType, text);
      if (createError) failures.push(file.name);
    }

    setImporting(false);
    setProgress('');
    setSelected(new Set());
    if (failures.length > 0) {
      setError(`Could not import: ${failures.join(', ')}`);
    }
    await fetchDocuments(projectId);
  }

  if (connected === null) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.gold} />
      </View>
    );
  }

  if (!connected) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.connectContent}>
        <Icon name="folder" size={34} color={colors.gold} />
        <Text style={styles.connectTitle}>Connect Google Drive</Text>
        <Text style={styles.connectBody}>
          Pick documents out of your Drive and bring them into this project — worldbuilding notes,
          character bibles, timelines — instead of copying them across by hand.
        </Text>
        <Text style={styles.connectBody}>
          StoryMap reads only the files you choose to import, and never writes anything back to Drive.
        </Text>
        {!!error && <Text style={styles.error}>{error}</Text>}
        <Pressable style={styles.primaryBtn} onPress={handleConnect} disabled={connecting}>
          {connecting ? (
            <ActivityIndicator color="#2b1a05" />
          ) : (
            <Text style={styles.primaryBtnText}>Connect Drive</Text>
          )}
        </Pressable>
      </ScrollView>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search your Drive"
          placeholderTextColor={colors.textFaint}
          returnKeyType="search"
          onSubmitEditing={() => setActiveSearch(search)}
        />
        {!!activeSearch && (
          <Pressable
            onPress={() => {
              setSearch('');
              setActiveSearch('');
            }}
            hitSlop={8}
          >
            <Text style={styles.clearSearch}>Clear</Text>
          </Pressable>
        )}
      </View>

      {!activeSearch && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.crumbBar}>
          {crumbs.map((crumb, i) => (
            <Pressable key={crumb.id} onPress={() => goToCrumb(i)} style={styles.crumb}>
              <Text style={[styles.crumbText, i === crumbs.length - 1 && styles.crumbTextActive]}>
                {i > 0 ? '› ' : ''}
                {crumb.name}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      {!!error && <Text style={styles.error}>{error}</Text>}

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.gold} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {files.length === 0 && <Text style={styles.empty}>Nothing here.</Text>}
          {files.map((file) => {
            const isFolder = file.mimeType === FOLDER_MIME;
            const importable = isImportable(file);
            const imported = alreadyImported.has(file.name.toLowerCase());
            const isSelected = selected.has(file.id);
            return (
              <Pressable
                key={file.id}
                style={[styles.row, isSelected && styles.rowSelected]}
                onPress={() => {
                  if (isFolder) openFolder(file);
                  else if (importable && !imported) toggle(file);
                }}
              >
                <Icon
                  name={isFolder ? 'folder' : 'list'}
                  size={17}
                  color={importable || isFolder ? colors.gold : colors.textFaint}
                />
                <View style={styles.rowBody}>
                  <Text style={[styles.rowTitle, !importable && !isFolder && styles.rowTitleMuted]} numberOfLines={1}>
                    {file.name}
                  </Text>
                  {imported && <Text style={styles.rowNote}>Already imported</Text>}
                  {!importable && !isFolder && !imported && <Text style={styles.rowNote}>Not a text document</Text>}
                </View>
                {isFolder ? (
                  <Text style={styles.rowChevron}>›</Text>
                ) : (
                  importable && !imported && (
                    <View style={[styles.checkbox, isSelected && styles.checkboxOn]}>
                      {isSelected && <Text style={styles.checkmark}>✓</Text>}
                    </View>
                  )
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      {selected.size > 0 && (
        <View style={styles.footer}>
          <Text style={styles.footerLabel}>Import as</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.typeRow}>
            {DOCUMENT_TYPES.map((type) => (
              <Pressable
                key={type}
                style={[styles.typeChip, docType === type && styles.typeChipOn]}
                onPress={() => setDocType(type)}
              >
                <Text style={[styles.typeChipText, docType === type && styles.typeChipTextOn]}>
                  {DOCUMENT_TYPE_LABELS[type]}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
          {!!progress && <Text style={styles.progress}>{progress}</Text>}
          <Pressable style={styles.primaryBtn} onPress={handleImport} disabled={importing}>
            {importing ? (
              <ActivityIndicator color="#2b1a05" />
            ) : (
              <Text style={styles.primaryBtnText}>
                Import {selected.size} file{selected.size === 1 ? '' : 's'}
              </Text>
            )}
          </Pressable>
        </View>
      )}

      <Pressable style={styles.disconnect} onPress={handleDisconnect}>
        <Text style={styles.disconnectText}>Disconnect Drive</Text>
      </Pressable>
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
    connectContent: { padding: 28, alignItems: 'center', gap: 14 },
    connectTitle: { color: colors.text, fontFamily: FONTS.heading, fontSize: 20, marginTop: 6 },
    connectBody: { color: colors.textDim, fontSize: 13.5, lineHeight: 21, textAlign: 'center' },
    searchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 14 },
    searchInput: {
      flex: 1,
      backgroundColor: colors.panel,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 9,
      color: colors.text,
      fontSize: 14,
    },
    clearSearch: { color: colors.gold, fontSize: 13 },
    crumbBar: { flexGrow: 0, paddingHorizontal: 16, paddingVertical: 10 },
    crumb: { paddingRight: 4 },
    crumbText: { color: colors.textFaint, fontSize: 12.5 },
    crumbTextActive: { color: colors.text },
    list: { paddingHorizontal: 16, paddingBottom: 24 },
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
    rowSelected: { borderColor: colors.gold, backgroundColor: withOpacity(colors.gold, 0.12) },
    rowBody: { flex: 1 },
    rowTitle: { color: colors.text, fontSize: 14 },
    rowTitleMuted: { color: colors.textFaint },
    rowNote: { color: colors.textFaint, fontSize: 11, marginTop: 2 },
    rowChevron: { color: colors.textFaint, fontSize: 18 },
    checkbox: {
      width: 20,
      height: 20,
      borderRadius: 4,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkboxOn: { backgroundColor: colors.gold, borderColor: colors.gold },
    checkmark: { color: '#2b1a05', fontSize: 13, lineHeight: 17 },
    empty: { color: colors.textFaint, fontSize: 13, textAlign: 'center', marginTop: 40 },
    error: { color: '#e0764a', fontSize: 12.5, paddingHorizontal: 16, paddingTop: 10, lineHeight: 18 },
    footer: {
      borderTopWidth: 1,
      borderTopColor: colors.borderDim,
      padding: 16,
      gap: 10,
      backgroundColor: colors.panel,
    },
    footerLabel: {
      color: colors.textFaint,
      fontFamily: FONTS.mono,
      fontSize: 10,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    typeRow: { gap: 8 },
    typeChip: {
      paddingVertical: 7,
      paddingHorizontal: 12,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    typeChipOn: { borderColor: colors.gold, backgroundColor: withOpacity(colors.gold, 0.14) },
    typeChipText: { color: colors.textDim, fontSize: 12.5 },
    typeChipTextOn: { color: colors.text },
    progress: { color: colors.textDim, fontSize: 12 },
    primaryBtn: {
      backgroundColor: colors.gold,
      borderRadius: 8,
      paddingVertical: 13,
      alignItems: 'center',
      alignSelf: 'stretch',
      marginTop: 4,
    },
    primaryBtnText: { color: '#2b1a05', fontFamily: FONTS.bodySemiBold, fontSize: 14.5 },
    disconnect: { alignItems: 'center', paddingVertical: 14 },
    disconnectText: { color: colors.textFaint, fontSize: 12.5 },
  });
}
