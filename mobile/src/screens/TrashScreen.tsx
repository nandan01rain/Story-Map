import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { SignedInStackParamList } from '../navigation/types';
import { useAuthStore } from '../store/authStore';
import {
  type TrashEntry,
  describeTrash,
  isRestorable,
  useTrashStore,
} from '../store/trashStore';
import { FONTS, type ThemeColors, useTheme, withOpacity } from '../theme';

type Props = NativeStackScreenProps<SignedInStackParamList, 'Trash'>;

// Deleting is reversible everywhere in this app (design principle: "destructive actions get
// a confirmation and a trash entry, not a silent permanent delete"). Mobile had the
// principle and not the bin -- every delete was permanent. This is the bin.
export default function TrashScreen({ route, navigation }: Props) {
  const { projectId } = route.params;
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const user = useAuthStore((s) => s.user);
  const { entries, loading, error, fetchTrash, restore, purge, emptyTrash } = useTrashStore();
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    navigation.setOptions({ title: 'Trash' });
  }, [navigation]);

  const load = useCallback(() => {
    fetchTrash(projectId);
  }, [fetchTrash, projectId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleRestore(entry: TrashEntry) {
    if (!user) return;
    setBusy(entry.id);
    setActionError('');
    const { error: err } = await restore(projectId, user.id, entry);
    setBusy(null);
    if (err) setActionError(err);
  }

  function handlePurge(entry: TrashEntry) {
    const { kind, title } = describeTrash(entry);
    // The one genuinely irreversible action in the app, so it asks.
    Alert.alert(
      `Delete permanently?`,
      `${kind} "${title}" cannot be recovered after this.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setBusy(entry.id);
            const { error: err } = await purge(entry.id);
            setBusy(null);
            if (err) setActionError(err);
          },
        },
      ],
    );
  }

  function handleEmpty() {
    Alert.alert(
      'Empty the trash?',
      `${entries.length} item${entries.length === 1 ? '' : 's'} will be gone for good.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Empty',
          style: 'destructive',
          onPress: async () => {
            const { error: err } = await emptyTrash(projectId);
            if (err) setActionError(err);
          },
        },
      ],
    );
  }

  return (
    <View style={styles.screen}>
      {loading && entries.length === 0 && (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.gold} />
        </View>
      )}

      {!!(error || actionError) && <Text style={styles.error}>{error || actionError}</Text>}

      {!loading && entries.length === 0 && (
        <View style={styles.centered}>
          <Text style={styles.empty}>Nothing in the trash.</Text>
          <Text style={styles.emptyHint}>
            Deleted chapters, scenes and documents wait here until you clear them.
          </Text>
        </View>
      )}

      {entries.length > 0 && (
        <ScrollView contentContainerStyle={styles.list}>
          {entries.map((entry) => {
            const { kind, title, detail } = describeTrash(entry);
            const restorable = isRestorable(entry);
            return (
              <View key={entry.id} style={styles.row}>
                <View style={styles.rowBody}>
                  <Text style={styles.kind}>{kind}</Text>
                  <Text style={styles.title} numberOfLines={2}>
                    {title}
                  </Text>
                  <Text style={styles.meta}>
                    {new Date(entry.deleted_at).toLocaleString()}
                    {detail ? ` · ${detail}` : ''}
                  </Text>
                </View>
                <View style={styles.rowActions}>
                  {restorable && (
                    <Pressable
                      onPress={() => handleRestore(entry)}
                      disabled={busy === entry.id}
                      hitSlop={8}
                    >
                      <Text style={styles.restore}>
                        {busy === entry.id ? '…' : 'Restore'}
                      </Text>
                    </Pressable>
                  )}
                  <Pressable onPress={() => handlePurge(entry)} hitSlop={8}>
                    <Text style={styles.delete}>×</Text>
                  </Pressable>
                </View>
              </View>
            );
          })}

          <Pressable style={styles.emptyBtn} onPress={handleEmpty}>
            <Text style={styles.emptyBtnText}>Empty the trash</Text>
          </Pressable>
        </ScrollView>
      )}
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 30 },
    empty: { color: colors.textDim, fontSize: 15 },
    emptyHint: { color: colors.textFaint, fontSize: 12.5, textAlign: 'center', lineHeight: 18 },
    error: { color: colors.error, fontSize: 13, padding: 14, lineHeight: 19 },
    list: { padding: 14, gap: 10, paddingBottom: 40 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      borderWidth: 1,
      borderColor: colors.borderDim,
      borderRadius: 9,
      padding: 13,
      backgroundColor: colors.panel,
    },
    rowBody: { flex: 1, gap: 3 },
    kind: {
      color: colors.textFaint,
      fontFamily: FONTS.mono,
      fontSize: 9.5,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    title: { color: colors.text, fontFamily: FONTS.literary, fontSize: 14.5 },
    meta: { color: colors.textFaint, fontSize: 11 },
    rowActions: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    restore: { color: colors.gold, fontFamily: FONTS.bodySemiBold, fontSize: 13 },
    delete: { color: colors.error, fontSize: 20, paddingHorizontal: 2 },
    emptyBtn: {
      marginTop: 8,
      alignSelf: 'center',
      borderWidth: 1,
      borderColor: withOpacity(colors.error, 0.5),
      borderRadius: 8,
      paddingVertical: 10,
      paddingHorizontal: 18,
    },
    emptyBtnText: { color: colors.error, fontSize: 13 },
  });
}
