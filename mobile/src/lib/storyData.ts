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

// "Chapter N" -- a chapter's 1-based position within its book, spanning every act in
// sequence (matching how a novel numbers its chapters). Not a stored field; the PWA
// doesn't have this concept either (its own editor-title just shows Book/Act, see
// handoff doc), computed fresh from whatever's currently in the store so it stays right
// after a List-view reorder. Used by both the Editor and the chapter drawer.
export function chapterNumberInBook<T extends { id: string; project_id: string; book: number; act: number; order: number }>(
  chapter: T,
  allChapters: T[],
): number | null {
  const inBook = allChapters
    .filter((c) => c.project_id === chapter.project_id && c.book === chapter.book)
    .sort((a, b) => a.act - b.act || a.order - b.order);
  const idx = inBook.findIndex((c) => c.id === chapter.id);
  return idx === -1 ? null : idx + 1;
}

// Matches mark.hl-plant/hl-reveal/hl-note's background colors in the PWA's CSS exactly.
export const ANNOTATION_COLORS: Record<'plant' | 'reveal' | 'note', string> = {
  plant: 'rgba(74,122,58,0.35)',
  reveal: 'rgba(184,84,46,0.35)',
  note: 'rgba(58,106,138,0.35)',
};

export type HighlightSegment = { text: string; type: 'plant' | 'reveal' | 'note' | null; label?: string };

export type SentenceToken = { text: string; start: number; end: number };

// Android's native TextInput drag-to-extend-selection is unreliable enough (longstanding
// RN platform bug, only ever selects a single word on some devices/keyboards -- see
// EditorScreen's comments) that flagging is built on top of this instead: tap a sentence
// to anchor a selection, tap another to extend it, entirely independent of native text
// selection. Chunked by sentence rather than by word -- an earlier per-word version
// wrapped every word in the chapter in its own touchable element, which for a real
// chapter (thousands of words) meant thousands of nodes re-evaluating on every tap and
// blocked the JS thread for seconds (confirmed on real hardware: taps took 10-15s to
// register). Sentences cut that by roughly the average sentence length in words, and are
// a more natural unit for flagging a Plant/Reveal/Note anyway. `[^.!?\n]` stops a chunk
// at a paragraph break even without terminal punctuation (mid-draft prose often has
// none yet); the newline itself lands in the gap between tokens the same way inter-word
// whitespace does, so it's preserved when reconstructing the exact substring.
export function tokenizeSentences(text: string): SentenceToken[] {
  const tokens: SentenceToken[] = [];
  const re = /[^.!?\n]*[.!?]+|[^.!?\n]+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (!m[0].trim()) continue;
    tokens.push({ text: m[0], start: m.index, end: m.index + m[0].length });
  }
  return tokens;
}

// Word-level tokens, same {text,start,end} shape as SentenceToken -- used by
// ReaderScreen's long-press selection (paginate.ts's buildPageSegments is generic over
// either). Computing tokens for a whole chapter is cheap (a regex pass, no rendering);
// what actually caused the 10-15s-per-tap ANR noted above was rendering a touchable
// element per word for an entire CHAPTER. ReaderScreen only ever renders tokens that
// buildPageSegments has already filtered down to the current PAGE (a few hundred words),
// so the render cost stays small even though tokenizeWords itself runs over the full text.
export function tokenizeWords(text: string): SentenceToken[] {
  const tokens: SentenceToken[] = [];
  const re = /\S+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    tokens.push({ text: m[0], start: m.index, end: m.index + m[0].length });
  }
  return tokens;
}

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
