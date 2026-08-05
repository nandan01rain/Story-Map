# The Trail to Kailash — Story Map

A personal writing tool for a five-book mythological saga. Built and iterated
entirely as a single-file Claude.ai artifact (`story_map.html`); this repo is
the migration of that sandbox into a real, independent app.

## Current state (as of handoff)

Single self-contained HTML file. All CSS, JS, and a base64-embedded map
background image live inline in one file. Data persistence currently uses
`window.storage` — a Claude-artifact-only API that does **not** exist outside
Claude.ai. This is the first thing that needs to change.

**A JSON export of the real (non-seed) data should accompany this handoff.**
The HTML file's built-in seed data is placeholder/example content only — the
actual working data lives in the exported JSON, produced via the app's own
⬇ Export button before leaving the sandbox.

## Immediate priority: storage-layer swap

Every mutation in the app currently funnels through two functions:

```js
function loadData(){ /* window.storage.get('storymap-v2', false) ... */ }
function saveData(){ /* window.storage.set('storymap-v2', ...) ... */ }
```

Phase 1 target: replace these with `localStorage` (get the app running
standalone, fully offline, immediately testable). Phase 2 target: replace
again with Supabase (real account-based sync across devices). Keep the same
function signatures/call sites stable through both swaps — nothing else in
the app should need to change shape for this.

## Data model

```
chapters:  {id, book, act, order, title, status, content, wordMin, wordMax,
            notes, annotations[], versions[]}
scenes:    {id, chapterId, order, title, status, summary, requires[],
            provides[], deferredRequires[], notes, pov}
documents: {id, title, type, content}            // Master Bible, character bibles, etc.
stickyNotes: {id, content, createdAt, rotation}  // "The Margin" — quick idea capture
trash:     {id, type: chapter|scene|document, deletedAt, ...soft-deleted payload}
actLabels: { "bookIndex-actNumber": "custom label" }
chapterWordTargets: [[min,max], ...]  // per-book, applies to every chapter in that book
aiEnabled: boolean       // global gate for the two AI-powered features
viewMode:  'map' | 'list'
nextId:    shared auto-increment counter across all entity types
```

`chapters.annotations[]` items: `{id, type: plant|reveal|note, text, label,
linkedPlant?: {chapterId, annotationId}, thread?: string}`. `text` is the
exact flagged substring from the chapter's prose — annotations re-locate
themselves by searching for that substring on render, they do **not** track
a fixed character offset. If the surrounding prose is edited enough that the
substring no longer matches, the annotation silently stops rendering inline
(though it isn't deleted — it just can't be positioned). This is a known
sandbox-era limitation; see "Deferred to the real build" below.

## Hierarchy

Book → Act → Chapter → Scene. Acts are not a separate stored entity — they're
inferred from whatever integer `act` values exist on chapters in a given book,
sorted ascending. Nothing assumes a fixed act count; a book can have 1 act or
9. `actLabels` optionally gives an act a custom name instead of "Act N".

Chapters, not scenes, hold prose (`content`) and are the unit shown on the
map/list. Scenes are metadata-only children of a chapter — title, summary,
POV, plants, notes — describing what happens, not the prose itself. A chapter
can hold multiple scenes (e.g. a continuous conversation later split across
chapter boundaries for pacing).

## Full feature list

- **Map view**: SVG trail, Book bands containing Act clusters containing
  Chapter nodes. Drag-and-drop reordering (chapter → act/book reassignment by
  drop position). Status-colored nodes, gap/word-flag badges.
- **List view**: mobile-friendly accordion (Book → expand → Acts/Chapters).
  Independent of map view — both exist simultaneously, user toggles between
  them, preference persisted.
- **Chapter drawer**: position, status, scenes (with POV, summary, plants-needed
  for reference), word count vs. book-level target, Plants/Reveals/Notes
  widget buttons, chapter notes, delete (→ trash), 🧵 Thread button.
- **Full-screen chapter editor**: textarea + synced highlight-layer overlay
  (renders `<mark>` spans for flagged text without a rich-text editor).
  Autosave (debounced), manual save, version history (last 10 snapshots,
  restorable), word count vs. target, Plant/Reveal/Note flagging buttons
  with live badge counts.
- **Plant/Reveal/Note flagging**: select text in the editor, flag it. Plant →
  auto-feeds the linked scene's `provides`. Reveal → auto-feeds `requires`,
  plus an optional **soft-suggested / hard-linked** connection to a specific
  Plant (searchable candidate list, ranked by text-overlap scoring). Note →
  optional **thread name** for recurring cross-book motifs (see Mythic
  Threads below).
