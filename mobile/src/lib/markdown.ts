// Markdown, parsed for reading (2026-10-11).
//
// The reference documents are markdown and were shown as raw text -- `**`, `##`, pipes and
// all. This turns a document into blocks the document reader draws the way a chat window
// renders markdown: real headings, bold and italics, bullet and numbered lists (nested),
// tables, quotes, rules and inline code.
//
// Written here rather than taken from a library: it covers exactly what the documents use,
// it is plain JavaScript so it ships over the air, and every block carries the offset where it
// starts in the raw text, which is what lets "Edit" open the editor on the part being read.
// The stored text is never changed by any of this.

export type Inline = { text: string; bold?: boolean; italic?: boolean; code?: boolean; strike?: boolean };

export type Block =
  | { kind: 'heading'; level: number; inline: Inline[]; plain: string; at: number }
  | { kind: 'paragraph'; inline: Inline[]; at: number }
  | { kind: 'item'; depth: number; marker: string; inline: Inline[]; at: number }
  | { kind: 'quote'; inline: Inline[]; at: number }
  | { kind: 'code'; text: string; at: number }
  | { kind: 'rule'; at: number }
  | { kind: 'table'; header: Inline[][]; rows: Inline[][][]; align: ('left' | 'center' | 'right')[]; at: number };

// ---- inline ------------------------------------------------------------------------------

