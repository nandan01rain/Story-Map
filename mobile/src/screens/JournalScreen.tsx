import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { SignedInStackParamList } from '../navigation/types';
import { useAuthStore } from '../store/authStore';
import { type JournalPage, useJournalStore } from '../store/journalStore';
import { FONTS, type ThemeColors, useTheme } from '../theme';

type Props = NativeStackScreenProps<SignedInStackParamList, 'Journal'>;

/** "27 Oct 2026" from yyyy-mm-dd, read as a local date rather than UTC midnight. */
export function journalDay(day: string): string {
  const d = new Date(String(day).slice(0, 10) + 'T00:00:00');
  return isNaN(d.getTime()) ? String(day) : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

// The writing journal: the writer's diary of making the saga (2026-10-27), the same pages as the
// studio's Journal tab. Newest first. Two ways in: start a page here, or scan pages from the paper
// notebook -- which keeps each one as written, mirror script and all.
export default function JournalScreen({ route, navigation }: Props) {
  const { projectId } = route.params;
  const user = useAuthStore((s) => s.user);
  const { pages, loading, missing, error, fetch, create } = useJournalStore();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const unsub = navigation.addListener('focus', () => fetch(projectId));
    fetch(projectId);
    return unsub;
  }, [navigation, projectId, fetch]);

  const newest = useMemo(() => [...pages].reverse(), [pages]);

  async function startPage() {
    if (!user || busy) return;
    setBusy(true);
    const { page, error: e } = await create({ projectId, userId: user.id });
    setBusy(false);
    if (e || !page) return Alert.alert('Page not started', e ?? 'Try again.');
    navigation.navigate('JournalPage', { projectId, pageId: page.id });
  }

  if (missing) {
    return (
      <View style={styles.screen}>
        <Text style={styles.empty}>
          The journal needs supabase/migrations/20261027_journal.sql pasted into the Supabase SQL editor once.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <FlatList
        data={newest}
        keyExtractor={(p) => p.id}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.rule} />}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color={colors.gold} style={{ marginTop: 40 }} />
          ) : (
            <Text style={styles.empty}>{error ?? 'No pages yet. Start one, or scan pages from your notebook.'}</Text>
          )
        }
        renderItem={({ item }) => (
          <Row page={item} styles={styles} onPress={() => navigation.navigate('JournalPage', { projectId, pageId: item.id })} />
        )}
      />
      <View style={[styles.actions, { paddingBottom: insets.bottom + 14 }]}>
        <Pressable style={[styles.action, styles.actionGold]} onPress={() => navigation.navigate('JournalScan', { projectId })}>
          <Text style={[styles.actionText, styles.actionGoldText]}>Scan pages</Text>
        </Pressable>
        <Pressable style={styles.action} onPress={startPage} disabled={busy}>
          <Text style={styles.actionText}>{busy ? 'Starting…' : '+ New page'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Row({ page, styles, onPress }: { page: JournalPage; styles: Styles; onPress: () => void }) {
  const n = page.items.length;
  const what = page.scan_path ? (n ? `scanned · ${n} added` : 'scanned') : `${n} thing${n === 1 ? '' : 's'} on it`;
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <Text style={styles.rowTitle} numberOfLines={1}>{page.title || journalDay(page.day)}</Text>
      <Text style={styles.rowDate}>{page.title ? `${journalDay(page.day)} · ${what}` : what}</Text>
    </Pressable>
  );
}

type Styles = ReturnType<typeof makeStyles>;

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg },
    list: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 30 },
    rule: { height: 1, backgroundColor: colors.borderDim },
    row: { paddingVertical: 14 },
    rowTitle: { color: colors.text, fontFamily: FONTS.handBold, fontSize: 25, lineHeight: 29 },
    rowDate: { color: colors.textFaint, fontFamily: FONTS.handBody, fontSize: 15, marginTop: 2 },
    empty: {
      color: colors.textFaint,
      fontFamily: FONTS.literaryItalic,
      fontStyle: 'italic',
      fontSize: 14,
      textAlign: 'center',
      marginTop: 60,
      marginHorizontal: 30,
      lineHeight: 22,
    },
    actions: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.borderDim },
    action: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
    actionGold: { backgroundColor: colors.gold, borderColor: colors.gold },
    actionText: { color: colors.text, fontFamily: FONTS.bodySemiBold, fontSize: 15.5 },
    actionGoldText: { color: '#2b1a05' },
  });
}
