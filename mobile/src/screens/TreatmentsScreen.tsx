import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { DropProvider, SortableItem, useSortableList } from 'react-native-reanimated-dnd';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useSparseReorder } from '../lib/sparseOrder';
import { useSortablePositions } from '../lib/useSortablePositions';
import type { SignedInStackParamList } from '../navigation/types';
import { useAuthStore } from '../store/authStore';
import { type Treatment, treatmentTitle, useTreatmentStore } from '../store/treatmentStore';
import { FONTS, type ThemeColors, useTheme, withOpacity } from '../theme';

type Props = NativeStackScreenProps<SignedInStackParamList, 'Treatments'>;

// useSortableList requires a fixed row height for its drag arithmetic.
const ITEM_HEIGHT = 62;
// Above this, a group is too long for the drag list (which lays out every row absolutely and
// renders all of them), so Rearrange asks for a smaller group first.
const MAX_ARRANGE = 120;

// Scene sketches, in saga order (`position`), never by date.
//
// BROWSING is a virtualised FlatList (2026-10-11). It used to be the drag list itself, and at
// 300 sketches that failed twice over: every row is absolutely positioned from a value read
// once at mount, so rows that mounted before their positions were seeded all sat at the top
// -- three hundred titles overprinted into one black scribble -- and the list had
// scrollEnabled={false}, so even placed correctly nothing past the first screen was reachable.
//
// REARRANGING is a mode (header), within one group at a time, where the drag list is the right
// tool and the group is small enough for it.
//
// Groups come from the title's prefix -- "B1 · …", "Backstory · …" -- which the drafted-scene
// load wrote (handoff §43). A sketch with no prefix is in "Unsorted". Nothing is stored for a
// group: it is the title.
const GROUP_ORDER = ['Unsorted', 'Backstory', 'Prologue', 'B1', 'B2', 'Skip', 'B3', 'B4', 'B5', 'B6', 'After', 'Unplaced'];
const GROUP_LABEL: Record<string, string> = {
  Unsorted: 'Unsorted',
  Backstory: 'Backstory',
  Prologue: 'Prologue',
  B1: 'Book One',
  B2: 'Book Two',
  Skip: 'The skip',
  B3: 'Book Three',
  B4: 'Book Four',
  B5: 'Book Five',
  B6: 'Book Six',
  After: 'After the war',
  Unplaced: 'Unplaced',
};
const PREFIX = /^(Backstory|Prologue|B\d+|Skip|After|Unplaced) · /;

function groupOf(title: string): string {
  return PREFIX.exec(title)?.[1] ?? 'Unsorted';
}
function withoutPrefix(title: string): string {
  return title.replace(PREFIX, '');
}

