import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useMemo } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { SignedInStackParamList } from '../navigation/types';
import { pageTitle, usePageStore, type Page } from '../store/pageStore';
import { FONTS, type ThemeColors, useTheme } from '../theme';

type Props = NativeStackScreenProps<SignedInStackParamList, 'Pages'>;

// The stack. This replaces the old Margin board, and the change of shape is the point: a
// grid of tilted cards was right for one-line jottings and wrong for a four-thousand-word
// scene, which is now the same kind of thing living in the same table.
//
// Reverse chronological, first line as the de facto title, a date, nothing else. No status
// badges, no type chips, no unreviewed counts, no totals. Every one of those would turn a
// pile of pages into a queue with work outstanding in it, and a queue is a thing you avoid
// opening. Nothing here nags.
//
// Nothing here deletes, either. There is no swipe-to-delete and no × on a row -- a page is
// kept, and if the writer wants one gone it is a deliberate act taken inside the page.
export default function PagesScreen({ route, navigation }: Props) {
  const { projectId } = route.params;
  const { pages, loading, fetchPages } = usePageStore();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  useEffect(() => {
    navigation.setOptions({ title: 'Pages' });
  }, [navigation]);

  // Refetch on every focus: a page written on the phone and a page written in the PWA are
  // the same row, and this list is the one place both are supposed to show up.
  useEffect(() => {
    const unsub = navigation.addListener('focus', () => fetchPages(projectId));
    fetchPages(projectId);
    return unsub;
  }, [navigation, projectId, fetchPages]);

  const sorted = useMemo(
    () =>
      [...pages].sort(
        (a, b) => Date.parse(b.updated_at ?? b.created_at) - Date.parse(a.updated_at ?? a.created_at),
      ),
    [pages],
  );

  return (
    <View style={styles.screen}>
      <FlatList
        data={sorted}
        keyExtractor={(p) => p.id}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.rule} />}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color={colors.gold} style={{ marginTop: 40 }} />
          ) : (
            <Text style={styles.empty}>Nothing here yet. Tap the pen and write something down.</Text>
          )
        }
        renderItem={({ item }) => (
          <PageRow
            page={item}
            styles={styles}
            onPress={() => navigation.navigate('Page', { projectId, pageId: item.id })}
          />
        )}
      />

      <Pressable
        style={[styles.newBtn, { bottom: insets.bottom + 24 }]}
        onPress={() => navigation.navigate('Page', { projectId })}
      >
        <Text style={styles.newBtnText}>✎</Text>
      </Pressable>
    </View>
  );
}

function PageRow({ page, styles, onPress }: { page: Page; styles: Styles; onPress: () => void }) {
  const title = pageTitle(page);
  const when = new Date(page.updated_at ?? page.created_at);
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <Text style={[styles.rowTitle, !title && styles.rowTitleEmpty]} numberOfLines={1}>
        {title || 'Blank page'}
      </Text>
      <Text style={styles.rowDate}>{formatWhen(when)}</Text>
    </Pressable>
  );
}

/** Today and yesterday by name, this year without it -- a date, not a timestamp. */
function formatWhen(d: Date): string {
  const now = new Date();
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (sameDay(d, now)) return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (sameDay(d, yesterday)) return 'Yesterday';
  if (d.getFullYear() === now.getFullYear()) return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  return d.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
}

type Styles = ReturnType<typeof makeStyles>;

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg },
    list: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 110 },
    rule: { height: 1, backgroundColor: colors.borderDim },
    row: { paddingVertical: 16 },
    rowTitle: { color: colors.text, fontFamily: FONTS.literary, fontSize: 16.5, lineHeight: 24 },
    rowTitleEmpty: { color: colors.textFaint, fontFamily: FONTS.literaryItalic, fontStyle: 'italic' },
    rowDate: { color: colors.textFaint, fontFamily: FONTS.mono, fontSize: 10.5, marginTop: 5 },
    empty: {
      color: colors.textFaint,
      fontFamily: FONTS.literaryItalic,
      fontStyle: 'italic',
      fontSize: 14,
      textAlign: 'center',
      marginTop: 60,
      lineHeight: 22,
    },
    newBtn: {
      position: 'absolute',
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
    newBtnText: { color: '#2b1a05', fontSize: 24, lineHeight: 28 },
  });
}
