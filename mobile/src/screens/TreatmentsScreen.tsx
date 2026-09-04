import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { DropProvider, SortableItem, useSortableList } from 'react-native-reanimated-dnd';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useSortablePositions } from '../lib/useSortablePositions';
import type { SignedInStackParamList } from '../navigation/types';
import { useAuthStore } from '../store/authStore';
import { positionBetween, treatmentTitle, useTreatmentStore, type Treatment } from '../store/treatmentStore';
import { FONTS, type ThemeColors, useTheme } from '../theme';

type Props = NativeStackScreenProps<SignedInStackParamList, 'Treatments'>;

// useSortableList requires a fixed row height for its drag arithmetic, the same constraint
// the chapter list works under.
const ITEM_HEIGHT = 62;

// The treatments list. Ordered by `position`, saga-wide, NOT by date -- because ordering
// loose scenes is the actual work this layer exists for, and the order churns constantly
// while the material is still loose.
//
// Each row carries a title and nothing else. No status chips, no version counts, no dates.
// A count of anything unread or unresolved is the thing that turns a surface into a queue,
// and a queue is what the writer stops opening.
export default function TreatmentsScreen({ route, navigation }: Props) {
  const { projectId } = route.params;
  const user = useAuthStore((s) => s.user);
  const { treatments, loading, missingSchema, fetchTreatments, createTreatment, reorder, liveVersion } =
    useTreatmentStore();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    navigation.setOptions({ title: 'Treatments' });
  }, [navigation]);

  useEffect(() => {
    const unsub = navigation.addListener('focus', () => fetchTreatments(projectId));
    fetchTreatments(projectId);
    return unsub;
  }, [navigation, projectId, fetchTreatments]);

  // Local, because the drag reorders it live and the drop then reads the settled order --
  // the same contract ChapterListScreen works under. A useMemo off the store would be reset
  // under the drag by every store update.
  const [items, setItems] = useState<Treatment[]>([]);
  useEffect(() => {
    setItems([...treatments].sort((a, b) => Number(a.position) - Number(b.position)));
  }, [treatments]);

  const handleMove = useCallback((id: string, from: number, to: number) => {
    setItems((prev) => {
      const idx = prev.findIndex((t) => t.id === id);
      if (idx === -1 || from === to) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }, []);

  // Sparse positions earn their keep here: the dropped row takes a value strictly between
  // its settled neighbours, so ONE row is written rather than the whole list renumbered.
  // numeric rather than int is what guarantees a value always exists between them.
  const handleDrop = useCallback(
    (id: string) => {
      const idx = items.findIndex((t) => t.id === id);
      if (idx === -1) return;
      const before = idx > 0 ? items[idx - 1] : null;
      const after = idx < items.length - 1 ? items[idx + 1] : null;
      const next = positionBetween(
        before ? Number(before.position) : null,
        after ? Number(after.position) : null,
      );
      if (next !== Number(items[idx].position)) reorder(id, next);
    },
    [items, reorder],
  );

  const { positions, scrollViewRef, dropProviderRef, handleScroll, handleScrollEnd, contentHeight, getItemProps } =
    useSortableList({ data: items, itemHeight: ITEM_HEIGHT });
  // Treatments arrive from a fetch after this mounts, and creating one changes the set --
  // both are the stacked-rows hazard useSortablePositions exists for.
  const listKey = useSortablePositions(items, positions);

  async function handleAdd() {
    if (!user || creating) return;
    setCreating(true);
    const { treatment } = await createTreatment(user.id, projectId);
    setCreating(false);
    if (treatment) navigation.navigate('Treatment', { projectId, treatmentId: treatment.id });
  }

  if (missingSchema) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <Text style={styles.note}>
          This project's database predates 20260830b_treatments.sql. Run it in the Supabase SQL
          editor and treatments will appear here.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {items.length === 0 ? (
        <View style={styles.centered}>
          {loading ? (
            <ActivityIndicator color={colors.gold} />
          ) : (
            <Text style={styles.empty}>
              Nothing yet. A treatment is one scene described — what happens in it, before the
              dialogue exists.
            </Text>
          )}
        </View>
      ) : (
        <DropProvider key={listKey} ref={dropProviderRef}>
          <Animated.ScrollView
            ref={scrollViewRef}
            scrollEnabled={false}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            contentContainerStyle={{ height: contentHeight }}
            onScrollEndDrag={handleScrollEnd}
            onMomentumScrollEnd={handleScrollEnd}
          >
            {items.map((item, index) => (
              <SortableItem
                key={item.id}
                data={item}
                {...getItemProps(item, index)}
                onMove={handleMove}
                onDrop={() => handleDrop(item.id)}
              >
                <View style={{ height: ITEM_HEIGHT }}>
                  <View style={styles.row}>
                    <SortableItem.Handle style={styles.handle}>
                      <Text style={styles.handleText}>⠿</Text>
                    </SortableItem.Handle>
                    <Pressable
                      style={styles.rowMain}
                      onPress={() => navigation.navigate('Treatment', { projectId, treatmentId: item.id })}
                    >
                      <Text style={styles.rowTitle} numberOfLines={1}>
                        {treatmentTitle(item, liveVersion(item.id)) || 'Untitled scene'}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              </SortableItem>
            ))}
          </Animated.ScrollView>
        </DropProvider>
      )}

      <Pressable style={[styles.newBtn, { bottom: insets.bottom + 24 }]} onPress={handleAdd} disabled={creating}>
        <Text style={styles.newBtnText}>✎</Text>
      </Pressable>
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 },
    note: { color: colors.error, fontFamily: FONTS.body, fontSize: 13, lineHeight: 20, textAlign: 'center' },
    empty: {
      color: colors.textFaint,
      fontFamily: FONTS.literaryItalic,
      fontStyle: 'italic',
      fontSize: 14,
      lineHeight: 22,
      textAlign: 'center',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      height: ITEM_HEIGHT,
      borderBottomWidth: 1,
      borderColor: colors.borderDim,
    },
    handle: { paddingHorizontal: 8, paddingVertical: 10 },
    handleText: { color: colors.textFaint, fontSize: 17 },
    rowMain: { flex: 1, justifyContent: 'center', minWidth: 0 },
    rowTitle: { color: colors.text, fontFamily: FONTS.literary, fontSize: 16, lineHeight: 22 },
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
