import { memo, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import type { StoryEvent, StoryLink, StoryThread } from '../store/storyboardStore';
import { FONTS } from '../theme';

// The storyboard as an evidence wall (2026-10-11): a cork board, each beat a paper snippet
// pinned up slightly askew, and every thread a length of coloured string running pin to pin
// through the beats that carry it.
//
// The wall is a picture of the ORDER, not a free canvas: snippets snake across the board two to
// a row in the book's order (left to right, then right to left), so a thread's string reads
// forward through the book and a long bare stretch is a thread gone quiet. Nothing new is
// stored -- positions are derived from the order every render, the same way the braid is.
// Rearranging is the list's job (the screen's Rearrange mode); the wall is for seeing.
//
// A snippet no thread passes through gets one red pin. One with threads gets a pin per thread,
// in that thread's colour, spaced along its top edge -- those are the pins the strings tie to.

const MARGIN = 14;
const GAP_X = 18;
const GAP_Y = 54;
const CARD_H = 148;
const TOP = 34;
const PIN = 15;
const PLAIN_PIN = '#b8322a';

const PAPER = '#f3ead6';
const PAPER_NIGHT = '#e4d8bd';
const INK = '#2a2119';
const INK_SOFT = '#4a3d2e';
const INK_FAINT = '#7d6446';

// Deterministic per-id jitter in [-1, 1]: the same snippet is askew the same way every time.
function jitter(id: string, salt: number): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < id.length; i += 1) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return ((h >>> 0) % 2001) / 1000 - 1;
}

type Placed = { event: StoryEvent; index: number; x: number; y: number; rot: number };

