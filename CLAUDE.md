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

Alongside those: `supabase/` holds the migrations and the assistant Edge
Function (the only place any API key lives); `demo/` is a disposable test
project converted into a fixture by `scripts/build-demo-fixture.mjs`; `graph/`
holds a browser-runnable copy of the character web's renderer.

A separate, from-scratch React Native/Expo rewrite lives in `mobile/` (its
own `package.json`, node_modules, etc. — not built from or dependent on
`index.html`), targeting the same Supabase backend. See "Native mobile app"
under Roadmap below and the handoff doc for its current status; nothing
else in this file describes it.

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

**Account-level data** (separate from the per-project data above — lives in
Supabase Auth's `user_metadata`, not any of the tables the model above
describes, and needs no schema/migration to extend): `display_name`,
`birthday`, `special_occasions: [{label, date}]`, `motion_enabled` (the
global animation on/off preference — see "Full feature list" and the
handoff doc §12.2). Read/write via `supabase.auth.getUser()`/
`supabase.auth.updateUser({data:{...}})`.

`chapters.annotations[]` items: `{id, type: plant|reveal|note|highlight, text,
label, pairId?, pairLabel?, sceneId?, linkedPlant?: {chapterId, annotationId},
thread?: string}`. `text` is the exact flagged substring from the chapter's
prose — annotations re-locate themselves by searching for that substring on
render, they do **not** track a fixed character offset. If the surrounding
prose is edited enough that the substring no longer matches, the annotation
silently stops rendering inline (though it isn't deleted — it just can't be
positioned). This is a known limitation; see "Still deferred" below.

The four types are not four flavours of one thing:

- `plant` / `reveal` are two ends of a setup and its payoff. `pairId` is what
  ties them together and `pairLabel` carries the pair's title on both ends, so
  the character web can group them without a second query. A pair with no
  reveal is an **unpaid plant** — a real state, not a fault.
- `note` is a remark on a line of prose. It has no far end and never carries a
  `pairId`. `sceneId` optionally narrows it from the whole chapter to one scene.
- `highlight` is a **reading mark, not a story flag** — no label, no place in
  the Flags list or its count, and it exists only to tint the text in the
  Reader. The distinction matters: the Reader can make highlights and cannot
  make flags.

`pairId`/`pairLabel` are currently written only by the demo pack's build script
(`scripts/demo-plants-reveals.mjs`); the editor's own Plant/Reveal buttons still
write an unpaired flag. See "Still deferred".

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
- **In-app Reader**: full-screen, Kindle-style paginated book reader —
  chrome-free by default (tap the middle to reveal/hide header+footer, tap
  or swipe the left/right edges to turn pages, animated page-turn
  transitions), a tabbed Font/Layout settings sheet (font picker, size,
  alignment, continuous-scroll toggle, a brightness slider shared with the
  Editor), two independent bookmark systems (one "moving" bookmark per
  book via a single tap, plus any number of "pinned" bookmarks via a
  double tap), and two-way sync with the chapter Editor — select text in
  either the Reader or the Editor to highlight it or jump to/select that
  exact text in the other. See the handoff doc §12.1 for the full detail
  and the architectural note on why the header/footer are overlays rather
  than real layout-affecting elements. (This bullet describes the **PWA's**
  Reader. The mobile app's is a separate from-scratch build and has since
  diverged — it shows plants/reveals/notes behind a toggle and cannot create
  flags at all. See the Native mobile app section under Roadmap, and handoff
  §14.10.)
