// Ported directly from the PWA (index.html) -- statusColor's palette matches the PWA's CSS
// custom properties (--gray/--gold/--ember/--teal).
//
// BOOKS IS NOT A LIMIT ANY MORE (2026-09-21). A book was never a stored thing: a chapter
// carries an integer `book`, and books are inferred from chapters exactly as acts are. What
// was fixed at five was the UI -- every list mapped over this constant -- so a sixth book
// could exist in the data and be invisible on screen. The constant now only supplies the
// first five NAMES; `bookName` continues the sequence indefinitely, and `bookIndices` gives
// each screen the range to draw: at least the saga's five, plus whatever the chapters reach,
// plus (where the screen creates chapters) one more for the book that does not exist yet.
export const BOOKS = ['Book One', 'Book Two', 'Book Three', 'Book Four', 'Book Five'];
/** How many books every project shows even when empty -- the saga is five. */
export const MIN_BOOKS = BOOKS.length;

const ORDINAL_WORDS = [
  'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen',
  'Nineteen', 'Twenty',
];

/** "Book One" .. "Book Twenty", then "Book 21" and on. Never undefined, whatever the index. */
export function bookName(bookIndex: number): string {
  const word = ORDINAL_WORDS[bookIndex];
  return word ? `Book ${word}` : `Book ${bookIndex + 1}`;
}

/** Highest book index any chapter uses, plus one; never below MIN_BOOKS. */
export function bookCount(chapters: { book: number }[]): number {
  let max = -1;
  for (const c of chapters) if (c.book > max) max = c.book;
  return Math.max(MIN_BOOKS, max + 1);
}

/**
 * The book indices a screen should offer. `withNext` adds one past the last -- the book that
 * will exist once a chapter is created in it -- for screens that create chapters.
 */
export function bookIndices(chapters: { book: number }[], withNext = false): number[] {
  const n = bookCount(chapters) + (withNext ? 1 : 0);
  return Array.from({ length: n }, (_, i) => i);
}

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

type Ordered = { book: number; act: number; order: number };

/** Saga reading order: book, then act, then position within the act. */
export function byReadingOrder(a: Ordered, b: Ordered): number {
  return a.book - b.book || a.act - b.act || a.order - b.order;
}

/** Order within one book: act, then position. */
export function byBookOrder(a: Omit<Ordered, 'book'>, b: Omit<Ordered, 'book'>): number {
  return a.act - b.act || a.order - b.order;
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
    .sort(byBookOrder);
  const idx = inBook.findIndex((c) => c.id === chapter.id);
  return idx === -1 ? null : idx + 1;
}

// Matches mark.hl-plant/hl-reveal/hl-note's background colors in the PWA's CSS exactly.
export const ANNOTATION_COLORS: Record<'plant' | 'reveal' | 'note', string> = {
  plant: 'rgba(74,122,58,0.35)',
  reveal: 'rgba(184,84,46,0.35)',
  note: 'rgba(58,106,138,0.35)',
};

export type SentenceToken = { text: string; start: number; end: number };

// Word-level {text,start,end} tokens -- used by ReaderScreen's long-press selection
// (paginate.ts's buildPageSegments consumes them). Computing tokens for a whole chapter is
// cheap (a regex pass, no rendering); what once caused a 10-15s-per-tap ANR was rendering a
// touchable element per word for an entire CHAPTER. ReaderScreen only ever renders tokens that
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

