// Arachne's loom — the write side of the braid.
//
// The braid renders. This decides what there is to render. Those are different jobs and this
// file is only the second one: nothing here draws, measures or lays anything out (that is
// spine-layout.mjs), and nothing here judges. It takes recognitions the writer has already
// made — "that line in chapter 4 is a plant, chapter 31 pays it" — and turns them into rows.
//
// **Arachne infers nothing.** That is the whole basis on which it is allowed to write into a
// manuscript's metadata. Every judgment happened in a stage-three session with the writer in
// the room; this is transcription, and transcription that guesses is forgery.
//
// Pure functions, no I/O, no globals. Both apps and the Edge Function can reason about the
// same rules, and `node scripts/test-arachne.mjs` can exercise them without a database.

/* ---------------------------------------------------------------------------
   ANCHORS

   An annotation does not store a position. It stores the exact flagged substring and
   relocates itself by searching for it on every render (handoff §3.5). That makes anchor
   choice the single most consequential thing this file does: pick badly and the annotation
   is not wrong, it is INVISIBLE — still in the database, silently unplaceable, and the braid
   simply draws one less thread with nothing to say it should have drawn more.

   So an anchor must be, in order of importance:
     1. exact       — present in the prose character for character
     2. unique      — occurring exactly once in that chapter, or it may bind to the wrong line
     3. short       — the less text it spans, the less editing can break it
--------------------------------------------------------------------------- */

/** Collapses runs of whitespace so a quote copied out of a chat can still match the prose. */
function loosen(s) {
  return (s || '').replace(/\s+/g, ' ').trim();
}

function countOccurrences(haystack, needle) {
  if (!needle) return 0;
  let n = 0, i = 0;
  for (;;) {
    const at = haystack.indexOf(needle, i);
    if (at === -1) return n;
    n += 1;
    i = at + 1;   // overlapping counts too: "aa" occurs twice in "aaa", and that is ambiguous
  }
}

/**
 * Find an anchor for `quote` inside `prose`.
 *
 * Returns { ok, text, occurrences, reason }. On failure `text` is null and `reason` says
 * which rule could not be met — never a silent best guess, because a wrong anchor is worse
 * than no anchor: no anchor is a visible failure, a wrong one is a quiet lie.
 */
export function chooseAnchor(prose, quote) {
  const body = prose || '';
  const wanted = (quote || '').trim();
  if (!wanted) return { ok: false, text: null, occurrences: 0, reason: 'empty-quote' };
  if (!body.trim()) return { ok: false, text: null, occurrences: 0, reason: 'empty-chapter' };

  // 1. Exact, as given.
  let hits = countOccurrences(body, wanted);

  // 2. Not found: retry against a whitespace-normalised copy, then map back. A quote that
  //    survived a round trip through a chat window has had its newlines flattened.
  if (hits === 0) {
    const loose = loosen(wanted);
    const idx = loosen(body).indexOf(loose);
    if (idx === -1) return { ok: false, text: null, occurrences: 0, reason: 'not-in-chapter' };
    const recovered = recoverExact(body, loose);
    if (!recovered) return { ok: false, text: null, occurrences: 0, reason: 'not-in-chapter' };
    return chooseAnchor(body, recovered);
  }

  if (hits === 1) return { ok: true, text: wanted, occurrences: 1, reason: 'exact' };

  // 3. Ambiguous. Widen by whole words around the FIRST occurrence until unique. Words, not
  //    characters, because an anchor cut mid-word reads as damage to anyone who sees it.
  const widened = widenToUnique(body, wanted);
  if (widened) return { ok: true, text: widened, occurrences: 1, reason: 'widened' };

  // A line repeated identically to the end of the chapter — a refrain. Real, and not
  // anchorable by text alone. Say so rather than binding to whichever came first.
  return { ok: false, text: null, occurrences: hits, reason: 'ambiguous' };
}