- **🕸 Character web (mobile)**: a force-directed graph of the cast, with four
  switchable layers — **Relationships** between characters; **Progression**, a
  character's arc through the events they appear in, in chapter order, with
  everyone else in those events lit alongside; **Plants & Reveals**, every
  flagged line in the prose — plants, reveals and notes — with each plant tied to
  the reveal that pays it; and **Structure**, the map's own
  Book→Act→Chapter→Scene hierarchy, each chapter carrying its scenes, its flags
  and its moment. Events carry serial numbers — chronological by default,
  renumbered from a character's own first event when they are selected in
  Progression, where a gold ribbon also traces the path they take through them.
  Tapping an event turns it and its lines blue; tapping a character keeps the
  gold. Six distinct node shapes: characters circles, events diamonds, chapters
  hexagons, scenes squares, notes turned-corner pages, plants green triangles
  pointing up and reveals red ones pointing down — filterable to
  all/plants/reveals/notes/pairs/unpaid. A searchable **index** lists characters,
  events, chapters, scenes, plants, reveals, notes and pairs separately, so
  nothing has to be found by panning. Tapping any interaction, event or flag
  expands it to an explanation. Reachable from the Reader and the Editor at any
  granularity — a chapter, a scene, or one flagged line. Fills by hand, from the
  demo pack, or by extraction from the prose. Replaces Map view on mobile rather
  than porting it.
- **Account settings**: name/nickname, birthday, a free-form list of
  special occasions, plus email/password — all stored in Supabase Auth's
  `user_metadata` (no new table). Also where the global "moving
  backgrounds & animations" preference lives (see Data model above and
  the handoff doc §12.2).
- **Landing page**: a bottom tab bar (Home / Projects / + / Explore /
  Profile) — Home is a decorative welcome view, Projects is the existing
  project picker, Explore is a placeholder for a not-yet-built
  cross-project search. Uses its own light "parchment card" color palette,
  distinct from the rest of the app's dark theme.
- **Sign-in screen**: full-bleed background art (a sunset/castle
  illustration with the wordmark baked into the image itself) — opens
  showing just the image, tap or swipe up reveals the sign-in form as a
  bottom sheet, tap outside or swipe down collapses it again. Google/
  Apple/Microsoft buttons are visually present but not wired to real
  OAuth yet (needs provider app registration + Supabase dashboard config
  — see handoff doc §12.4).

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
- **Day/night/sunrise/sunset visuals, app-wide.** Scope as of 2026-08-15:
  this now covers the sign-in screen, the landing page, *and* the writing
  app itself (map/list/editor — currently a single fixed dark palette with
  no day variant designed at all, the biggest lift of the three). All three
  are meant to switch together on the same schedule: real astronomical
  sunrise/sunset for the device's location (not fixed clock hours), via
  `navigator.geolocation` + a public-domain solar-position calculation —
  see handoff doc §9 and §13. Blocked on asset delivery (user will supply
  day/night art) and on the geolocation-decline fallback design, not on
  engineering design otherwise.
- **A gold ring/glow on the chapter node that was just dragged/dropped**
  (so its new position reads clearly) — still not built.
- **The hamburger drawer "Discover section unreachable" bug** — still
  unresolved (see handoff doc §7), diagnosis was interrupted mid-session.

Fixed since the last update of this section (see handoff doc §7/§9 for
detail): List-mode chapter reordering now exists (drag a handle, within-act
only); the drop-target-highlight-flashes-on-tap bug; all app-wide "Close"
buttons are now a smaller "×"; the Reader view's mobile header overflow/crop
(and the Reader has since been rebuilt well past that fix — see handoff §12.1).
- **Anthropic API key handling.** The AI features still call
  `api.anthropic.com` directly from client JS with no key attached — this
  needs a real serverless proxy (e.g. a Supabase Edge Function), not a key
  pasted into client code. Not yet built.
- **OAuth sign-in.** Google/Apple/Microsoft buttons exist on the sign-in
  screen but are inert — needs OAuth apps registered with each provider
  (Apple requires a paid developer account) plus that provider enabled in
  the Supabase Auth dashboard. Account/dashboard work, not a code task, and
  not started.
- **Password-reset landing page.** "Forgot password?" sends a real
  Supabase reset email, but there's no page for that email's link to land
  on to actually set a new password yet.
- **Sign-in background image is an uncompressed ~2.3MB PNG.** No image
  tooling was available in the session that added it to compress/convert
  it (photographic content should be JPEG/WebP, not PNG). A same-toned
  gradient placeholder + preload hides most of the perceived load lag, but
  the underlying file size is still worth fixing.
