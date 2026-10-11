import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';

import { NOTE_DEFAULT, type StoryCast, type StoryEvent, type StoryLink, type StoryThread } from '../store/storyboardStore';
import { FONTS } from '../theme';

// The storyboard wall (2026-10-11, second form): a cork board the writer arranges by hand.
//
// Each beat is a sticky note in its character's colour (the cast), pinned up slightly askew.
// LONG-PRESS a note and drag it anywhere; it stays where it is dropped (x/y on the event). A
// short tap opens it -- the full scene, when the note summarises a scene sketch -- and the ✎
// corner opens the note itself. Threads are coloured string running pin to pin through the
// notes that carry them, in BOOK ORDER (the note's number), wherever the notes hang -- so a
// string can cross the board, the way it does on a real one. The order is still changed in
// Rearrange; where a note hangs and when its beat happens are separate things.
//
// A note never moved has no x/y and is laid out in book order, three to a row, like a pinboard
// of index cards before anyone has started arranging it.

export const NOTE_W = 152;
export const NOTE_H = 138;
const MARGIN = 18;
const GAP_X = 22;
const GAP_Y = 46;
const TOP = 30;
const COLUMNS = 3;
const PIN = 15;
const PLAIN_PIN = '#b8322a';
const EDIT_ZONE = 34;

const INK = '#2a2119';
const INK_SOFT = '#45392b';
const INK_FAINT = '#7a6248';

function jitter(id: string, salt: number): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < id.length; i += 1) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return ((h >>> 0) % 2001) / 1000 - 1;
}

/** Where an unmoved note hangs: book order, three to a row. */
function autoPlace(index: number, id: string) {
  const row = Math.floor(index / COLUMNS);
  const col = index % COLUMNS;
  return {
    x: MARGIN + col * (NOTE_W + GAP_X) + jitter(id, 1) * 5,
    y: TOP + row * (NOTE_H + GAP_Y) + jitter(id, 2) * 7,
  };
}

export const AUTO_WIDTH = MARGIN * 2 + COLUMNS * NOTE_W + (COLUMNS - 1) * GAP_X;

type Spot = { x: number; y: number };