/** Recovers the exact prose slice corresponding to a whitespace-loosened match. */
function recoverExact(body, loose) {
  const words = loose.split(' ').filter(Boolean).map(escapeRegExp);
  if (!words.length) return null;
  const re = new RegExp(words.join('\\s+'));
  const m = re.exec(body);
  return m ? m[0] : null;
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Grow the window one word at a time, alternating right then left, until the slice occurs
 * exactly once. Stops at MAX_WIDEN words added: past that the anchor is long enough that
 * ordinary editing will break it anyway, and a fragile anchor is a false promise.
 */
const MAX_WIDEN = 12;
function widenToUnique(body, quote) {
  const start = body.indexOf(quote);
  if (start === -1) return null;
  let from = start, to = start + quote.length;

  for (let step = 0; step < MAX_WIDEN; step++) {
    const grewRight = growRight(body, to);
    if (grewRight > to) {
      to = grewRight;
      const slice = body.slice(from, to);
      if (countOccurrences(body, slice) === 1) return slice;
    }
    const grewLeft = growLeft(body, from);
    if (grewLeft < from) {
      from = grewLeft;
      const slice = body.slice(from, to);
      if (countOccurrences(body, slice) === 1) return slice;
    }
    if (grewRight === to && grewLeft === from) break;   // both ends exhausted
  }
  return null;
}

// Paragraph breaks are hard stops in both directions: an anchor spanning one is an anchor
// that two separate edits can each break.
function growRight(body, to) {
  let i = to;
  while (i < body.length && /\s/.test(body[i]) && body[i] !== '\n') i++;
  if (i >= body.length || body[i] === '\n') return to;
  while (i < body.length && !/\s/.test(body[i])) i++;
  return i;
}
function growLeft(body, from) {
  let i = from;
  while (i > 0 && /\s/.test(body[i - 1]) && body[i - 1] !== '\n') i--;
  if (i <= 0 || body[i - 1] === '\n') return from;
  while (i > 0 && !/\s/.test(body[i - 1])) i--;
  return i;
}

/* ---------------------------------------------------------------------------
   GROUPINGS

   A setup and its payoff is a grouping, many-to-many in both directions: several plants can
   converge on one reveal, one plant can spawn several, and a single flag can belong to more
   than one grouping because a line can do two jobs at once. A grouping with no reveal is an
   UNPAID PLANT — a real state, not a fault (CLAUDE.md, data model).
--------------------------------------------------------------------------- */

/** The canonical reader. `pairs` is the model; `pairId`/`pairLabel` are the superseded shape. */
export function pairsOf(annotation) {
  if (annotation && Array.isArray(annotation.pairs) && annotation.pairs.length) return annotation.pairs;
  if (annotation && annotation.pairId) return [{ id: annotation.pairId, label: annotation.pairLabel || '' }];
  return [];
}

/**
 * Join every annotation in `members` into one grouping. Idempotent by construction: a member
 * already carrying this grouping id gains nothing, so re-running a transcription cannot
 * double anything. Returns the grouping.
 *
 * Mutates the annotations, because the callers own arrays loaded from their own store and
 * copying here would mean two sources of truth for one flag.
 */
export function joinGrouping(members, groupingId, label) {
  const id = groupingId || mintGroupingId(members[0]);
  const grouping = { id, label: label || '' };
  members.forEach((a) => {
    if (!a) return;
    const current = pairsOf(a);
    if (current.some((p) => p.id === id)) {
      // Already a member. Adopt a newer label rather than keeping an empty one, but never
      // blank a label that is already there.
      a.pairs = current.map((p) => (p.id === id && label ? { id, label } : p));
      return;
    }
    a.pairs = current.concat([grouping]);
    delete a.pairId;
    delete a.pairLabel;
  });
  return grouping;
}

/** Derived from the anchor annotation's own id, so the same join produces the same id twice. */
export function mintGroupingId(anchorAnnotation) {
  const seed = anchorAnnotation && anchorAnnotation.id != null ? anchorAnnotation.id : Date.now();
  return 'pair:' + seed;
}

/** Remove one annotation from one grouping. The other members are untouched. */
export function leaveGrouping(annotation, groupingId) {
  if (!annotation) return;
  annotation.pairs = pairsOf(annotation).filter((p) => p.id !== groupingId);
  delete annotation.pairId;
  delete annotation.pairLabel;
}

/**
 * Every grouping in the saga, with its members and whether it is paid.
 *
 * `chapters` is [{id, title, book, act, order, annotations[]}]. Returned in saga order by
 * first member, so the list reads the way the braid is drawn rather than by insertion.
 */
export function groupingIndex(chapters) {
  const byId = new Map();
  const ordered = [...(chapters || [])].sort(chapterOrder);
  ordered.forEach((ch) => {
    (ch.annotations || []).forEach((a) => {
      if (a.type !== 'plant' && a.type !== 'reveal') return;
      pairsOf(a).forEach((p) => {
        let g = byId.get(p.id);
        if (!g) {
          g = { id: p.id, label: p.label || '', plants: [], reveals: [] };
          byId.set(p.id, g);
        }
        if (!g.label && p.label) g.label = p.label;
        (a.type === 'plant' ? g.plants : g.reveals).push({ annotation: a, chapter: ch });
      });
    });
  });
  return [...byId.values()].map((g) => ({ ...g, paid: g.reveals.length > 0 }));
}

export function chapterOrder(a, b) {
  return (a.book - b.book) || (a.act - b.act) || (a.order - b.order);
}

/* ---------------------------------------------------------------------------
   THE PLAN

   What Arachne-the-agent actually emits: not writes, a PLAN of writes, which the writer
   accepts. Canon metadata is the thing every other feature is checked against, and a silent
   write into it is the one mistake in this system that could quietly corrupt everything
   downstream — including Icarus's own evidence.

   Nothing here touches prose. Arachne writes annotations; it never writes `content`.
--------------------------------------------------------------------------- */

/**
 * `recognitions` — [{ kind: 'plant'|'reveal'|'note', chapterId, quote, label,
 *                     grouping?: {key, label}, thread?, characterId? }]
 * `chapters`     — the loaded chapters, each with `content` and `annotations`.
 *
 * Returns { creates, joins, skipped, failures }. Every entry is inspectable before anything
 * is written, and running the same plan twice yields an empty one.
 */
export function planTranscription(recognitions, chapters, nextId) {
  const plan = { creates: [], joins: [], skipped: [], failures: [] };
  const byChapter = new Map((chapters || []).map((c) => [c.id, c]));
  const groupingKeys = new Map();   // session-local key -> grouping id
  let id = nextId;

  (recognitions || []).forEach((r, index) => {
    const chapter = byChapter.get(r.chapterId);
    if (!chapter) {
      plan.failures.push({ index, reason: 'no-such-chapter', recognition: r });
      return;
    }
    if (r.kind !== 'plant' && r.kind !== 'reveal' && r.kind !== 'note') {
      plan.failures.push({ index, reason: 'unknown-kind', recognition: r });
      return;
    }

    const anchor = chooseAnchor(chapter.content, r.quote);
    if (!anchor.ok) {
      plan.failures.push({ index, reason: anchor.reason, occurrences: anchor.occurrences, recognition: r });
      return;
    }

    // Idempotency: same chapter, same kind, same anchor text is the same flag. Re-running a
    // transcription must be safe, because it will be re-run -- a session gets interrupted.
    const existing = (chapter.annotations || []).find(
      (a) => a.type === r.kind && a.text === anchor.text,
    );

    let annotation;
    if (existing) {
      plan.skipped.push({ index, reason: 'already-flagged', chapterId: chapter.id, annotationId: existing.id });
      annotation = existing;
    } else {
      annotation = {
        id: id++,
        type: r.kind,
        text: anchor.text,
        label: r.label || '',
        ...(r.kind === 'note' && r.thread ? { thread: r.thread } : {}),
        ...(r.kind === 'note' && r.characterId ? { characterId: r.characterId } : {}),
      };
      plan.creates.push({ index, chapterId: chapter.id, annotation, anchoredBy: anchor.reason });
    }

    if (r.grouping && (r.kind === 'plant' || r.kind === 'reveal')) {
      if (!groupingKeys.has(r.grouping.key)) {
        groupingKeys.set(r.grouping.key, mintGroupingId(annotation));
      }
      const groupingId = groupingKeys.get(r.grouping.key);
      const already = pairsOf(annotation).some((p) => p.id === groupingId);
      if (already) {
        plan.skipped.push({ index, reason: 'already-grouped', groupingId });
      } else {
        plan.joins.push({
          index,
          chapterId: chapter.id,
          annotationId: annotation.id,
          groupingId,
          label: r.grouping.label || '',
        });
      }
    }
  });

  plan.nextId = id;
  return plan;
}

/** True when a plan would change nothing — the check a second run should pass. */
export function planIsEmpty(plan) {
  return plan.creates.length === 0 && plan.joins.length === 0;
}