- **Day/night/dawn art for the sign-in screen**, and the layered/animated
  (as opposed to static) version of that background — scoped in
  conversation, no assets delivered yet beyond the one sunset scene. Now
  part of the broader app-wide day/night requirement above. See handoff
  doc §12.4 and §13.
- **The character web's time-scrubber** — filtering the graph to "as of Book N"
  was flagged in its own spec as the highest-value deferred piece, given how much
  these relationships change across five books. Not built. Nor is automatic
  faction/location extraction, or the PWA's own embedding of the renderer (the
  document is written to be shared; the PWA just doesn't serve it yet).
- **Pairing a plant to a reveal from inside the app.** The character web can show
  pairs, browse them, jump to either end and flag unpaid plants, but the editor's
  Plant/Reveal buttons still write an *unpaired* flag — `pairId`/`pairLabel` are
  currently only written by the demo pack's build script
  (`scripts/demo-plants-reveals.mjs`). The PWA's own `linkedPlant` shape isn't read
  by the mobile web yet either, so the two halves of the app model the same
  relationship differently. This is the single biggest gap in the plant/reveal
  feature: everything downstream of a pair exists, nothing upstream of one does.
- **Two graph migrations are unrun.** `20260822_graph_flags.sql` and
  `20260822b_graph_structure.sql` — the second supersedes the first, so running
  only the newer one against the live project is enough. Until then the
  Plants & Reveals and Structure layers return nothing. Nothing else breaks,
  because the client defaults each key of the RPC payload independently rather
  than assuming the whole shape.
- **Attaching a note to a scene from the app.** `sceneId` on a note annotation is
  read everywhere it matters and written only by the demo pack's build. Nothing in
  the UI offers the choice.
- **The in-app assistants are built but switched off.** Icarus and
  Daedalus have their database objects (migration already run against the
  live project), Edge Function, agent configurations, account-level toggle,
  indexing pipeline and chat panel — all committed. What is missing is an
  Anthropic API key, a decision on the embedding provider, and
  `supabase functions deploy`. Also still unwritten: Icarus's deterministic
  half (the SQL checks that should run before any model call) and the
  proposal/review queue so canon-document edits arrive as a diff to accept
  rather than a silent write. Handoff doc §15.
- **Cross-project search ("Explore" tab)** on the landing page — the tab
  exists as a styled placeholder, the actual search-across-all-projects
  feature was never built.

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

**Stage 1.6 — Reader overhaul, account settings, sign-in/landing redesign**
(done, see handoff doc §12 for full detail): the in-app Reader rebuilt
Kindle-style (chrome-free full-screen, tap/swipe page turns, Font/Layout
settings sheet, two independent bookmark systems, two-way highlight/jump
sync with the Editor); an account-wide Settings surface (name, birthday,
special occasions, a global motion-preference toggle) backed by Supabase
Auth's `user_metadata`, no new tables; the landing page redesigned with a
bottom tab bar and its own light color palette; the sign-in screen
redesigned around full-bleed background art with a tap/swipe bottom-sheet
form. Real OAuth, the password-reset landing page, image compression for
the new background art, and day/night art for that same screen are the
concrete follow-ups — see "Still deferred" above.

**Stage 2 (in progress, scope expanded 2026-08-15)**: day/night/sunrise/
sunset visuals — originally scoped as the living map only, then also the
sign-in screen; now explicitly **app-wide**, covering the sign-in screen,
the landing page, and the writing app itself (map/list/editor), all
switching together on one schedule. Real reference art exists for the
living map's four states (see handoff doc §9); the sign-in screen has only
its one sunset scene so far; the writing app has no day variant designed
at all yet — art for all of this is expected to be supplied by the user.
Intended schedule source: real astronomical sunrise/sunset times (not
fixed clock hours), computed client-side via geolocation + a public-domain
solar calculation, with sunrise/sunset as ~1hr transition windows and
animated water/ship layers on the map/sign-in screens. Not yet built — see
handoff doc §9 and the new §13 for the open questions (asset delivery
format per surface, geolocation-decline fallback, and how a fixed dark
writing-app palette becomes two palettes) blocking implementation. The
Stage 1.6 motion-preference toggle (`motion_enabled` in `user_metadata`, a
`motion-on` class on `<html>`) was built in anticipation of gating this
work's animated layers, but no surface reads it yet.

