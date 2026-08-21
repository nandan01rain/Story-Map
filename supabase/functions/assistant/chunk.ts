// Splitting source text into embeddable chunks.
//
// Chunks are built from paragraphs, never from a fixed character count. A retrieved chunk
// is shown to the model as evidence and quoted back to the writer, so a chunk that starts
// mid-sentence is actively harmful -- it reads as a misquote of their own prose. Paragraph
// boundaries are the natural seam in a manuscript, and prose has plenty of them.
//
// Overlap exists because a claim and the sentence that qualifies it often straddle a
// boundary: without it, retrieval can surface "Dev never carried a weapon" while the
// "until the siege" in the next paragraph sits in a chunk that didn't rank.
const TARGET_CHARS = 3000; // ~500 words, comfortably inside any embedding model's window
const OVERLAP_CHARS = 400;
const MIN_CHUNK_CHARS = 120; // below this a chunk carries no retrievable meaning

export type Chunk = { index: number; content: string };

export function chunkText(raw: string): Chunk[] {
  const text = (raw ?? '').trim();
  if (!text) return [];

  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let current = '';

  for (const paragraph of paragraphs) {
    // A single paragraph over the target gets split on sentence ends rather than being
    // emitted oversized -- long unbroken passages are common in prose.
    if (paragraph.length > TARGET_CHARS) {
      if (current) {
        chunks.push(current);
        current = '';
      }
      for (const piece of splitLongParagraph(paragraph)) chunks.push(piece);
      continue;
    }

    if (current && current.length + paragraph.length + 2 > TARGET_CHARS) {
      chunks.push(current);
      current = tailOf(current, OVERLAP_CHARS);
    }
    current = current ? `${current}\n\n${paragraph}` : paragraph;
  }

  if (current) chunks.push(current);

  return chunks
    .map((content) => content.trim())
    .filter((content) => content.length >= MIN_CHUNK_CHARS)
    .map((content, index) => ({ index, content }));
}

function splitLongParagraph(paragraph: string): string[] {
  const sentences = paragraph.match(/[^.!?]+[.!?]+["')\]]*\s*|[^.!?]+$/g) ?? [paragraph];
  const out: string[] = [];
  let current = '';
  for (const sentence of sentences) {
    if (current && current.length + sentence.length > TARGET_CHARS) {
      out.push(current.trim());
      current = tailOf(current, OVERLAP_CHARS);
    }
    // A "sentence" longer than the target on its own -- a passage with no terminal
    // punctuation at all, which sounds theoretical but is what a pasted note or a very long
    // stream-of-consciousness line looks like. Left alone this emits a single chunk of
    // whatever size the paragraph happens to be, and the embedding call rejects it, failing
    // the whole index pass for that chapter.
    if (sentence.length > TARGET_CHARS) {
      if (current.trim()) out.push(current.trim());
      current = '';
      for (const piece of hardSplit(sentence)) out.push(piece);
      continue;
    }
    current += sentence;
  }
  if (current.trim()) out.push(current.trim());
  return out;
}

// Last-resort split on word boundaries, for text with no sentence structure to follow.
function hardSplit(text: string): string[] {
  const words = text.split(/(\s+)/);
  const out: string[] = [];
  let current = '';
  for (const word of words) {
    if (current.length + word.length > TARGET_CHARS && current.trim()) {
      out.push(current.trim());
      current = '';
    }
    current += word;
  }
  if (current.trim()) out.push(current.trim());
  return out;
}

// Trims the overlap back to a sentence boundary where there is one nearby, so the carried
// context starts somewhere readable rather than mid-clause.
function tailOf(text: string, chars: number): string {
  const tail = text.slice(-chars);
  const boundary = tail.search(/[.!?]["')\]]*\s/);
  return boundary === -1 ? tail.trimStart() : tail.slice(boundary + 1).trimStart();
}

// Stable content hash, so re-indexing only pays to embed chunks whose text actually
// changed. FNV-1a rather than SHA via WebCrypto: this runs over every chunk on every
// index pass and is only ever compared for equality, never used for anything where
// collision resistance matters.
export function hashChunk(content: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < content.length; i += 1) {
    hash ^= content.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `${hash.toString(16)}-${content.length}`;
}