- **Continuity check**: keyword-overlap matching (not AI) between scenes'
  `requires`/`provides` across the whole saga. Two sections: unmet
  requirements (with deferred-state support — mark a requirement "not due
  yet" to silence its flag without deleting it) and orphan plants (sown,
  never claimed).
- **📖 Plant Ledger**: every Plant annotation, saga-ordered, each showing
  paid/open status via the hard-link system.
- **🧵 Thread view** (per-chapter): one level up (what this chapter depends
  on, and where that's satisfied) and one level down (what this chapter
  plants, and who downstream claims it). Uses the scene requires/provides
  system, not the annotation-link system — broader net, fuzzier match.
- **🧭 Mythic Threads**: Notes tagged with a free-text thread name (e.g.
  "Sita–Zia") gather into a browsable, saga-ordered list of "touches" —
  built for parallels that recur many-to-many across the whole saga rather
  than a single plant/reveal pair.
- **👁 POV tracker**: free-text POV field per scene, autocomplete from
  existing names, index of all POV characters with scene counts, full-screen
  browser of every scene in a given POV across the saga.
- **📚 Documents library**: Master Bible / character bibles / scene
  references / timelines, each a free-text document in its own editor.
- **📌 Sticky notes ("The Margin")**: quick, unstructured idea capture —
  parchment-styled cards, autosave, badge count doubling as the closest
  thing to a "reminder" this environment can honestly offer.
- **🔍 Search**: full-text across chapters, scenes, documents, and sticky
  notes, with highlighted match snippets.
- **🗑 Trash**: chapters/scenes/documents soft-delete into a recoverable bin
  (restore or permanently delete) instead of hard-deleting.
- **⬇⬆ Export/Import**: full-state JSON download/upload.
- **AI features (gated by the `aiEnabled` toggle, off by default)**:
  - Scene-summary sync: sends a chapter's prose to Claude, asks for updated
    scene summaries matching what was actually written.
  - Bible consistency check: sends a chapter + all Documents to Claude, asks
    for direct contradictions only (not gaps/ambiguity).
  - Both show a rough pre-call cost estimate (word count → token estimate →
    Sonnet pricing) and require confirmation before firing.
  - **Important**: these currently work via the Claude-artifact-only API
    proxy. In the real build this must move to a small serverless function
    holding the Anthropic key server-side — an API key can never live in
    client-side JS in a real deployed app.
- **Book-level word targets**: set once per book (not per chapter), every
  chapter in that book inherits it. Flags only — never blocks writing.

## Deferred to the real build, not sandbox-solvable

- **Multi-project support.** Everything currently lives in one flat pool.
  Needs a `projects` table and a `project_id` column on every entity once
  there's a real database — cheap there, expensive to retrofit into the
  current single-JSON-blob storage.
- **Per-row database writes.** Every save currently rewrites the entire
  dataset as one blob. Fine at sandbox scale; wrong once there's real
  content. The Supabase migration should target per-entity updates from
  the start.
- **AI-assisted plant/reveal matching.** Current matching (both the
  continuity checker and the soft-link suggestions) is pure keyword overlap.
  Works, but is noisy at scale and can't understand paraphrase. Worth
  revisiting once real usage shows where it actually falls short.
- **Rich-text editor for annotations.** The textarea + highlight-overlay
  trick works but annotations lose their position if the flagged sentence
  is edited. A proper editor (e.g. TipTap) would let annotations move with
  edits instead of breaking. Bigger lift; worth it once the app is stable.

## Roadmap (agreed, two-stage)

**Stage 1** (this repo's job): replicate full sandbox functionality as an
independent app — Supabase backend, real auth, the storage-layer swap, PWA
packaging (manifest + service worker) so it installs to a phone/laptop home
screen. MVP-first sequencing recommended: chapters/scenes/editor/sync
working end-to-end and genuinely usable before porting the rest
(annotations, Ledger, POV, Mythic Threads, Trash) back in one at a time.

**Stage 2** (explicitly not now): storyboards, image generation, and
anything extending past prose-only tooling. Don't design the Stage 1 schema
around guesses about Stage 2 — keep it clean and extensible, decide Stage 2
specifics once Stage 1 is actually being used.

## Design principles worth preserving

- Every AI feature must stay behind the `aiEnabled` toggle and must never be
  required for core functionality — add/edit/organize/write must work fully
  offline with AI off.
- Flags, never hard limits. Word targets, continuity gaps, orphan plants —
  all advisory. Nothing should block the user from writing what they want.
- Destructive actions get a confirmation and a trash entry, not a silent
  permanent delete.
- The aesthetic (Cinzel headers, parchment/leather palette, the embedded map
  background) is a deliberate, discussed choice — "papyrus, Pirates of the
  Caribbean, Avatar, Dune" — not a placeholder theme.
