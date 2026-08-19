// Ported directly from the PWA (index.html) -- BOOKS/BOOK_TARGETS are hardcoded
// project-wide constants, not stored data; statusColor's palette matches the PWA's
// CSS custom properties (--gray/--gold/--ember/--teal).
export const BOOKS = ['Book One', 'Book Two', 'Book Three', 'Book Four', 'Book Five'];

export const STATUS_COLORS: Record<string, string> = {
  idea: '#6b5d42',
  outline: '#c69a3a',
  drafted: '#b8542e',
  final: '#2f9d8a',
};

export function statusColor(status: string): string {
  return STATUS_COLORS[status] ?? STATUS_COLORS.idea;
}

export function wordCount(text: string | null | undefined): number {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

// Matches mark.hl-plant/hl-reveal/hl-note's background colors in the PWA's CSS exactly.
export const ANNOTATION_COLORS: Record<'plant' | 'reveal' | 'note', string> = {
  plant: 'rgba(74,122,58,0.35)',
  reveal: 'rgba(184,84,46,0.35)',
  note: 'rgba(58,106,138,0.35)',
};

export type HighlightSegment = { text: string; type: 'plant' | 'reveal' | 'note' | null; label?: string };

// Ports renderAnnotatedContent()'s algorithm exactly (index.html): each annotation
// relocates by searching for its exact flagged substring (first occurrence only) rather
// than tracking a fixed offset -- if prose is edited enough to break the match, the
// annotation silently stops rendering inline (not deleted). Overlapping ranges are
// dropped in annotation-array order, same as the original.
export function computeHighlightSegments(
  text: string,
  annotations: { text: string; type: 'plant' | 'reveal' | 'note'; label: string }[],
): HighlightSegment[] {
  if (!annotations || annotations.length === 0) return [{ text, type: null }];

  const ranges: { start: number; end: number; type: 'plant' | 'reveal' | 'note'; label: string }[] = [];
  for (const a of annotations) {
    if (!a.text) continue;
    const idx = text.indexOf(a.text);
    if (idx === -1) continue;
    ranges.push({ start: idx, end: idx + a.text.length, type: a.type, label: a.label });
  }
  ranges.sort((a, b) => a.start - b.start);

  const filtered: typeof ranges = [];
  let lastEnd = -1;
  for (const r of ranges) {
    if (r.start >= lastEnd) {
      filtered.push(r);
      lastEnd = r.end;
    }
  }

  const segments: HighlightSegment[] = [];
  let pos = 0;
  for (const r of filtered) {
    if (r.start > pos) segments.push({ text: text.slice(pos, r.start), type: null });
    segments.push({ text: text.slice(r.start, r.end), type: r.type, label: r.label });
    pos = r.end;
  }
  if (pos < text.length) segments.push({ text: text.slice(pos), type: null });
  return segments;
}
