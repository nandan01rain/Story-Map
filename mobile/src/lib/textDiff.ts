// A word-level diff, for showing what a version snapshot changed. Common prefix and suffix
// are stripped first -- most edits touch one region of a chapter -- and only the middle is
// diffed, by LCS when it is small enough and as a plain replace when it is not. Chapters run
// to tens of thousands of words, and an exact diff over that on a phone is not worth the
// wait: a replaced block in the middle, shown as such, tells the writer what they need.

export type DiffPart = { kind: 'same' | 'added' | 'removed'; text: string };

const LCS_LIMIT = 1500; // words on each side, beyond which the middle is one replace

function tokens(text: string): string[] {
  return text.split(/(\s+)/).filter((t) => t.length > 0);
}

export function diffWords(before: string, after: string): DiffPart[] {
  const a = tokens(before);
  const b = tokens(after);
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start += 1;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA -= 1;
    endB -= 1;
  }
  const midA = a.slice(start, endA);
  const midB = b.slice(start, endB);
  const parts: DiffPart[] = [];
  if (start > 0) parts.push({ kind: 'same', text: a.slice(0, start).join('') });

  if (midA.length === 0 && midB.length === 0) {
    // identical
  } else if (midA.length > LCS_LIMIT || midB.length > LCS_LIMIT) {
    if (midA.length) parts.push({ kind: 'removed', text: midA.join('') });
    if (midB.length) parts.push({ kind: 'added', text: midB.join('') });
  } else {
    parts.push(...lcsDiff(midA, midB));
  }

  if (endA < a.length) parts.push({ kind: 'same', text: a.slice(endA).join('') });
  return mergeRuns(parts);
}

function lcsDiff(a: string[], b: string[]): DiffPart[] {
  const n = a.length;
  const m = b.length;
  // dp[i][j] = LCS length of a[i:], b[j:]
  const dp: Uint16Array[] = [];
  for (let i = 0; i <= n; i++) dp.push(new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const out: DiffPart[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push({ kind: 'same', text: a[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push({ kind: 'removed', text: a[i] });
      i++;
    } else {
      out.push({ kind: 'added', text: b[j] });
      j++;
    }
  }
  while (i < n) out.push({ kind: 'removed', text: a[i++] });
  while (j < m) out.push({ kind: 'added', text: b[j++] });
  return out;
}

function mergeRuns(parts: DiffPart[]): DiffPart[] {
  const out: DiffPart[] = [];
  for (const p of parts) {
    const last = out[out.length - 1];
    if (last && last.kind === p.kind) last.text += p.text;
    else out.push({ ...p });
  }
  return out;
}

/** Word counts of what a version removed and added, for a one-line summary. */
export function diffSummary(parts: DiffPart[]): { added: number; removed: number } {
  let added = 0;
  let removed = 0;
  for (const p of parts) {
    const n = (p.text.match(/\S+/g) ?? []).length;
    if (p.kind === 'added') added += n;
    else if (p.kind === 'removed') removed += n;
  }
  return { added, removed };
}
