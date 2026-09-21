// Line-level analysis of prose. No model, no network: sentence rhythm, repeated openings,
// overused words, adverbs, filter words, dialogue -- the things ProWritingAid reports and
// the things a writer can act on the same afternoon. This is the deterministic half Icarus
// was always meant to run before any model call; it runs now with every assistant off.
//
// Everything here is a heuristic over plain text and says so in its wording. A sentence is
// what ends in . ! ? or a closing quote after one; a word is a run of letters with apostrophes
// and hyphens allowed. Good enough to find a chapter's habits, not a grammar checker.

export type SentenceBand = 'short' | 'medium' | 'long' | 'very-long';

export type ProseReport = {
  words: number;
  sentences: number;
  paragraphs: number;
  avgSentence: number;
  medianSentence: number;
  /** Count of sentences in each length band. */
  bands: Record<SentenceBand, number>;
  /** Longest run of consecutive sentences in the same band -- monotony, when it is high. */
  longestSameBandRun: { band: SentenceBand; length: number };
  /** First two words of sentences that begin the same way more than once. */
  repeatedOpenings: { opening: string; count: number }[];
  /** Content words used far more than their share, with the count. */
  overusedWords: { word: string; count: number; perThousand: number }[];
  /** -ly adverbs per thousand words, and the most used. */
  adverbs: { perThousand: number; top: { word: string; count: number }[] };
  /** "Filter" words that put narration between the reader and the thing. */
  filterWords: { word: string; count: number }[];
  /** Share of words inside quotation marks, and the tags used after them. */
  dialogue: { share: number; tags: { tag: string; count: number }[] };
  /** Average paragraph length in words, and the longest. */
  paragraphLength: { avg: number; longest: number };
};

const STOPWORDS = new Set(
  (
    'a an the and or but if then so of to in on at by for with from as is was were be been being ' +
    'are am it its this that these those he she they them his her their we you i me my our your ' +
    'him us who whom which what when where why how not no nor do does did done have has had ' +
    'having will would shall should can could may might must there here than too very into onto ' +
    'out up down over under again off about after before between through during without within ' +
    'all any each few more most other some such only own same both either neither one two ' +
    'said say says just like get got go went come came back made make take took see saw ' +
    'know knew thought think felt feel look looked put let'
  ).split(/\s+/),
);

const FILTER_WORDS = [
  'just', 'really', 'very', 'suddenly', 'somewhat', 'rather', 'quite', 'almost', 'seemed', 'seem',
  'felt', 'feel', 'saw', 'see', 'heard', 'hear', 'noticed', 'notice', 'realized', 'realised',
  'watched', 'watch', 'wondered', 'decided', 'knew', 'thought', 'began', 'started', 'somehow',
];

const DIALOGUE_TAGS = [
  'said', 'asked', 'replied', 'whispered', 'shouted', 'muttered', 'murmured', 'cried', 'called',
  'answered', 'added', 'continued', 'snapped', 'hissed', 'growled', 'laughed', 'sighed', 'breathed',
  'yelled', 'exclaimed', 'demanded', 'insisted', 'began', 'went on', 'told', 'repeated', 'agreed',
];

function bandOf(len: number): SentenceBand {
  if (len <= 8) return 'short';
  if (len <= 20) return 'medium';
  if (len <= 35) return 'long';
  return 'very-long';
}

