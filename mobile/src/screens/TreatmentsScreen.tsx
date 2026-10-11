import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import Animated from 'react-native-reanimated';
import { DropProvider, SortableItem, useSortableList } from 'react-native-reanimated-dnd';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import SlidePanel, { EdgeSwipeZone } from '../components/SlidePanel';
import { useSparseReorder } from '../lib/sparseOrder';
import { useSlidePanel } from '../lib/useSlidePanel';
import { useSortablePositions } from '../lib/useSortablePositions';
import type { SignedInStackParamList } from '../navigation/types';
import { useAuthStore } from '../store/authStore';
import { type Treatment, treatmentTitle, useTreatmentStore } from '../store/treatmentStore';
import { FONTS, type ThemeColors, useTheme, withOpacity } from '../theme';

type Props = NativeStackScreenProps<SignedInStackParamList, 'Treatments'>;

// useSortableList requires a fixed row height for its drag arithmetic.
const ITEM_HEIGHT = 62;
// A search result carries a line of the scene under its title.
const RESULT_HEIGHT = 86;
const SNIPPET_PAD = 46;
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

/** Every word of the query, lower-cased; a sketch matches when its title or text has them all. */
function terms(query: string): string[] {
  return query.toLowerCase().split(/\s+/).filter((w) => w.length > 0);
}

/**
 * The stretch of text around the first matching word, markdown marks stripped so it reads, split
 * into plain / matched runs for highlighting.
 */
