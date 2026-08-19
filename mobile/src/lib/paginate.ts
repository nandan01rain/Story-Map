// Real e-reader page pagination: splits a chapter's prose into fixed-size visual pages
// (not one page per chapter) using RN's Text `onTextLayout` line metrics -- the only way
// to know where text actually wraps without a native text-measurement API. Each line's
// exact substring is located back in the source text (sequential indexOf, since wrapping
// never reorders characters) so a page's start/end indices are real offsets into
// `chapter.content`, not a reconstruction -- that's what lets tap-to-select selection and
// cross-screen "jump to this exact text" (ReaderScreen <-> EditorScreen) work precisely.
//
// Pages keep their individual line spans, not just an overall start/end: the Reader draws
// a page one line at a time so every word can be an independently-positioned element with
// real on-screen geometry, which is what makes drag-to-extend selection possible (see
// buildLineWords below and ReaderScreen's hit-testing).
export type PageLine = { start: number; end: number; endsParagraph: boolean };
export type ChapterPage = { startIndex: number; endIndex: number; text: string; lines: PageLine[] };

export function buildPagesFromLines(
  content: string,
  lines: { text: string }[],
  linesPerPage: number,
): ChapterPage[] {
  if (!content.trim() || lines.length === 0) {
    return [{ startIndex: 0, endIndex: content.length, text: content, lines: [] }];
  }

  let cursor = 0;
  const spans: { start: number; end: number }[] = [];
  for (const line of lines) {
    const t = line.text ?? '';
    let idx = t.length ? content.indexOf(t, cursor) : cursor;
    if (idx === -1) idx = cursor; // shouldn't happen, but never regress past cursor
    const end = idx + t.length;
    spans.push({ start: idx, end });
    cursor = Math.max(cursor, end);
  }

  const pages: ChapterPage[] = [];
  for (let i = 0; i < spans.length; i += linesPerPage) {
    const chunk = spans.slice(i, i + linesPerPage);
    const start = chunk[0].start;
    const end = chunk[chunk.length - 1].end;
    const pageLines: PageLine[] = chunk.map((span, j) => {
      const nextStart = j + 1 < chunk.length ? chunk[j + 1].start : spans[i + chunk.length]?.start ?? content.length;
      return {
        start: span.start,
        end: span.end,
        // Justified text stretches every line except the one that ends a paragraph. A
        // line ends a paragraph when a newline (or the end of the chapter) follows it
        // rather than more of the same wrapped sentence.
        endsParagraph: span.end >= content.length || content.slice(span.end, nextStart).includes('\n'),
      };
    });
    pages.push({ startIndex: start, endIndex: end, text: content.slice(start, end), lines: pageLines });
  }
  return pages.length > 0 ? pages : [{ startIndex: 0, endIndex: content.length, text: content, lines: [] }];
}

export type LineWord = { tokenIndex: number; text: string };

// Each of a page's lines as the list of whole words sitting on it. Words are laid out as
// separate elements per line rather than one Text per page, which is what gives every
// word a measurable position for drag-selection hit-testing while still reproducing the
// exact wrapping the measurer computed. A word longer than a whole line (so it straddles
// the boundary) is attached to the line it starts on rather than dropped.
export function buildLineWords(page: ChapterPage, tokens: { start: number; end: number; text: string }[]): LineWord[][] {
  const result: LineWord[][] = [];
  let t = 0;
  while (t < tokens.length && tokens[t].end <= page.startIndex) t++;

  for (const line of page.lines) {
    const words: LineWord[] = [];
    while (t < tokens.length && tokens[t].start < line.end) {
      const token = tokens[t];
      if (token.end > line.start) words.push({ tokenIndex: t, text: token.text });
      t++;
    }
    result.push(words);
  }
  return result;
}