export default function TreatmentsScreen({ route, navigation }: Props) {
  const { projectId } = route.params;
  const user = useAuthStore((s) => s.user);
  const { treatments, loading, missingSchema, fetchTreatments, createTreatment, reorder, liveVersion } =
    useTreatmentStore();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [creating, setCreating] = useState(false);
  const [group, setGroup] = useState<string | null>(null);
  const [arranging, setArranging] = useState(false);

  useEffect(() => {
    const unsub = navigation.addListener('focus', () => fetchTreatments(projectId));
    fetchTreatments(projectId);
    return unsub;
  }, [navigation, projectId, fetchTreatments]);

  const sorted = useMemo(() => [...treatments].sort((a, b) => Number(a.position) - Number(b.position)), [treatments]);
  const titled = useMemo(
    () => sorted.map((t) => ({ t, title: treatmentTitle(t, liveVersion(t.id)) || 'Untitled scene' })),
    [sorted, liveVersion],
  );
  const counts = useMemo(() => {
    const c = new Map<string, number>();
    for (const x of titled) c.set(groupOf(x.title), (c.get(groupOf(x.title)) ?? 0) + 1);
    return c;
  }, [titled]);
  const shown = useMemo(() => (group ? titled.filter((x) => groupOf(x.title) === group) : titled), [titled, group]);

  useEffect(() => {
    navigation.setOptions({
      title: 'Scene Sketches',
      headerRight: () => (
        <Pressable
          hitSlop={10}
          onPress={() => {
            if (arranging) return setArranging(false);
            if (shown.length > MAX_ARRANGE) {
              Alert.alert('Pick a group first', 'Choose a book above, then rearrange the sketches inside it.');
              return;
            }
            setArranging(true);
          }}
        >
          <Text style={styles.headerToggle}>{arranging ? 'Done' : 'Rearrange'}</Text>
        </Pressable>
      ),
    });
  }, [navigation, arranging, shown.length, styles]);

  async function handleAdd() {
    if (!user || creating) return;
    setCreating(true);
    const { treatment } = await createTreatment(user.id, projectId);
    setCreating(false);
    if (treatment) navigation.navigate('Treatment', { projectId, treatmentId: treatment.id });
  }

  const open = (id: string) => navigation.navigate('Treatment', { projectId, treatmentId: id });

  if (missingSchema) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <Text style={styles.note}>
          This project's database predates 20260830b_treatments.sql. Run it in the Supabase SQL
          editor and scene sketches will appear here.
        </Text>
      </View>
    );
  }

  const groups = GROUP_ORDER.filter((g) => counts.get(g));

  return (
    <View style={styles.screen}>
      {groups.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll} contentContainerStyle={styles.chipRow}>
          <Pressable style={[styles.chip, group === null && styles.chipOn]} onPress={() => { setGroup(null); setArranging(false); }}>
            <Text style={[styles.chipText, group === null && styles.chipTextOn]}>{`All ${titled.length}`}</Text>
          </Pressable>
          {groups.map((g) => (
            <Pressable key={g} style={[styles.chip, group === g && styles.chipOn]} onPress={() => { setGroup(g); setArranging(false); }}>
              <Text style={[styles.chipText, group === g && styles.chipTextOn]}>{`${GROUP_LABEL[g] ?? g} ${counts.get(g)}`}</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      {titled.length === 0 ? (
        <View style={styles.centered}>
          {loading ? (
            <ActivityIndicator color={colors.gold} />
          ) : (
            <Text style={styles.empty}>
              No scene sketches yet. A sketch is one scene described: everything that happens in
              it, before the dialogue exists.
            </Text>
          )}
        </View>
      ) : arranging ? (
        <ArrangeList
          key={group ?? 'all'}
          items={shown.map((x) => x.t)}
          titleOf={(t) => withoutPrefix(titled.find((x) => x.t.id === t.id)?.title ?? '')}
          reorder={reorder}
          styles={styles}
        />
      ) : (
        <FlatList
          data={shown}
          keyExtractor={(x) => x.t.id}
          contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
          initialNumToRender={20}
          windowSize={11}
          getItemLayout={(_, index) => ({ length: ITEM_HEIGHT, offset: ITEM_HEIGHT * index, index })}
          renderItem={({ item }) => (
            <Pressable style={styles.row} onPress={() => open(item.t.id)}>
              <View style={styles.rowMain}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {withoutPrefix(item.title)}
                </Text>
                {group === null && groupOf(item.title) !== 'Unsorted' ? (
                  <Text style={styles.rowTag}>{GROUP_LABEL[groupOf(item.title)] ?? groupOf(item.title)}</Text>
                ) : null}
              </View>
            </Pressable>
          )}
        />
      )}

      {!arranging && (
        <Pressable style={[styles.newBtn, { bottom: insets.bottom + 24 }]} onPress={handleAdd} disabled={creating}>
          <Text style={styles.newBtnText}>✎</Text>
        </Pressable>
      )}
    </View>
  );
}

// The drag list, for one group. Keyed by group at the call site, so switching groups mounts a
// fresh list whose rows read positions that are already seeded.
function ArrangeList({
  items: source,
  titleOf,
  reorder,
  styles,
}: {
  items: Treatment[];
  titleOf: (t: Treatment) => string;
  reorder: (id: string, position: number) => Promise<{ error: string | null }>;
  styles: ReturnType<typeof makeStyles>;
}) {
  const { items, handleMove, handleDrop } = useSparseReorder(source, reorder);
  const { positions, scrollViewRef, dropProviderRef, handleScroll, handleScrollEnd, contentHeight, getItemProps } =
    useSortableList({ data: items, itemHeight: ITEM_HEIGHT });
  const listKey = useSortablePositions(items, positions);

  return (
    <DropProvider key={listKey} ref={dropProviderRef}>
      <Animated.ScrollView
        ref={scrollViewRef}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ height: contentHeight + 80 }}
        onScrollEndDrag={handleScrollEnd}
        onMomentumScrollEnd={handleScrollEnd}
      >
        {items.map((item, index) => (
          <SortableItem key={item.id} data={item} {...getItemProps(item, index)} onMove={handleMove} onDrop={() => handleDrop(item.id)}>
            <View style={styles.row}>
              <SortableItem.Handle style={styles.handle}>
                <Text style={styles.handleText}>⠿</Text>
              </SortableItem.Handle>
              <Text style={[styles.rowTitle, { flex: 1 }]} numberOfLines={1}>
                {titleOf(item)}
              </Text>
            </View>
          </SortableItem>
        ))}
      </Animated.ScrollView>
    </DropProvider>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 },
    note: { color: colors.error, fontFamily: FONTS.body, fontSize: 13, lineHeight: 20, textAlign: 'center' },
    empty: { color: colors.textFaint, fontFamily: FONTS.handBody, fontSize: 17, lineHeight: 24, textAlign: 'center' },
    headerToggle: { color: colors.gold, fontFamily: FONTS.hand, fontSize: 20 },
    // flexGrow 0: a horizontal ScrollView in a column otherwise stretches its chips (§36.3).
    chipScroll: { flexGrow: 0, flexShrink: 0 },
    chipRow: { gap: 8, paddingHorizontal: 14, paddingVertical: 10, alignItems: 'center' },
    chip: { paddingVertical: 4, paddingHorizontal: 11, borderRadius: 14, borderWidth: 1, borderColor: colors.borderDim },
    chipOn: { borderColor: colors.gold, backgroundColor: withOpacity(colors.gold, 0.12) },
    chipText: { color: colors.textDim, fontFamily: FONTS.hand, fontSize: 18 },
    chipTextOn: { color: colors.gold },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      height: ITEM_HEIGHT,
      borderBottomWidth: 1,
      borderColor: colors.borderDim,
      backgroundColor: colors.bg,
    },
    handle: { paddingHorizontal: 8, paddingVertical: 10 },
    handleText: { color: colors.textFaint, fontSize: 17 },
    rowMain: { flex: 1, justifyContent: 'center', minWidth: 0 },
    rowTitle: { color: colors.text, fontFamily: FONTS.handBold, fontSize: 21, lineHeight: 25 },
    rowTag: { color: colors.textFaint, fontFamily: FONTS.hand, fontSize: 14, lineHeight: 16 },
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