function snippet(text: string, words: string[]): { text: string; hit: boolean }[] {
  const plain = text.replace(/[*_`#>|]+/g, '').replace(/\s+/g, ' ').trim();
  const lower = plain.toLowerCase();
  let at = -1;
  for (const w of words) {
    const i = lower.indexOf(w);
    if (i !== -1 && (at === -1 || i < at)) at = i;
  }
  if (at === -1) return [{ text: plain.slice(0, 120), hit: false }];
  const start = Math.max(0, at - SNIPPET_PAD);
  const piece = (start > 0 ? '…' : '') + plain.slice(start, at + 140);
  const re = new RegExp(`(${words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
  return piece.split(re).filter(Boolean).map((part) => ({ text: part, hit: words.includes(part.toLowerCase()) }));
}

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
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const { width: winWidth } = useWindowDimensions();
  // The book filters live in a panel from the left (☰, or an edge swipe), as the Reader's
  // contents do -- the chip row took a band of the screen on every visit.
  const menuWidth = Math.min(winWidth * 0.75, 320);
  const menu = useSlidePanel(menuWidth);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(query.trim()), 150);
    return () => clearTimeout(id);
  }, [query]);

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
  const inGroup = useMemo(() => (group ? titled.filter((x) => groupOf(x.title) === group) : titled), [titled, group]);
  // Search runs over the title and the live version's whole text, in memory: the sketches are
  // already loaded, so this is instant and works offline.
  const words = useMemo(() => terms(debounced), [debounced]);
  const searching = words.length > 0;
  const shown = useMemo(() => {
    if (!searching) return inGroup;
    return inGroup.filter((x) => {
      const hay = `${x.title}\n${liveVersion(x.t.id)?.content ?? ''}`.toLowerCase();
      return words.every((w) => hay.includes(w));
    });
  }, [inGroup, searching, words, liveVersion]);

  useEffect(() => {
    navigation.setOptions({
      title: 'Scene Sketches',
      headerRight: () => (
        <Pressable
          hitSlop={10}
          onPress={() => {
            if (arranging) return setArranging(false);
            if (inGroup.length > MAX_ARRANGE) {
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
  }, [navigation, arranging, inGroup.length, styles]);

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
      {!arranging && titled.length > 0 && (
        <View style={styles.searchRow}>
          <Pressable onPress={menu.open} hitSlop={10} style={styles.menuBtn}>
            <Text style={styles.menuGlyph}>☰</Text>
          </Pressable>
          <TextInput
            style={styles.search}
            value={query}
            onChangeText={setQuery}
            placeholder={group ? `Search ${GROUP_LABEL[group] ?? group}…` : 'Search every scene…'}
            placeholderTextColor={colors.textFaint}
            autoCorrect={false}
            returnKeyType="search"
          />
          {query ? (
            <Pressable onPress={() => setQuery('')} hitSlop={10}>
              <Text style={styles.clear}>×</Text>
            </Pressable>
          ) : null}
        </View>
      )}
      {!arranging && (group || searching) ? (
        <Text style={styles.scope}>
          {`${searching ? `${shown.length} found` : `${shown.length} sketches`}${group ? ` in ${GROUP_LABEL[group] ?? group}` : ''}`}
        </Text>
      ) : null}

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
          keyboardShouldPersistTaps="handled"
          getItemLayout={(_, index) => {
            const h = searching ? RESULT_HEIGHT : ITEM_HEIGHT;
            return { length: h, offset: h * index, index };
          }}
          ListEmptyComponent={searching ? <Text style={styles.empty}>{`Nothing matches "${debounced}".`}</Text> : null}
          renderItem={({ item }) => (
            <Pressable style={[styles.row, searching && styles.resultRow]} onPress={() => open(item.t.id)}>
              <View style={styles.rowMain}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {withoutPrefix(item.title)}
                </Text>
                {searching ? (
                  <Text style={styles.snippet} numberOfLines={2}>
                    {snippet(liveVersion(item.t.id)?.content ?? item.title, words).map((r, i) => (
                      <Text key={i} style={r.hit ? styles.hit : undefined}>
                        {r.text}
                      </Text>
                    ))}
                  </Text>
                ) : group === null && groupOf(item.title) !== 'Unsorted' ? (
                  <Text style={styles.rowTag}>{GROUP_LABEL[groupOf(item.title)] ?? groupOf(item.title)}</Text>
                ) : null}
              </View>
            </Pressable>
          )}
        />
      )}

      {!arranging && <EdgeSwipeZone controller={menu} />}
      <SlidePanel controller={menu} width={menuWidth}>
        <ScrollView contentContainerStyle={styles.menuInner}>
          <Text style={styles.menuTitle}>Scene Sketches</Text>
          {[null, ...groups].map((g) => {
            const on = group === g;
            return (
              <Pressable
                key={g ?? 'all'}
                style={[styles.menuRow, on && styles.menuRowOn]}
                onPress={() => {
                  setGroup(g);
                  setArranging(false);
                  menu.close();
                }}
              >
                <Text style={[styles.menuText, on && styles.menuTextOn]}>{g ? GROUP_LABEL[g] ?? g : 'All sketches'}</Text>
                <Text style={styles.menuCount}>{g ? counts.get(g) : titled.length}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </SlidePanel>

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
    resultRow: { height: RESULT_HEIGHT },
    snippet: { color: colors.textDim, fontFamily: FONTS.handBody, fontSize: 14, lineHeight: 18, marginTop: 2 },
    hit: { color: colors.text, backgroundColor: withOpacity(colors.gold, 0.35) },
    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginHorizontal: 12,
      marginTop: 10,
      marginBottom: 4,
      paddingHorizontal: 10,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.panel,
    },
    menuBtn: { paddingVertical: 8, paddingRight: 4 },
    menuGlyph: { color: colors.gold, fontSize: 20 },
    search: { flex: 1, color: colors.text, fontFamily: FONTS.handBody, fontSize: 17, paddingVertical: 9 },
    clear: { color: colors.textFaint, fontSize: 22, paddingHorizontal: 4 },
    scope: { color: colors.textFaint, fontFamily: FONTS.hand, fontSize: 16, paddingHorizontal: 18, paddingVertical: 4 },
    menuInner: { paddingTop: 40, paddingHorizontal: 16, paddingBottom: 40 },
    menuTitle: { color: colors.gold, fontFamily: FONTS.handBold, fontSize: 28, marginBottom: 12 },
    menuRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 10,
      paddingHorizontal: 10,
      borderRadius: 8,
    },
    menuRowOn: { backgroundColor: withOpacity(colors.gold, 0.14) },
    menuText: { color: colors.text, fontFamily: FONTS.hand, fontSize: 21 },
    menuTextOn: { color: colors.gold },
    menuCount: { color: colors.textFaint, fontFamily: FONTS.hand, fontSize: 17 },
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