**Stage 4 — in-app assistants and the character web (2026-08-21)**:

The **character knowledge graph** is built and running, and needs no API key to
use. It is the mobile answer to Map view, which a portrait phone cannot usefully
show. Characters, events and flagged lines are nodes in one graph with three
switchable layers: **Relationships** (who knows whom, coloured by what passes
between them), **Progression** (a character's arc through events in chapter
order, numbered from their own first event and traced as a path, lighting every
other character standing in those same events) and **Plants & Reveals** (each
plant tied to the reveal that pays it, with unpaid plants visible as unpaid). All
three list their contents as headings that expand to an explanation, and a
searchable index lists each kind separately so a growing web stays navigable. Populated three ways — by hand, by the
demo pack, or by extraction from the prose, which is the only one that costs
money. See handoff doc §17 for the schema, the deviations from the supplied spec,
and the traps.

The **assistants** themselves (groundwork built 2026-08-21, dormant by
choice): two in-house agents, **Icarus** (validation — continuity,
unreferenced ideas, arcs gone quiet; mostly deterministic SQL with a cheap
model only for the judgment step) and **Daedalus** (craft judgment —
structure, mythological parallels and where they should stop, technique,
grounded comparison to published work). The retrieval layer, the Edge
Function and the app-side toggle/panel are all built and committed; nothing
is deployed and no API key has been bought, so nothing runs and nothing is
billed. This is a deliberate pause, not an unfinished build. MCP is a
complementary later addition — a second door onto the same retrieval layer,
and the only path that would run on a Claude subscription rather than an API
key. See handoff doc §15 for the full design, the decisions worth not
re-litigating, and the one open question (which embedding provider, since
Anthropic has none).

The **engine is selectable per agent** — Claude, Kimi, DeepSeek, Qwen, GPT, or
any OpenAI-compatible host including a self-hosted one — because the model is the
least important thing separating the two agents. What actually separates them is
their tools, their permissions, their output contract and their retrieval
strategy: Icarus is read-only, cannot write prose at all, and must answer under a
schema of claim-and-evidence; Daedalus may propose document edits and additionally
receives a digest of the whole saga. A cheap model running Icarus is still Icarus.
Handoff doc §16.

**Stage 3** (explicitly not started): storyboards, image generation, and
anything extending past prose-only tooling.

