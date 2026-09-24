import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { DropProvider, SortableItem, useSortableList } from 'react-native-reanimated-dnd';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { bookIndices, bookName, chapterNumberInBook } from '../lib/storyData';
import { useSortablePositions } from '../lib/useSortablePositions';
import type { SignedInStackParamList } from '../navigation/types';
import { useAuthStore } from '../store/authStore';
import { useChapterStore } from '../store/chapterStore';
import { THREAD_COLORS, useStoryboardStore, type StoryEvent, type StoryThread } from '../store/storyboardStore';
import { positionBetween } from '../store/treatmentStore';
import { useTrashStore } from '../store/trashStore';
import { FONTS, type ThemeColors, useTheme, withOpacity } from '../theme';

type Props = NativeStackScreenProps<SignedInStackParamList, 'Storyboard'>;

// Fixed, because useSortableList does its drag arithmetic from one row height -- and because
// the thread lanes are drawn per row, a fixed height is also what lets a lane's segments meet
// the next row's exactly.
const ITEM_HEIGHT = 92;
const LANE_MAX = 14;
const LANES_MAX_WIDTH = 96;
const DOT = 10;

// One book's chain of events, with threads strung through them. See
// supabase/migrations/20260924_storyboard.sql.
//
// The chain runs down the screen in the book's order; drag the handle to move an event. Each
// thread is a coloured lane on the left: a dot where it passes through an event, a line
// between its first and last, and nothing outside them -- so a thread that goes quiet for
// twelve events shows as twelve rows of bare line, which is the thing worth seeing.
//
// To string a thread, tap its chip: the board enters stringing mode and every tap on an event
// puts it on the thread or takes it off. Tap the chip again (or Done) to stop. Long-press a
// chip to rename, recolour or remove it.
//
// Sheets are plain overlays rather than native Modals: adding or deleting an event changes
// the sortable list's id set and remounts it, which a Modal over it does not survive (§36.3).
export default function StoryboardScreen({ route, navigation }: Props) {
  const { projectId } = route.params;
  const user = useAuthStore((s) => s.user);
  const chapters = useChapterStore((s) => s.chapters);
  const fetchChapters = useChapterStore((s) => s.fetchChapters);
  const { events, threads, links, loading, supported, error, fetch, addEvent, updateEvent, removeEvent, addThread, updateThread, removeThread, toggleLink } =
    useStoryboardStore();
  const trashStoryEvent = useTrashStore((s) => s.trashStoryEvent);
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [book, setBook] = useState(route.params.book ?? 0);
  const [stringing, setStringing] = useState<string | null>(null);
  const [eventSheet, setEventSheet] = useState<{ id: string | null } | null>(null);
  const [threadSheet, setThreadSheet] = useState<{ id: string | null } | null>(null);

  useEffect(() => {
    navigation.setOptions({ title: 'Storyboard' });
  }, [navigation]);

  useEffect(() => {
    const unsub = navigation.addListener('focus', () => fetch(projectId));
    fetch(projectId);
    if (!chapters.some((c) => c.project_id === projectId)) void fetchChapters(projectId);
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation, projectId]);

  const projectChapters = useMemo(
    () => chapters.filter((c) => c.project_id === projectId).sort((a, b) => a.book - b.book || a.act - b.act || a.order - b.order),
    [chapters, projectId],
  );
  // Every book the chapters reach, plus any a storyboard was started in ahead of its prose.
  const books = useMemo(() => {
    const set = new Set(bookIndices(projectChapters));
    for (const e of events) set.add(e.book);
    return [...set].sort((a, b) => a - b);
  }, [projectChapters, events]);
  const bookChapters = useMemo(() => projectChapters.filter((c) => c.book === book), [projectChapters, book]);
  const bookThreads = useMemo(() => threads.filter((t) => t.book === book), [threads, book]);

  useEffect(() => setStringing(null), [book]);

  // Local, because the drag reorders it live and the drop then reads the settled order -- the
  // same contract TreatmentsScreen works under.
  const [items, setItems] = useState<StoryEvent[]>([]);
  useEffect(() => {
    setItems(events.filter((e) => e.book === book));
  }, [events, book]);

  const handleMove = useCallback((id: string, from: number, to: number) => {
    setItems((prev) => {
      if (from === to || !prev.some((e) => e.id === id)) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }, []);

  const handleDrop = useCallback(
    (id: string) => {
      const idx = items.findIndex((e) => e.id === id);
      if (idx === -1) return;
      const before = idx > 0 ? items[idx - 1] : null;
      const after = idx < items.length - 1 ? items[idx + 1] : null;
      const next = positionBetween(before ? before.position : null, after ? after.position : null);
      if (next !== items[idx].position) void updateEvent(id, { position: next });
    },
    [items, updateEvent],
  );

  const { positions, scrollViewRef, dropProviderRef, handleScroll, handleScrollEnd, contentHeight, getItemProps } =
    useSortableList({ data: items, itemHeight: ITEM_HEIGHT });
  const listKey = useSortablePositions(items, positions);

  // For each thread in this book: which rows it touches, and the span between its first and
  // last. Recomputed from `items`, so the lanes follow a drag as it happens.
  const lanes = useMemo(() => {
    const rowOf = new Map(items.map((e, i) => [e.id, i]));
    return bookThreads.map((t) => {
      const rows = new Set<number>();
      for (const k of links) if (k.thread_id === t.id && rowOf.has(k.event_id)) rows.add(rowOf.get(k.event_id)!);
      const sorted = [...rows].sort((a, b) => a - b);
      return { thread: t, rows, first: sorted[0] ?? -1, last: sorted[sorted.length - 1] ?? -1 };
    });
  }, [bookThreads, links, items]);
  const laneWidth = bookThreads.length ? Math.min(LANE_MAX, LANES_MAX_WIDTH / bookThreads.length) : 0;

  function chapterLabel(id: string | null): string | null {
    if (!id) return null;
    const ch = projectChapters.find((c) => c.id === id);
    if (!ch) return null;
    const n = chapterNumberInBook(ch, projectChapters);
    return `Ch ${n ?? '?'} · ${ch.title}`;
  }

  function onEventPress(e: StoryEvent) {
    if (stringing && user) {
      void toggleLink({ projectId, userId: user.id, threadId: stringing, eventId: e.id }).then(({ error: err }) => {
        if (err) Alert.alert('Not saved', err);
      });
      return;
    }
    setEventSheet({ id: e.id });
  }

  const stringingThread = bookThreads.find((t) => t.id === stringing) ?? null;

  if (!supported) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <Text style={styles.note}>
          The storyboard needs its tables: paste supabase/migrations/20260924_storyboard.sql into the
          Supabase SQL editor once, then come back.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.strip} contentContainerStyle={styles.stripContent}>
        {books.map((b) => (
          <Pressable key={b} onPress={() => setBook(b)} style={[styles.bookChip, b === book && styles.bookChipOn]}>
            <Text style={[styles.bookChipText, b === book && styles.bookChipTextOn]}>{bookName(b)}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.strip} contentContainerStyle={styles.stripContent}>
        {bookThreads.map((t) => {
          const on = t.id === stringing;
          return (
            <Pressable
              key={t.id}
              onPress={() => setStringing(on ? null : t.id)}
              onLongPress={() => setThreadSheet({ id: t.id })}
              style={[styles.threadChip, { borderColor: on ? t.color : colors.borderDim }, on && { backgroundColor: withOpacity(t.color, 0.16) }]}
            >
              <View style={[styles.swatch, { backgroundColor: t.color }]} />
              <Text style={[styles.threadChipText, on && { color: colors.text }]} numberOfLines={1}>
                {t.name || 'Unnamed thread'}
              </Text>
            </Pressable>
          );
        })}
        <Pressable onPress={() => setThreadSheet({ id: null })} style={styles.addChip}>
          <Text style={styles.addChipText}>+ Thread</Text>
        </Pressable>
      </ScrollView>

      {stringingThread && (
        <View style={[styles.banner, { borderColor: stringingThread.color }]}>
          <View style={[styles.swatch, { backgroundColor: stringingThread.color }]} />
          <Text style={styles.bannerText} numberOfLines={2}>
            Stringing <Text style={{ color: colors.text }}>{stringingThread.name || 'this thread'}</Text> — tap events to add or remove them.
          </Text>
          <Pressable onPress={() => setStringing(null)} hitSlop={10}>
            <Text style={styles.bannerDone}>Done</Text>
          </Pressable>
        </View>
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {items.length === 0 ? (
        <View style={styles.centered}>
          {loading ? (
            <ActivityIndicator color={colors.gold} />
          ) : (
            <Text style={styles.empty}>
              {`No events in ${bookName(book)} yet. An event is one beat of the plot — add them in the order the book tells them, then string threads through the ones that carry each.`}
            </Text>
          )}
        </View>
      ) : (
        <DropProvider key={`${book}:${listKey}`} ref={dropProviderRef}>
          <Animated.ScrollView
            ref={scrollViewRef}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            contentContainerStyle={{ height: contentHeight + insets.bottom + 100 }}
            onScrollEndDrag={handleScrollEnd}
            onMomentumScrollEnd={handleScrollEnd}
          >
            {items.map((item, index) => {
              const chapter = chapterLabel(item.chapter_id);
              const onThread = stringing ? links.some((k) => k.thread_id === stringing && k.event_id === item.id) : false;
              return (
                <SortableItem
                  key={item.id}
                  data={item}
                  {...getItemProps(item, index)}
                  onMove={handleMove}
                  onDrop={() => handleDrop(item.id)}
                >
                  <View style={styles.row}>
                    {laneWidth > 0 && (
                      <View style={[styles.lanes, { width: laneWidth * bookThreads.length }]}>
                        {lanes.map(({ thread, rows, first, last }) => (
                          <Lane
                            key={thread.id}
                            width={laneWidth}
                            color={thread.color}
                            up={first >= 0 && first < index && index <= last}
                            down={first >= 0 && first <= index && index < last}
                            dot={rows.has(index)}
                          />
                        ))}
                      </View>
                    )}
                    <SortableItem.Handle style={styles.handle}>
                      <Text style={styles.handleText}>⠿</Text>
                    </SortableItem.Handle>
                    <Pressable
                      style={[
                        styles.card,
                        stringingThread && { borderColor: onThread ? stringingThread.color : colors.borderDim },
                        onThread && stringingThread && { backgroundColor: withOpacity(stringingThread.color, 0.12) },
                      ]}
                      onPress={() => onEventPress(item)}
                    >
                      <View style={styles.cardHead}>
                        <Text style={styles.ordinal}>{index + 1}</Text>
                        <Text style={styles.cardTitle} numberOfLines={1}>
                          {item.title || 'Untitled event'}
                        </Text>
                      </View>
                      {item.summary ? (
                        <Text style={styles.cardSummary} numberOfLines={chapter ? 1 : 2}>
                          {item.summary}
                        </Text>
                      ) : null}
                      {chapter ? (
                        <Text style={styles.cardChapter} numberOfLines={1}>
                          {chapter}
                        </Text>
                      ) : null}
                    </Pressable>
                  </View>
                </SortableItem>
              );
            })}
          </Animated.ScrollView>
        </DropProvider>
      )}

      {!stringing && (
        <Pressable style={[styles.newBtn, { bottom: insets.bottom + 24 }]} onPress={() => setEventSheet({ id: null })}>
          <Text style={styles.newBtnText}>+</Text>
        </Pressable>
      )}

      {eventSheet && user && (
        <EventSheet
          key={eventSheet.id ?? 'new'}
          event={eventSheet.id ? events.find((e) => e.id === eventSheet.id) ?? null : null}
          chapters={bookChapters}
          chapterLabel={chapterLabel}
          threads={bookThreads}
          links={links}
          colors={colors}
          styles={styles}
          onClose={() => setEventSheet(null)}
          onSave={async (draft) => {
            const res = eventSheet.id
              ? await updateEvent(eventSheet.id, { title: draft.title, summary: draft.summary, chapter_id: draft.chapterId })
              : await addEvent({ projectId, userId: user.id, book, title: draft.title, summary: draft.summary, chapterId: draft.chapterId });
            if (res.error) Alert.alert('Not saved', res.error);
            else setEventSheet(null);
          }}
          onToggleThread={(threadId) => {
            if (!eventSheet.id) return;
            void toggleLink({ projectId, userId: user.id, threadId, eventId: eventSheet.id }).then(({ error: err }) => {
              if (err) Alert.alert('Not saved', err);
            });
          }}
          onOpenChapter={(chapterId) => {
            setEventSheet(null);
            navigation.navigate('Editor', { chapterId });
          }}
          onDelete={(e) => {
            Alert.alert('Delete this event?', 'It goes to Trash and can be restored from there.', [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                  // Sheet first: the list remounts when the event leaves it.
                  setEventSheet(null);
                  const threadIds = links.filter((k) => k.event_id === e.id).map((k) => k.thread_id);
                  const trashed = await trashStoryEvent(projectId, user.id, e, threadIds);
                  if (trashed.error) {
                    Alert.alert('Not deleted', trashed.error);
                    return;
                  }
                  const res = await removeEvent(e.id);
                  if (res.error) Alert.alert('Not deleted', res.error);
                },
              },
            ]);
          }}
        />
      )}

      {threadSheet && user && (
        <ThreadSheet
          key={threadSheet.id ?? 'new'}
          thread={threadSheet.id ? threads.find((t) => t.id === threadSheet.id) ?? null : null}
          colors={colors}
          styles={styles}
          onClose={() => setThreadSheet(null)}
          onSave={async (draft) => {
            if (threadSheet.id) {
              const res = await updateThread(threadSheet.id, draft.color ? { name: draft.name, color: draft.color } : { name: draft.name });
              if (res.error) Alert.alert('Not saved', res.error);
              else setThreadSheet(null);
              return;
            }
            const res = await addThread({ projectId, userId: user.id, book, name: draft.name });
            if (res.error || !res.thread) {
              Alert.alert('Not saved', res.error ?? 'Unknown error');
              return;
            }
            if (draft.color && draft.color !== res.thread.color) await updateThread(res.thread.id, { color: draft.color });
            setThreadSheet(null);
            // A new thread exists to be strung, so start stringing it.
            setStringing(res.thread.id);
          }}
          onDelete={(t) => {
            Alert.alert(`Remove "${t.name || 'this thread'}"?`, 'Its events stay where they are; only the thread through them goes.', [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Remove',
                style: 'destructive',
                onPress: async () => {
                  setThreadSheet(null);
                  if (stringing === t.id) setStringing(null);
                  const res = await removeThread(t.id);
                  if (res.error) Alert.alert('Not removed', res.error);
                },
              },
            ]);
          }}
        />
      )}
    </View>
  );
}

function Lane({ width, color, up, down, dot }: { width: number; color: string; up: boolean; down: boolean; dot: boolean }) {
  const line = { position: 'absolute' as const, left: width / 2 - 1, width: 2, backgroundColor: color, opacity: 0.8 };
  const size = Math.min(DOT, width - 2);
  return (
    <View style={{ width, height: ITEM_HEIGHT }}>
      {up && <View style={[line, { top: 0, height: ITEM_HEIGHT / 2 }]} />}
      {down && <View style={[line, { top: ITEM_HEIGHT / 2, height: ITEM_HEIGHT / 2 }]} />}
      {dot && (
        <View
          style={{
            position: 'absolute',
            top: ITEM_HEIGHT / 2 - size / 2,
            left: width / 2 - size / 2,
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: color,
          }}
        />
      )}
    </View>
  );
}

type Styles = ReturnType<typeof makeStyles>;

function EventSheet({
  event,
  chapters,
  chapterLabel,
  threads,
  links,
  colors,
  styles,
  onClose,
  onSave,
  onToggleThread,
  onOpenChapter,
  onDelete,
}: {
  event: StoryEvent | null;
  chapters: { id: string; title: string }[];
  chapterLabel: (id: string | null) => string | null;
  threads: StoryThread[];
  links: { thread_id: string; event_id: string }[];
  colors: ThemeColors;
  styles: Styles;
  onClose: () => void;
  onSave: (draft: { title: string; summary: string; chapterId: string | null }) => void;
  onToggleThread: (threadId: string) => void;
  onOpenChapter: (chapterId: string) => void;
  onDelete: (event: StoryEvent) => void;
}) {
  const [title, setTitle] = useState(event?.title ?? '');
  const [summary, setSummary] = useState(event?.summary ?? '');
  const [chapterId, setChapterId] = useState<string | null>(event?.chapter_id ?? null);

  return (
    <View style={styles.backdrop}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <ScrollView style={styles.sheet} contentContainerStyle={styles.sheetContent} keyboardShouldPersistTaps="handled">
        <Text style={styles.sheetLabel}>{event ? 'EVENT' : 'NEW EVENT'}</Text>
        <TextInput
          style={styles.titleInput}
          value={title}
          onChangeText={setTitle}
          placeholder="What happens"
          placeholderTextColor={colors.textFaint}
          autoFocus={!event}
        />
        <TextInput
          style={styles.summaryInput}
          value={summary}
          onChangeText={setSummary}
          multiline
          placeholder="More, if it needs it…"
          placeholderTextColor={colors.textFaint}
        />

        <Text style={styles.sheetLabel}>BECAME</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroller} contentContainerStyle={styles.chips}>
          <Pressable onPress={() => setChapterId(null)} style={[styles.chip, chapterId === null && styles.chipOn]}>
            <Text style={[styles.chipText, chapterId === null && styles.chipTextOn]}>no chapter yet</Text>
          </Pressable>
          {chapters.map((c) => (
            <Pressable key={c.id} onPress={() => setChapterId(c.id)} style={[styles.chip, chapterId === c.id && styles.chipOn]}>
              <Text style={[styles.chipText, chapterId === c.id && styles.chipTextOn]} numberOfLines={1}>
                {chapterLabel(c.id) ?? c.title}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {event && threads.length > 0 && (
          <>
            <Text style={styles.sheetLabel}>THREADS</Text>
            <View style={styles.wrapChips}>
              {threads.map((t) => {
                const on = links.some((k) => k.thread_id === t.id && k.event_id === event.id);
                return (
                  <Pressable
                    key={t.id}
                    onPress={() => onToggleThread(t.id)}
                    style={[styles.threadChip, { borderColor: on ? t.color : colors.borderDim }, on && { backgroundColor: withOpacity(t.color, 0.16) }]}
                  >
                    <View style={[styles.swatch, { backgroundColor: t.color }]} />
                    <Text style={[styles.threadChipText, on && { color: colors.text }]} numberOfLines={1}>
                      {t.name || 'Unnamed thread'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}

        <View style={styles.actions}>
          {event && (
            <Pressable onPress={() => onDelete(event)} hitSlop={8}>
              <Text style={styles.danger}>Delete</Text>
            </Pressable>
          )}
          {event?.chapter_id && (
            <Pressable onPress={() => onOpenChapter(event.chapter_id!)} hitSlop={8}>
              <Text style={styles.link}>Open chapter</Text>
            </Pressable>
          )}
          <View style={{ flex: 1 }} />
          <Pressable onPress={onClose} hitSlop={8}>
            <Text style={styles.cancel}>Cancel</Text>
          </Pressable>
          <Pressable onPress={() => onSave({ title: title.trim(), summary: summary.trim(), chapterId })} hitSlop={8}>
            <Text style={styles.confirm}>Save</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

function ThreadSheet({
  thread,
  colors,
  styles,
  onClose,
  onSave,
  onDelete,
}: {
  thread: StoryThread | null;
  colors: ThemeColors;
  styles: Styles;
  onClose: () => void;
  onSave: (draft: { name: string; color: string | null }) => void;
  onDelete: (thread: StoryThread) => void;
}) {
  const [name, setName] = useState(thread?.name ?? '');
  const [color, setColor] = useState(thread?.color ?? THREAD_COLORS[0]);
  // A new thread takes the store's next unused colour unless one is picked here.
  const [picked, setPicked] = useState(!!thread);

  return (
    <View style={styles.backdrop}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={[styles.sheet, styles.sheetContent]}>
        <Text style={styles.sheetLabel}>{thread ? 'THREAD' : 'NEW THREAD'}</Text>
        <TextInput
          style={styles.titleInput}
          value={name}
          onChangeText={setName}
          placeholder="A subplot, an arc, a mystery…"
          placeholderTextColor={colors.textFaint}
          autoFocus={!thread}
        />
        <View style={styles.swatches}>
          {THREAD_COLORS.map((c) => (
            <Pressable
              key={c}
              onPress={() => {
                setColor(c);
                setPicked(true);
              }}
              style={[styles.bigSwatch, { backgroundColor: c }, picked && c === color && { borderColor: colors.text }]}
            />
          ))}
        </View>
        <View style={styles.actions}>
          {thread && (
            <Pressable onPress={() => onDelete(thread)} hitSlop={8}>
              <Text style={styles.danger}>Remove thread</Text>
            </Pressable>
          )}
          <View style={{ flex: 1 }} />
          <Pressable onPress={onClose} hitSlop={8}>
            <Text style={styles.cancel}>Cancel</Text>
          </Pressable>
          <Pressable
            onPress={() => onSave({ name: name.trim(), color: picked ? color : null })}
            hitSlop={8}
          >
            <Text style={styles.confirm}>{thread ? 'Save' : 'Start stringing'}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 },
    note: { color: colors.error, fontFamily: FONTS.body, fontSize: 13, lineHeight: 20, textAlign: 'center' },
    error: { color: colors.error, fontFamily: FONTS.body, fontSize: 12, paddingHorizontal: 16, paddingBottom: 4 },
    empty: {
      color: colors.textFaint,
      fontFamily: FONTS.literaryItalic,
      fontStyle: 'italic',
      fontSize: 14,
      lineHeight: 22,
      textAlign: 'center',
    },
    // flexGrow 0: a horizontal ScrollView in a column otherwise takes the flex space (§36.3).
    strip: { flexGrow: 0 },
    stripContent: { gap: 8, paddingHorizontal: 14, paddingVertical: 8, alignItems: 'center' },
    bookChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, borderWidth: 1, borderColor: colors.borderDim },
    bookChipOn: { borderColor: colors.gold, backgroundColor: withOpacity(colors.gold, 0.12) },
    bookChipText: { color: colors.textDim, fontFamily: FONTS.heading, fontSize: 12, letterSpacing: 1 },
    bookChipTextOn: { color: colors.gold },
    threadChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 12,
      borderWidth: 1,
      maxWidth: 180,
    },
    threadChipText: { color: colors.textDim, fontFamily: FONTS.body, fontSize: 13 },
    swatch: { width: 10, height: 10, borderRadius: 5 },
    addChip: { paddingHorizontal: 10, paddingVertical: 5 },
    addChipText: { color: colors.gold, fontFamily: FONTS.body, fontSize: 13 },
    banner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginHorizontal: 14,
      marginBottom: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderWidth: 1,
      borderRadius: 10,
      backgroundColor: colors.panel,
    },
    bannerText: { flex: 1, color: colors.textDim, fontFamily: FONTS.body, fontSize: 13, lineHeight: 18 },
    bannerDone: { color: colors.gold, fontFamily: FONTS.bodySemiBold, fontSize: 14 },
    row: { flexDirection: 'row', alignItems: 'center', height: ITEM_HEIGHT, paddingLeft: 10, paddingRight: 14 },
    lanes: { flexDirection: 'row', height: ITEM_HEIGHT },
    handle: { paddingHorizontal: 6, paddingVertical: 10 },
    handleText: { color: colors.textFaint, fontSize: 17 },
    card: {
      flex: 1,
      minWidth: 0,
      height: ITEM_HEIGHT - 12,
      justifyContent: 'center',
      paddingHorizontal: 12,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.borderDim,
      backgroundColor: colors.panel,
    },
    cardHead: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
    ordinal: { color: colors.gold, fontFamily: FONTS.mono, fontSize: 11 },
    cardTitle: { flex: 1, color: colors.text, fontFamily: FONTS.literaryMedium, fontSize: 15.5 },
    cardSummary: { color: colors.textDim, fontFamily: FONTS.body, fontSize: 13, lineHeight: 18, marginTop: 2 },
    cardChapter: { color: colors.textFaint, fontFamily: FONTS.mono, fontSize: 10.5, marginTop: 3 },
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
    newBtnText: { color: '#2b1a05', fontSize: 28, lineHeight: 32 },
    // Anchored to the top so the keyboard, which rises from the bottom, never covers it.
    backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)', paddingTop: 12, paddingHorizontal: 12 },
    sheet: {
      flexGrow: 0,
      maxHeight: '75%',
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.panel,
    },
    sheetContent: { padding: 16, gap: 8 },
    sheetLabel: { color: colors.gold, fontFamily: FONTS.heading, fontSize: 10.5, letterSpacing: 2, marginTop: 4 },
    titleInput: {
      color: colors.text,
      fontFamily: FONTS.literaryMedium,
      fontSize: 18,
      paddingVertical: 6,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderDim,
    },
    summaryInput: {
      color: colors.text,
      fontFamily: FONTS.body,
      fontSize: 15,
      lineHeight: 22,
      minHeight: 70,
      textAlignVertical: 'top',
      padding: 0,
    },
    chipScroller: { flexGrow: 0 },
    chips: { gap: 6, paddingVertical: 4, alignItems: 'center' },
    wrapChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    chip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, borderWidth: 1, borderColor: colors.borderDim, maxWidth: 220 },
    chipOn: { borderColor: colors.gold, backgroundColor: withOpacity(colors.gold, 0.1) },
    chipText: { color: colors.textDim, fontFamily: FONTS.body, fontSize: 12 },
    chipTextOn: { color: colors.gold },
    swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingVertical: 6 },
    bigSwatch: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: 'transparent' },
    actions: { flexDirection: 'row', alignItems: 'center', gap: 18, marginTop: 10 },
    cancel: { color: colors.textFaint, fontFamily: FONTS.body, fontSize: 14 },
    confirm: { color: colors.gold, fontFamily: FONTS.bodySemiBold, fontSize: 14 },
    link: { color: colors.gold, fontFamily: FONTS.body, fontSize: 13 },
    danger: { color: colors.error, fontFamily: FONTS.body, fontSize: 13 },
  });
}