function EvidenceWallInner({
  events,
  threads,
  links,
  cast,
  minWidth,
  minHeight,
  night,
  stringing,
  canMove,
  chapterLabel,
  onOpen,
  onEdit,
  onMoved,
}: {
  events: StoryEvent[];
  threads: StoryThread[];
  links: StoryLink[];
  cast: StoryCast[];
  minWidth: number;
  minHeight: number;
  night: boolean;
  stringing: string | null;
  canMove: boolean;
  chapterLabel: (id: string | null) => string | null;
  onOpen: (event: StoryEvent) => void;
  onEdit: (event: StoryEvent) => void;
  onMoved: (event: StoryEvent, x: number, y: number) => void;
}) {
  // Where a note being dragged is right now, so its strings follow the finger.
  const [dragging, setDragging] = useState<{ id: string; x: number; y: number } | null>(null);

  const spots = useMemo(() => {
    const m = new Map<string, Spot>();
    events.forEach((e, i) => {
      m.set(e.id, e.x != null && e.y != null ? { x: e.x, y: e.y } : autoPlace(i, e.id));
    });
    return m;
  }, [events]);
  const spotOf = useCallback(
    (id: string): Spot => (dragging && dragging.id === id ? dragging : spots.get(id) ?? { x: 0, y: 0 }),
    [dragging, spots],
  );

  const width = Math.max(minWidth, AUTO_WIDTH, ...[...spots.values()].map((s) => s.x + NOTE_W + MARGIN));
  const height = Math.max(minHeight, ...[...spots.values()].map((s) => s.y + NOTE_H + 160));

  // Pins: one red pin on a note no thread passes through; one per thread, in its colour, along
  // the top edge of a note that carries threads. Strings tie to those.
  const threadsOf = useMemo(() => {
    const order = new Map(threads.map((t, i) => [t.id, i]));
    const m = new Map<string, StoryThread[]>();
    for (const k of links) {
      const t = threads.find((x) => x.id === k.thread_id);
      if (t) m.set(k.event_id, [...(m.get(k.event_id) ?? []), t]);
    }
    for (const list of m.values()) list.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
    return m;
  }, [links, threads]);

  const pinPoint = useCallback(
    (eventId: string, threadId: string | null) => {
      const s = spotOf(eventId);
      const carried = threadsOf.get(eventId) ?? [];
      if (!threadId || carried.length === 0) return { x: s.x + NOTE_W / 2, y: s.y + 7 };
      const i = Math.max(0, carried.findIndex((t) => t.id === threadId));
      return { x: s.x + NOTE_W * (0.2 + (0.6 * (i + 0.5)) / carried.length), y: s.y + 7 };
    },
    [spotOf, threadsOf],
  );

  const strings = useMemo(() => {
    const out: { key: string; d: string; color: string; faded: boolean }[] = [];
    for (const t of threads) {
      const members = events.filter((e) => (threadsOf.get(e.id) ?? []).some((x) => x.id === t.id));
      for (let i = 0; i + 1 < members.length; i += 1) {
        const a = pinPoint(members[i].id, t.id);
        const b = pinPoint(members[i + 1].id, t.id);
        const sag = 12 + Math.hypot(b.x - a.x, b.y - a.y) * 0.08;
        out.push({
          key: `${t.id}:${i}`,
          d: `M ${a.x} ${a.y} Q ${(a.x + b.x) / 2} ${(a.y + b.y) / 2 + sag} ${b.x} ${b.y}`,
          color: t.color,
          faded: !!stringing && stringing !== t.id,
        });
      }
    }
    return out;
  }, [threads, events, threadsOf, pinPoint, stringing]);

  const pins = useMemo(() => {
    const out: { key: string; x: number; y: number; color: string }[] = [];
    for (const e of events) {
      const carried = threadsOf.get(e.id) ?? [];
      if (carried.length === 0) out.push({ key: e.id, ...pinPoint(e.id, null), color: PLAIN_PIN });
      else for (const t of carried) out.push({ key: `${e.id}:${t.id}`, ...pinPoint(e.id, t.id), color: t.color });
    }
    return out;
  }, [events, threadsOf, pinPoint]);

  const flecks = useMemo(() => {
    const out: { x: number; y: number; r: number; dark: boolean }[] = [];
    let seed = 7;
    const rnd = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    const n = Math.round((width * height) / 900);
    for (let i = 0; i < n; i += 1) out.push({ x: rnd() * width, y: rnd() * height, r: 0.6 + rnd() * 1.6, dark: rnd() > 0.45 });
    return out;
  }, [width, height]);

  const castOf = useMemo(() => new Map(cast.map((c) => [c.id, c])), [cast]);
  const onThread = (id: string) => !!stringing && links.some((k) => k.thread_id === stringing && k.event_id === id);
  const stringingColor = threads.find((t) => t.id === stringing)?.color ?? null;

  return (
    <View style={{ width, height, backgroundColor: night ? '#7a5634' : '#b0814f' }}>
      <Svg width={width} height={height} style={styles.layer} pointerEvents="none">
        {flecks.map((f, i) => (
          <Circle key={i} cx={f.x} cy={f.y} r={f.r} fill={f.dark ? 'rgba(60,35,15,0.28)' : 'rgba(255,235,200,0.16)'} />
        ))}
      </Svg>

      {events.map((e, i) => {
        const s = spots.get(e.id)!;
        const member = e.cast_id ? castOf.get(e.cast_id) : undefined;
        return (
          <Note
            key={e.id}
            event={e}
            number={i + 1}
            x={s.x}
            y={s.y}
            rot={jitter(e.id, 3) * 2.4}
            color={member?.color ?? NOTE_DEFAULT}
            who={member?.name ?? null}
            chapter={chapterLabel(e.chapter_id)}
            faded={!!stringing && !onThread(e.id)}
            ring={onThread(e.id) ? stringingColor : null}
            canMove={canMove && !stringing}
            onOpen={onOpen}
            onEdit={onEdit}
            onDrag={setDragging}
            onDrop={(x, y) => {
              setDragging(null);
              onMoved(e, x, y);
            }}
          />
        );
      })}

      {/* Strings over the paper, pins over the strings. Elevated, because on Android an
          elevated view (every note, for its shadow) draws above any sibling that is not. */}
      <View pointerEvents="none" style={styles.overlay}>
        <Svg width={width} height={height}>
          {strings.map((s) => (
            <Path key={`${s.key}:sh`} d={s.d} stroke="rgba(0,0,0,0.25)" strokeWidth={3} fill="none" transform="translate(1.5,2.5)" opacity={s.faded ? 0.3 : 1} />
          ))}
          {strings.map((s) => (
            <Path key={s.key} d={s.d} stroke={s.color} strokeWidth={2.4} fill="none" strokeLinecap="round" opacity={s.faded ? 0.3 : 0.95} />
          ))}
          {pins.map((p) => (
            <Pin key={p.key} x={p.x} y={p.y} color={p.color} />
          ))}
        </Svg>
      </View>
    </View>
  );
}

function Pin({ x, y, color }: { x: number; y: number; color: string }) {
  const r = PIN / 2;
  return (
    <>
      <Circle cx={x + 2} cy={y + 3} r={r} fill="rgba(0,0,0,0.3)" />
      <Circle cx={x} cy={y} r={r} fill={color} />
      <Circle cx={x} cy={y} r={r} fill="none" stroke="rgba(0,0,0,0.25)" strokeWidth={1} />
      <Circle cx={x - r * 0.35} cy={y - r * 0.35} r={r * 0.32} fill="rgba(255,255,255,0.55)" />
    </>
  );
}

/**
 * One sticky note. Its position lives in shared values so a drag runs on the UI thread and a
 * drop does not jump: the drop folds the translation into the base position BEFORE telling the
 * screen, so when the saved x/y comes back as props it is already where the note is.
 */