export function splitSentences(text: string): string[] {
  // Split after terminal punctuation followed by space/newline, keeping closing quotes with
  // the sentence they close. Abbreviations are not handled; "Mr. Rao" makes two sentences.
  return text
    .replace(/\r\n?/g, '\n')
    .split(/(?<=[.!?]["”’']?)\s+|\n{2,}/)
    .map((s) => s.trim())
    .filter((s) => /[A-Za-z]/.test(s));
}

export function wordsOf(text: string): string[] {
  return (text.toLowerCase().match(/[a-z][a-z'’-]*/g) ?? []).map((w) => w.replace(/[’']s$/, ''));
}

export function analyseProse(text: string): ProseReport {
  const paragraphsRaw = text
    .replace(/\r\n?/g, '\n')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  const sentences = splitSentences(text);
  const allWords = wordsOf(text);
  const words = allWords.length;

  // Sentence lengths and bands.
  const lengths = sentences.map((s) => wordsOf(s).length).filter((n) => n > 0);
  const sorted = [...lengths].sort((a, b) => a - b);
  const avgSentence = lengths.length ? lengths.reduce((a, b) => a + b, 0) / lengths.length : 0;
  const medianSentence = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
  const bands: Record<SentenceBand, number> = { short: 0, medium: 0, long: 0, 'very-long': 0 };
  let run = { band: 'medium' as SentenceBand, length: 0 };
  let cur: { band: SentenceBand; length: number } | null = null;
  for (const n of lengths) {
    const b = bandOf(n);
    bands[b] += 1;
    if (cur && cur.band === b) cur.length += 1;
    else cur = { band: b, length: 1 };
    if (cur.length > run.length) run = { ...cur };
  }

  // Repeated openings: first two words.
  const openings = new Map<string, number>();
  for (const s of sentences) {
    const w = wordsOf(s);
    if (w.length < 2) continue;
    const key = `${w[0]} ${w[1]}`;
    openings.set(key, (openings.get(key) ?? 0) + 1);
  }
  const repeatedOpenings = [...openings]
    .filter(([, c]) => c > 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([opening, count]) => ({ opening, count }));

  // Overused content words: top by count among non-stopwords of 4+ letters.
  const freq = new Map<string, number>();
  for (const w of allWords) {
    if (w.length < 4 || STOPWORDS.has(w)) continue;
    freq.set(w, (freq.get(w) ?? 0) + 1);
  }
  const per = (c: number) => (words ? (c / words) * 1000 : 0);
  const overusedWords = [...freq]
    .filter(([, c]) => c >= 3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word, count]) => ({ word, count, perThousand: Math.round(per(count) * 10) / 10 }));

  // Adverbs: -ly words that are not the common non-adverbs.
  const notAdverb = new Set(['only', 'family', 'early', 'reply', 'supply', 'ally', 'belly', 'fly', 'holy', 'jolly', 'lily', 'silly', 'ugly', 'apply', 'rely', 'italy', 'july']);
  const adv = new Map<string, number>();
  let advCount = 0;
  for (const w of allWords) {
    if (w.endsWith('ly') && w.length > 4 && !notAdverb.has(w)) {
      advCount += 1;
      adv.set(w, (adv.get(w) ?? 0) + 1);
    }
  }
  const adverbs = {
    perThousand: Math.round(per(advCount) * 10) / 10,
    top: [...adv].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([word, count]) => ({ word, count })),
  };

  // Filter words.
  const fw = new Map<string, number>();
  for (const w of allWords) if (FILTER_WORDS.includes(w)) fw.set(w, (fw.get(w) ?? 0) + 1);
  const filterWords = [...fw].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([word, count]) => ({ word, count }));

  // Dialogue: words inside straight or curly double quotes; tags right after a closing quote.
  const quoted = text.match(/["“][^"”]{1,600}["”]/g) ?? [];
  const quotedWords = quoted.reduce((n, q) => n + wordsOf(q).length, 0);
  const tagCounts = new Map<string, number>();
  const afterQuote = text.match(/["”][,.]?\s+(?:[A-Z][a-z]+|he|she|they|I|we)\s+([a-z]+(?:\s+on)?)/g) ?? [];
  for (const m of afterQuote) {
    const verb = m.split(/\s+/).slice(-1)[0]?.toLowerCase() ?? '';
    if (DIALOGUE_TAGS.includes(verb)) tagCounts.set(verb, (tagCounts.get(verb) ?? 0) + 1);
  }
  const dialogue = {
    share: words ? Math.round((quotedWords / words) * 100) : 0,
    tags: [...tagCounts].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([tag, count]) => ({ tag, count })),
  };

  const paraLens = paragraphsRaw.map((p) => wordsOf(p).length);
  const paragraphLength = {
    avg: paraLens.length ? Math.round(paraLens.reduce((a, b) => a + b, 0) / paraLens.length) : 0,
    longest: paraLens.length ? Math.max(...paraLens) : 0,
  };

  return {
    words,
    sentences: lengths.length,
    paragraphs: paragraphsRaw.length,
    avgSentence: Math.round(avgSentence * 10) / 10,
    medianSentence,
    bands,
    longestSameBandRun: run,
    repeatedOpenings,
    overusedWords,
    adverbs,
    filterWords,
    dialogue,
    paragraphLength,
  };
}
