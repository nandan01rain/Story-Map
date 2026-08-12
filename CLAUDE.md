# StoryMap ("The Trail to Kailash")

A personal writing tool for a five-book mythological saga called "The Trail
to Kailash" — the app itself is branded **StoryMap** throughout the UI (login
screen, page title, PWA manifest); the saga title is the content this tool
exists to help write, not the app's own name. Built and iterated entirely as
a single-file Claude.ai artifact (originally named `story_map.html` in that
sandbox, now `index.html` in this repo so static hosts serve it as the site
root); this repo is the migration of that sandbox into a real, independent app.

> **This file is the original project brief and is now stale in several
> places it hasn't been updated for.** `STORYMAP_CODEBASE_HANDOFF.md` in this
> repo is the actively maintained, detailed technical handoff — where the two
> disagree, the handoff doc and the actual code win. Read this file for
> background/intent; read the handoff doc for current architecture, feature
> status, known bugs, and what's actually been built.

## Current state

Single self-contained HTML file (`index.html`) plus small static sidecar
files (`manifest.json`, `service-worker.js`, `supabase-config.js`). All CSS,
JS, and a base64-embedded map background image live inline in `index.html`.

**The storage-layer migration described below is complete.** Persistence is
Supabase (Postgres + Auth), not `window.storage` and not `localStorage` — see
the handoff doc §3-4 for the current data-flow and schema. Multi-project
support, real auth, and PWA installability (manifest + service worker) are
all built — none of these are still "future work" the way earlier drafts of
this file described them.

## Storage layer (historical — kept for context, not a current task)

The original migration plan, now completed:

```js
function loadData(){ /* window.storage.get('storymap-v2', false) ... */ }
function saveData(){ /* window.storage.set('storymap-v2', ...) ... */ }
```

Phase 1 (`localStorage`, offline-testable) and Phase 2 (Supabase,
account-based sync) both happened. `loadData()`/`saveData()` today talk to
Supabase directly — see the handoff doc for the real current implementation,
including its known gaps (silent error swallowing, non-granular per-save
upserts).

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
limitation; see "Still deferred" below.

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
- **Full-screen chapter editor**: `contenteditable` div (not a textarea) with
  inline `<mark>` tags injected directly for flagged text — see the handoff
  doc §3.5 for the caret-preservation mechanics this depends on before
  touching it. Autosave (debounced), manual save, version history (last 10
  snapshots,
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

## Still deferred (see handoff doc §7 for the full/current list)

- **Per-row-granular database writes.** `saveData()` upserts every row of
  every populated table on every save, not just what changed. Not a blob
  anymore (that part's fixed), but not fine-grained either.
- **AI-assisted plant/reveal matching.** Current matching (both the
  continuity checker and the soft-link suggestions) is pure keyword overlap.
  Works, but is noisy at scale and can't understand paraphrase.
- **Rich-text/position-tracking editor for annotations.** Annotations
  re-locate themselves by searching for the flagged substring on every
  render rather than tracking a fixed position — they silently stop
  rendering (not deleted) if the surrounding prose is edited enough to break
  the match. A proper editor (e.g. TipTap) would fix this properly.
- **Real book-cover art.** List view's book cards have a genuine image-slot
  architecture (`getBookCoverUrl(bookIndex)` as the single resolution
  point), but no actual per-book artwork exists yet — every book currently
  renders a CSS-gradient placeholder.
- **Day/night/sunrise/sunset living-map visuals.** Reference art exists (see
  handoff doc §9) but production-resolution, map-only image files don't yet
  — implementation is blocked on asset delivery, not on engineering design.
- **A gold ring/glow on the chapter node that was just dragged/dropped**
  (so its new position reads clearly) — still not built.
- **The hamburger drawer "Discover section unreachable" bug** — still
  unresolved (see handoff doc §7), diagnosis was interrupted mid-session.

Fixed since the last update of this section (see handoff doc §7/§9 for
detail): List-mode chapter reordering now exists (drag a handle, within-act
only); the drop-target-highlight-flashes-on-tap bug; all app-wide "Close"
buttons are now a smaller "×"; the Reader view's mobile header overflow/crop.
- **Anthropic API key handling.** The AI features still call
  `api.anthropic.com` directly from client JS with no key attached — this
  needs a real serverless proxy (e.g. a Supabase Edge Function), not a key
  pasted into client code. Not yet built.

## Roadmap

**Stage 1** (Supabase backend, real auth, the storage-layer swap, PWA
packaging, full feature parity with the original sandbox, mobile-responsive
chrome and a visual redesign matching an approved parchment/gilded concept)
is **done**.

**Stage 1.5 — presentation-config + living-map foundations** (also done, see
handoff doc §9 for full detail): a presentation-config resolver applies
palette/typography/layout/motion/background as CSS custom properties, with
one populated preset ("the-atlas") reproducing SAGA-01's existing look
exactly. The map's background image and interactive node/trail layer now
share one coordinate space (a fixed-size SVG world, not derived from
viewport/orientation) — confirmed on real hardware to move together with
zero drift, in both scroll directions and both orientations. Portrait is no
longer cropped the way it used to be.

**Stage 2 (in progress)**: day/night/sunrise/sunset living-map visuals —
real reference art now exists for all four states (see handoff doc §9) and
the intended schedule is real astronomical sunrise/sunset times (not fixed
clock hours), computed client-side via geolocation + a public-domain solar
calculation, with sunrise/sunset as ~1hr transition windows and animated
water/ship layers. Not yet built — see handoff doc §9 for the exact open
questions (asset delivery format, geolocation-decline fallback) blocking
implementation.

**Stage 3** (explicitly not started): storyboards, image generation, and
anything extending past prose-only tooling.

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
  Caribbean, Avatar, Dune" — not a placeholder theme. Mobile chrome (List
  view, the hamburger nav drawer) has since been redesigned to match an
  approved gilded/parchment concept — see the handoff doc for what's real
  art vs. CSS/SVG placeholder in that redesign.
- Temporary diagnostic code must be clearly marked and actually removed once
  it's served its purpose — see `DEBUG_TOUCH_OVERLAY` in the handoff doc for
  the live example of this convention (and its current status).