function Note({
  event,
  number,
  x,
  y,
  rot,
  color,
  who,
  chapter,
  faded,
  ring,
  canMove,
  onOpen,
  onEdit,
  onDrag,
  onDrop,
}: {
  event: StoryEvent;
  number: number;
  x: number;
  y: number;
  rot: number;
  color: string;
  who: string | null;
  chapter: string | null;
  faded: boolean;
  ring: string | null;
  canMove: boolean;
  onOpen: (event: StoryEvent) => void;
  onEdit: (event: StoryEvent) => void;
  onDrag: (d: { id: string; x: number; y: number }) => void;
  onDrop: (x: number, y: number) => void;
}) {
  const baseX = useSharedValue(x);
  const baseY = useSharedValue(y);
  const dx = useSharedValue(0);
  const dy = useSharedValue(0);
  const lift = useSharedValue(0);

  useEffect(() => {
    baseX.value = x;
    baseY.value = y;
  }, [x, y, baseX, baseY]);

  const open = useCallback(() => onOpen(event), [onOpen, event]);
  const edit = useCallback(() => onEdit(event), [onEdit, event]);
  const report = useCallback((nx: number, ny: number) => onDrag({ id: event.id, x: nx, y: ny }), [onDrag, event.id]);

  const pan = Gesture.Pan()
    .enabled(canMove)
    .activateAfterLongPress(260)
    .onStart(() => {
      lift.value = withSpring(1);
    })
    .onUpdate((e) => {
      dx.value = e.translationX;
      dy.value = e.translationY;
      runOnJS(report)(baseX.value + e.translationX, baseY.value + e.translationY);
    })
    .onEnd(() => {
      const nx = Math.max(0, baseX.value + dx.value);
      const ny = Math.max(0, baseY.value + dy.value);
      baseX.value = nx;
      baseY.value = ny;
      dx.value = 0;
      dy.value = 0;
      lift.value = withSpring(0);
      runOnJS(onDrop)(nx, ny);
    });

  // The ✎ corner edits the note; anywhere else opens it.
  const tap = Gesture.Tap().onEnd((e) => {
    if (e.x > NOTE_W - EDIT_ZONE && e.y > NOTE_H - EDIT_ZONE) runOnJS(edit)();
    else runOnJS(open)();
  });

  const style = useAnimatedStyle(() => ({
    left: baseX.value + dx.value,
    top: baseY.value + dy.value,
    zIndex: lift.value > 0.01 ? 50 : 1,
    elevation: 5 + lift.value * 10,
    transform: [{ rotate: `${rot * (1 - lift.value)}deg` }, { scale: 1 + lift.value * 0.06 }],
  }));

  return (
    <GestureDetector gesture={Gesture.Exclusive(pan, tap)}>
      <Animated.View
        style={[
          styles.note,
          { backgroundColor: color, opacity: faded ? 0.6 : 1 },
          ring ? { borderColor: ring, borderWidth: 2.5 } : null,
          style,
        ]}
      >
        <View style={styles.noteHead}>
          <Text style={styles.who} numberOfLines={1}>
            {who ?? ''}
          </Text>
          <Text style={styles.number}>{`#${number}`}</Text>
        </View>
        <Text style={styles.title} numberOfLines={2}>
          {event.title || 'Untitled'}
        </Text>
        {event.summary ? (
          <Text style={styles.summary} numberOfLines={chapter || event.treatment_id ? 2 : 3}>
            {event.summary}
          </Text>
        ) : null}
        <Text style={styles.foot} numberOfLines={1}>
          {event.treatment_id ? '↗ full scene' : chapter ? `→ ${chapter}` : ''}
        </Text>
        <Text style={styles.edit}>✎</Text>
      </Animated.View>
    </GestureDetector>
  );
}

export const EvidenceWall = memo(EvidenceWallInner);

const styles = StyleSheet.create({
  layer: { position: 'absolute', top: 0, left: 0 },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, elevation: 30, zIndex: 30 },
  note: {
    position: 'absolute',
    width: NOTE_W,
    height: NOTE_H,
    paddingTop: 15,
    paddingHorizontal: 10,
    paddingBottom: 8,
    borderRadius: 2,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 5,
    shadowOffset: { width: 1, height: 3 },
  },
  noteHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  who: { flex: 1, color: INK_FAINT, fontFamily: FONTS.hand, fontSize: 15 },
  number: { color: INK_FAINT, fontFamily: FONTS.hand, fontSize: 15, marginLeft: 6 },
  title: { color: INK, fontFamily: FONTS.handBold, fontSize: 22, lineHeight: 24 },
  summary: { color: INK_SOFT, fontFamily: FONTS.handBody, fontSize: 13.5, lineHeight: 17, marginTop: 2 },
  foot: { position: 'absolute', left: 10, right: EDIT_ZONE, bottom: 7, color: INK_FAINT, fontFamily: FONTS.handBody, fontSize: 12.5 },
  edit: { position: 'absolute', right: 8, bottom: 5, color: INK_FAINT, fontSize: 16 },
});