**Native mobile app (in progress, separate track from Stages 1-3 above)**:
a from-scratch React Native/Expo rewrite in `mobile/` (its own package.json,
not part of the PWA's `index.html`), started 2026-08-16 after the user
decided a PWA — still Chrome's engine underneath regardless of how "app-
like" it's made to feel, see the day/night/compass/fullscreen work above —
wasn't a substitute for a genuine native app. Full rationale, architecture
decisions, and phased scope live in the plan doc referenced in conversation
and in the handoff doc's dedicated section (§14); short version: same
Supabase backend/tables as the PWA (no schema changes), React Navigation +
Zustand, Expo SDK 57.

As of 2026-08-19 the mobile app has grown well past initial parity and now
has its own app-wide day/night theme system, a real e-reader, and several
features (sticky notes, book-level chapter creation, account settings) the
PWA either doesn't have on mobile at all or handles differently. Built and
verified on a real device: auth, project CRUD (including reordering, a
PWA gap filled mobile-first), List view (Book→Act→Chapter, book-wide drag-
reorder, a "+" per book to create a chapter directly into a chosen act),
the chapter drawer (word count that glows blue/gold/red against the book's
target instead of printing the raw numbers), a single always-editing
chapter editor (TextInput-native selection for Plant/Reveal/Note flagging,
autosave, version history), a from-scratch Reader (real page-level
pagination via off-screen text measurement, a chrome-hidden fullscreen mode
and a chrome-visible peeking three-page carousel, a table of contents that
slides in from the left, Font/Layout controls including alignment and a
curated font choice, local moving/pinned bookmarks, and two-way
"View in Editor"/"View in Reader" jumps that land on the exact selected
text), sticky notes ("The Margin", real `sticky_notes` table CRUD, cards
that open into a full-screen editor), and a Settings screen (day/night/auto
theme — auto follows the device clock, not the OS light/dark setting — plus
an app-scoped screen-brightness slider). The main hamburger menu and the
Reader's table of contents are both real slide-in-from-the-left panels
opened purely by an edge swipe, no button.

Added since (2026-08-21): a **living sign-in scene** ported from the PWA —
the layered artwork with bobbing ships, gliding birds, twinkling city
lights, flickering lanterns and drifting water bands, switching between
day/sunrise-sunset/night on real time with a manual override in Settings;
the PWA's **landing page** with its Home/Projects/+/Explore/Profile tab bar
in the same three time modes; a **Documents library** (the PWA's Master
Bible / character bibles / references / timelines, which mobile had lacked
entirely); **Google Drive import**, which pulls documents straight into a
project rather than making the writer copy them across by hand; **full-text
search**; a real **highlight** in the Reader; and the dormant **assistant**
groundwork described under Stage 4 above.

Added 2026-08-21: the **character web** described under Stage 4 above, which
is the mobile replacement for Map view; a **demo pack** (`demo/`) that loads a
complete 17-chapter test project — prose, scenes, POV, documents, cast,
relationships and 27 plant/reveal pairs flagged into the prose itself — from the
Projects tab in one tap, so every feature can be exercised against real material
without writing any (handoff §18); and **selectable engines** for the two
assistants.

Added 2026-08-22, in three passes:

**The character web's Plants & Reveals layer**, event **serial numbers**
(chronological by default, renumbered from a character's own first event when
they are selected in Progression) and per-character **progression paths** — a
gold ribbon through their events in order, drawn as a frame overlay rather than
as links, because links would join the simulation and pull the arc into a ring.
Tapping an event turns it and its lines blue; a character keeps the gold. Plus a
searchable **index**, because past a couple of dozen nodes a graph you have to
pan through is a graph you stop opening.

**A fourth layer, Structure** — the map's own Book→Act→Chapter→Scene hierarchy,
with every chapter carrying its scenes, its flags and its moment. Chapters and
events are both in the graph and are **not the same thing**: an event is
somewhere characters are present and a chapter nobody has been placed in has
none, while a chapter exists regardless, owns the prose, and is what an
annotation actually hangs off. Notes joined plants and reveals as a third flag
kind. Six distinct node shapes.

**The Reader stopped making flags and started showing them.** Its
Plant/Reveal/Note button is gone; instead a header toggle (off by default,
persisted) tints plants green, reveals red and notes amber. Highlighting stays,
because a highlight is a reading mark rather than a story flag. The character
web is now reachable from the Reader and the Editor at **any granularity** — a
chapter, a scene, or one flagged line — through a single `focusNodeId`, which
needs no translation because all three are nodes under their own database ids.

Plants, reveals and notes are read live out of `chapters.annotations` rather
than copied into the graph tables, so flagging a line in the editor puts it on
the web with no sync step. **Two migrations have not been run against the live
project yet** — `supabase/migrations/20260822_graph_flags.sql` and
`20260822b_graph_structure.sql`; the second supersedes the first, so running
only `20260822b` is enough. Until then those layers return nothing and nothing
else breaks: the client defaults each key of the payload independently.
`graph/character-web-demo.html` is now generated from the renderer plus the demo
pack by `scripts/build-graph-demo.mjs` instead of being a hand-kept duplicate
with an invented cast.

Still not built: Map view (**not planned for mobile** — the character web
replaces it there), the remaining secondary features (continuity checker, POV
tracker, Mythic Threads, trash), a dictionary/word-lookup feature in the Reader
(deferred by explicit choice), and the two assistants' actual operation (built,
not deployed — see Stage 4 and handoff §15). Google Drive import is written but
needs a Google Cloud OAuth client and the Google provider enabled in the
Supabase dashboard before it can connect — account work, not code. See handoff
doc §14 for the mobile app's session-by-session detail, §16 for the engine
layer, §17 for the character web and §18 for the demo pack — this paragraph is
the summary only.

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
