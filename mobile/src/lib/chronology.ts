import type { GraphData } from './characterGraph';
import type { Chapter } from '../store/chapterStore';

// The story's own clock, and what it can catch.
//
// Time is `story_time` on a chapter: a number in whatever unit the saga counts in, sparse by
// design. An unmarked chapter carries forward the time of the last marked chapter before it
// in reading order -- the same rule the braid uses (braidHtml.ts storyKeys), so the two
// never disagree about when a chapter is. A character is born at `properties.born` on their
// graph node, in the same unit.
//
// From that, three things follow deterministically:
//   - each chapter's EFFECTIVE time, and where reading order runs backwards through story
//     time (a flashback -- flagged, not faulted; the writer may mean it);
//   - every character's AGE in every chapter they are present in;
//   - CONTRADICTIONS: a character present before they were born, or a character whose age
//     is impossible (present at two times too far apart for one life).
//
// Presence comes from the graph -- character → event, event ↔ chapter -- so this sees
// exactly what the braid's Characters layer sees. A chapter nobody has been placed in has
// no ages, and no contradictions, which is honest.

export type ChapterTime = {
  chapter: Chapter;
  /** In reading order, 0-based. */
  index: number;
  marked: boolean;
  /** Effective time; -Infinity before any marked chapter. */
  time: number;
  /** Story time runs backwards from the previous chapter: a flashback. */
  flashback: boolean;
};

export type CharacterAge = { characterId: string; name: string; born: number | null; age: number | null };

export type Finding =
  | { kind: 'before-birth'; characterId: string; name: string; chapterId: string; chapterTitle: string; time: number; born: number }
  | { kind: 'flashback'; chapterId: string; chapterTitle: string; from: number; to: number }
  | { kind: 'unplaced'; count: number };

export function chapterTimes(chapters: Chapter[]): ChapterTime[] {
  const reading = [...chapters].sort((a, b) => a.book - b.book || a.act - b.act || a.order - b.order);
  const out: ChapterTime[] = [];
  let carried = -Infinity;
  let prev = -Infinity;
  reading.forEach((c, index) => {
    const t = c.story_time;
    const marked = t !== null && t !== undefined && Number.isFinite(Number(t));
    if (marked) carried = Number(t);
    const flashback = marked && Number.isFinite(prev) && carried < prev;
    out.push({ chapter: c, index, marked, time: carried, flashback });
    prev = carried;
  });
  return out;
}

export function born(node: { properties: Record<string, unknown> } | undefined): number | null {
  const v = node?.properties?.born;
  return typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() && Number.isFinite(Number(v)) ? Number(v) : null;
}

/** Character ids present in a chapter, through its event. */
export function presentIn(graph: GraphData, chapterId: string): string[] {
  const ch = graph.chapters.find((c) => c.id === chapterId);
  if (!ch?.eventId) return [];
  return graph.presence.filter((p) => p.event === ch.eventId).map((p) => p.character);
}

export function agesIn(graph: GraphData, times: ChapterTime[], chapterId: string): CharacterAge[] {
  const t = times.find((x) => x.chapter.id === chapterId);
  if (!t) return [];
  return presentIn(graph, chapterId).map((id) => {
    const node = graph.nodes.find((n) => n.id === id);
    const b = born(node);
    const age = b !== null && Number.isFinite(t.time) ? t.time - b : null;
    return { characterId: id, name: node?.label ?? id, born: b, age };
  });
}

export function findings(graph: GraphData | null, times: ChapterTime[]): Finding[] {
  const out: Finding[] = [];
  for (const t of times) {
    if (t.flashback) {
      const prev = times[t.index - 1];
      out.push({ kind: 'flashback', chapterId: t.chapter.id, chapterTitle: t.chapter.title, from: prev.time, to: t.time });
    }
  }
  if (graph) {
    let unplaced = 0;
    for (const t of times) {
      const present = presentIn(graph, t.chapter.id);
      if (present.length === 0) unplaced += 1;
      if (!Number.isFinite(t.time)) continue;
      for (const id of present) {
        const node = graph.nodes.find((n) => n.id === id);
        const b = born(node);
        if (b !== null && t.time < b) {
          out.push({
            kind: 'before-birth',
            characterId: id,
            name: node?.label ?? id,
            chapterId: t.chapter.id,
            chapterTitle: t.chapter.title,
            time: t.time,
            born: b,
          });
        }
      }
    }
    if (unplaced > 0) out.push({ kind: 'unplaced', count: unplaced });
  }
  return out;
}

export function formatTime(t: number): string {
  if (!Number.isFinite(t)) return '—';
  return Number.isInteger(t) ? String(t) : t.toFixed(2).replace(/\.?0+$/, '');
}