// Order matters: code first (nothing inside it is markup), then bold before italic so `**`
// is never read as two italics, then links reduced to their text.
const INLINE = /(`[^`]+`)|(\*\*\*[^*]+\*\*\*)|(\*\*(?:[^*]|\*(?!\*))+?\*\*|__[^_]+?__)|(~~[^~]+~~)|((?<![\w*])\*(?!\s)[^*]+?(?<!\s)\*(?![\w*])|(?<![\w_])_(?!\s)[^_]+?(?<!\s)_(?![\w_]))|(\[[^\]]+\]\([^)]*\))/g;

export function parseInline(src: string, base: Omit<Inline, 'text'> = {}): Inline[] {
  const out: Inline[] = [];
  let last = 0;
  // A fresh regex per call: the calls recurse (bold inside a quote, italic inside bold), and a
  // shared /g regex's lastIndex reset by the inner call sends the outer loop back to the start.
  const re = new RegExp(INLINE.source, 'g');
  for (let m = re.exec(src); m; m = re.exec(src)) {
    if (m.index > last) out.push({ ...base, text: src.slice(last, m.index) });
    const [whole, code, boldItalic, bold, strike, italic, link] = m;
    if (code) out.push({ ...base, code: true, text: whole.slice(1, -1) });
    else if (boldItalic) out.push(...parseInline(whole.slice(3, -3), { ...base, bold: true, italic: true }));
    else if (bold) out.push(...parseInline(whole.slice(2, -2), { ...base, bold: true }));
    else if (strike) out.push(...parseInline(whole.slice(2, -2), { ...base, strike: true }));
    else if (italic) out.push(...parseInline(whole.slice(1, -1), { ...base, italic: true }));
    else if (link) out.push(...parseInline(whole.slice(1, whole.indexOf('](')), base));
    last = m.index + whole.length;
  }
  if (last < src.length) out.push({ ...base, text: src.slice(last) });
  return out;
}

export function plainText(inline: Inline[]): string {
  return inline.map((s) => s.text).join('');
}

// ---- blocks ------------------------------------------------------------------------------

const HEADING = /^ {0,3}(#{1,6})\s+(.*?)\s*#*\s*$/;
const RULE = /^ {0,3}([-*_])(\s*\1){2,}\s*$/;
const ITEM = /^(\s*)([-*+]|\d{1,3}[.)])\s+(.*)$/;
const TABLE_SEP = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;

function cells(line: string): string[] {
  let s = line.trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|')) s = s.slice(0, -1);
  return s.split(/(?<!\\)\|/).map((c) => c.trim());
}

export function parseMarkdown(raw: string): Block[] {
  const text = (raw ?? '').replace(/\r\n?/g, '\n');
  const lines = text.split('\n');
  // Offset of each line in the raw text, so every block knows where it starts.
  const offsets: number[] = [];
  let acc = 0;
  for (const l of lines) {
    offsets.push(acc);
    acc += l.length + 1;
  }

  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const at = offsets[i];

    if (!line.trim()) {
      i += 1;
      continue;
    }

    if (/^\s*```/.test(line)) {
      const body: string[] = [];
      i += 1;
      while (i < lines.length && !/^\s*```/.test(lines[i])) body.push(lines[i++]);
      i += 1;
      blocks.push({ kind: 'code', text: body.join('\n'), at });
      continue;
    }

    const h = HEADING.exec(line);
    if (h) {
      const inline = parseInline(h[2]);
      blocks.push({ kind: 'heading', level: h[1].length, inline, plain: plainText(inline), at });
      i += 1;
      continue;
    }

    if (RULE.test(line)) {
      blocks.push({ kind: 'rule', at });
      i += 1;
      continue;
    }

    if (line.includes('|') && i + 1 < lines.length && TABLE_SEP.test(lines[i + 1])) {
      const header = cells(line).map((c) => parseInline(c));
      const align = cells(lines[i + 1]).map((c) =>
        c.startsWith(':') && c.endsWith(':') ? 'center' : c.endsWith(':') ? 'right' : 'left',
      ) as ('left' | 'center' | 'right')[];
      const rows: Inline[][][] = [];
      i += 2;
      while (i < lines.length && lines[i].includes('|') && lines[i].trim()) {
        rows.push(cells(lines[i]).map((c) => parseInline(c)));
        i += 1;
      }
      blocks.push({ kind: 'table', header, rows, align, at });
      continue;
    }

    const item = ITEM.exec(line);
    if (item) {
      const indent = item[1].replace(/\t/g, '    ').length;
      let body = item[3];
      i += 1;
      // A list item continues onto following lines that are indented and are not a new item.
      while (i < lines.length && lines[i].trim() && /^\s+/.test(lines[i]) && !ITEM.test(lines[i])) {
        body += ' ' + lines[i].trim();
        i += 1;
      }
      const marker = /^\d/.test(item[2]) ? item[2].replace(')', '.') : '•';
      blocks.push({ kind: 'item', depth: Math.min(4, Math.floor(indent / 2)), marker, inline: parseInline(body), at });
      continue;
    }

    if (/^\s{0,3}>/.test(line)) {
      const body: string[] = [];
      while (i < lines.length && /^\s{0,3}>/.test(lines[i])) body.push(lines[i++].replace(/^\s{0,3}>\s?/, ''));
      blocks.push({ kind: 'quote', inline: parseInline(body.join(' ').trim()), at });
      continue;
    }

    // A paragraph: consecutive plain lines joined, as markdown (and the chat window) does.
    const body: string[] = [line.trim()];
    i += 1;
    while (
      i < lines.length &&
      lines[i].trim() &&
      !HEADING.test(lines[i]) &&
      !RULE.test(lines[i]) &&
      !ITEM.test(lines[i]) &&
      !/^\s{0,3}>/.test(lines[i]) &&
      !/^\s*```/.test(lines[i]) &&
      !(lines[i].includes('|') && i + 1 < lines.length && TABLE_SEP.test(lines[i + 1]))
    ) {
      body.push(lines[i].trim());
      i += 1;
    }
    blocks.push({ kind: 'paragraph', inline: parseInline(body.join(' ')), at });
  }
  return blocks;
}

/**
 * The part of a document an edit should open on: from the `#`/`##` heading at or before
 * `at`, up to the next heading of level 1 or 2. Whole document when it has no such headings.
 */
export function sectionRange(raw: string, at: number): { start: number; end: number; title: string | null } {
  const re = /^ {0,3}#{1,2}\s+(.*)$/gm;
  const heads: { at: number; title: string }[] = [];
  for (let m = re.exec(raw); m; m = re.exec(raw)) heads.push({ at: m.index, title: plainText(parseInline(m[1].trim())) });
  if (heads.length === 0) return { start: 0, end: raw.length, title: null };
  let idx = -1;
  for (let k = 0; k < heads.length; k += 1) if (heads[k].at <= at) idx = k;
  if (idx === -1) return { start: 0, end: heads[0].at, title: null };
  const end = idx + 1 < heads.length ? heads[idx + 1].at : raw.length;
  return { start: heads[idx].at, end, title: heads[idx].title };
}