function EvidenceWallInner({
  events,
  threads,
  links,
  width,
  night,
  stringing,
  chapterLabel,
  onPress,
}: {
  events: StoryEvent[];
  threads: StoryThread[];
  links: StoryLink[];
  width: number;
  night: boolean;
  stringing: string | null;
  chapterLabel: (id: string | null) => string | null;
  onPress: (event: StoryEvent) => void;
}) {
  const cardW = (width - MARGIN * 2 - GAP_X) / 2;

  const placed: Placed[] = useMemo(
    () =>
      events.map((event, index) => {
        const row = Math.floor(index / 2);
        const leftToRight = row % 2 === 0;
        const col = leftToRight ? index % 2 : 1 - (index % 2);
        return {
          event,
          index,
          x: MARGIN + col * (cardW + GAP_X) + jitter(event.id, 1) * 5,
          y: TOP + row * (CARD_H + GAP_Y) + jitter(event.id, 2) * 8,
          rot: jitter(event.id, 3) * 2.6,
        };
      }),
    [events, cardW],
  );

  // Which threads each snippet carries, in the threads' own order, and where each pin sits.
  const pins = useMemo(() => {
    const byEvent = new Map<string, StoryThread[]>();
    const threadIndex = new Map(threads.map((t, i) => [t.id, i]));
    for (const k of links) {
      const t = threads.find((x) => x.id === k.thread_id);
      if (!t) continue;
      byEvent.set(k.event_id, [...(byEvent.get(k.event_id) ?? []), t]);
    }
    const at = new Map<string, { x: number; y: number; color: string }[]>();
    const point = new Map<string, { x: number; y: number }>(); // `${threadId}:${eventId}`
    for (const p of placed) {
      const carried = (byEvent.get(p.event.id) ?? []).sort((a, b) => (threadIndex.get(a.id) ?? 0) - (threadIndex.get(b.id) ?? 0));
      if (carried.length === 0) {
        at.set(p.event.id, [{ x: p.x + cardW / 2, y: p.y + 6, color: PLAIN_PIN }]);
        continue;
      }
      const list = carried.map((t, i) => {
        const x = p.x + cardW * (0.18 + (0.64 * (i + 0.5)) / carried.length);
        const pt = { x, y: p.y + 6, color: t.color };
        point.set(`${t.id}:${p.event.id}`, pt);
        return pt;
      });
      at.set(p.event.id, list);
    }
    return { at, point };
  }, [placed, links, threads, cardW]);

  // One string per consecutive pair of a thread's beats, sagging under its own weight -- more
  // the further it runs.
  const strings = useMemo(() => {
    const out: { key: string; d: string; color: string; faded: boolean }[] = [];
    for (const t of threads) {
      const members = placed.filter((p) => pins.point.has(`${t.id}:${p.event.id}`));
      for (let i = 0; i + 1 < members.length; i += 1) {
        const a = pins.point.get(`${t.id}:${members[i].event.id}`)!;
        const b = pins.point.get(`${t.id}:${members[i + 1].event.id}`)!;
        const dist = Math.hypot(b.x - a.x, b.y - a.y);
        const sag = 14 + dist * 0.09;
        const d = `M ${a.x} ${a.y} Q ${(a.x + b.x) / 2} ${(a.y + b.y) / 2 + sag} ${b.x} ${b.y}`;
        out.push({ key: `${t.id}:${i}`, d, color: t.color, faded: !!stringing && stringing !== t.id });
      }
    }
    return out;
  }, [threads, placed, pins, stringing]);

  const rows = Math.ceil(events.length / 2);
  const height = Math.max(420, TOP + rows * (CARD_H + GAP_Y) + 60);

  // Cork, flecked. Seeded, so the board does not shimmer between renders.
  const flecks = useMemo(() => {
    const out: { x: number; y: number; r: number; dark: boolean }[] = [];
    const n = Math.round((width * height) / 900);
    let seed = 7;
    const rnd = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    for (let i = 0; i < n; i += 1) out.push({ x: rnd() * width, y: rnd() * height, r: 0.6 + rnd() * 1.6, dark: rnd() > 0.45 });
    return out;
  }, [width, height]);

  const cork = night ? '#7a5634' : '#b0814f';
  const paper = night ? PAPER_NIGHT : PAPER;
  const onThread = (eventId: string) => !!stringing && links.some((k) => k.thread_id === stringing && k.event_id === eventId);
  const stringingColor = threads.find((t) => t.id === stringing)?.color;

  return (
    <View style={{ width, height, backgroundColor: cork }}>
      <Svg width={width} height={height} style={styles.cork} pointerEvents="none">
        {flecks.map((f, i) => (
          <Circle key={i} cx={f.x} cy={f.y} r={f.r} fill={f.dark ? 'rgba(60,35,15,0.28)' : 'rgba(255,235,200,0.16)'} />
        ))}
      </Svg>

      {placed.map((p) => {
        const chapter = chapterLabel(p.event.chapter_id);
        const on = onThread(p.event.id);
        return (
          <Pressable
            key={p.event.id}
            onPress={() => onPress(p.event)}
            style={[
              styles.card,
              {
                left: p.x,
                top: p.y,
                width: cardW,
                height: CARD_H,
                backgroundColor: paper,
                transform: [{ rotate: `${p.rot}deg` }],
                opacity: stringing && !on ? 0.72 : 1,
              },
              on && stringingColor ? { borderColor: stringingColor, borderWidth: 2.5 } : null,
            ]}
          >
            <Text style={styles.number}>{`#${p.index + 1}`}</Text>
            <Text style={styles.title} numberOfLines={2}>
              {p.event.title || 'Untitled'}
            </Text>
            {p.event.summary ? (
              <Text style={styles.summary} numberOfLines={chapter ? 2 : 3}>
                {p.event.summary}
              </Text>
            ) : null}
            {chapter ? (
              <Text style={styles.chapter} numberOfLines={1}>
                {`→ ${chapter}`}
              </Text>
            ) : null}
          </Pressable>
        );
      })}

      {/* Strings above the paper, pins above the strings: the string is tied at the pin. Lifted
          with elevation, because on Android an elevated view (every snippet, for its shadow)
          draws above any un-elevated sibling whatever their order. */}
      <View pointerEvents="none" style={styles.overlay}>
      <Svg width={width} height={height}>
        {strings.map((s) => (
          <Path key={`${s.key}:shadow`} d={s.d} stroke="rgba(0,0,0,0.25)" strokeWidth={3} fill="none" transform="translate(1.5,2.5)" opacity={s.faded ? 0.3 : 1} />
        ))}
        {strings.map((s) => (
          <Path key={s.key} d={s.d} stroke={s.color} strokeWidth={2.4} fill="none" strokeLinecap="round" opacity={s.faded ? 0.3 : 0.95} />
        ))}
        {[...pins.at.values()].flat().map((pin, i) => (
          <Pin key={i} x={pin.x} y={pin.y} color={pin.color} />
        ))}
      </Svg>
      </View>
    </View>
  );
}

/** A drawing pin seen from above: its shadow, the head, and a glint. */
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

export const EvidenceWall = memo(EvidenceWallInner);

const styles = StyleSheet.create({
  cork: { position: 'absolute', top: 0, left: 0 },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, elevation: 20, zIndex: 20 },
  card: {
    position: 'absolute',
    paddingTop: 16,
    paddingHorizontal: 11,
    paddingBottom: 9,
    borderRadius: 2,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 5,
    shadowOffset: { width: 1, height: 3 },
    elevation: 5,
  },
  number: { position: 'absolute', top: 4, right: 8, color: INK_FAINT, fontFamily: FONTS.hand, fontSize: 15 },
  title: { color: INK, fontFamily: FONTS.handBold, fontSize: 23, lineHeight: 25 },
  summary: { color: INK_SOFT, fontFamily: FONTS.handBody, fontSize: 14, lineHeight: 18, marginTop: 3 },
  chapter: { position: 'absolute', left: 11, right: 8, bottom: 7, color: INK_FAINT, fontFamily: FONTS.handBody, fontSize: 12.5 },
});
