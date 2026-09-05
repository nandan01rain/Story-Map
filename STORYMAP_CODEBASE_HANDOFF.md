# StoryMap — Codebase Handoff for Incoming Claude Code Session

This document is written for a **coding agent**, not a human. It exists because
development is moving to a fresh conversation and the accumulated implementation
context (debugging history, architectural decisions, half-finished work) would
otherwise be lost. `CLAUDE.md` in this repo is the original project brief and is
now **stale in several places** — where it conflicts with this document or with
the actual code, this document and the code win. Do not re-derive decisions this
document already settles; do not blindly trust `CLAUDE.md`'s roadmap either.

**As of 2026-08-26 the character web has been replaced by THE BRAID in both apps.** Read
**§22 first** — it supersedes §17 wherever the two disagree, and §17 is kept only for the
schema and the extraction pipeline, which are unchanged. Relationships was dropped by
decision; `characterWebHtml.ts` still builds and nothing imports it.

**One migration is outstanding.** `20260824_graph_pairs.sql` is applied, verified by calling
the RPC. **`20260825_spine_support.sql` is written and NOT run** — until it is, saving a
chapter with a story time fails on an unknown column. It is the only database work pending.

**The PWA is still not deployed.** `https://nandan01rain.github.io/Story-Map/` returns 404:
the workflow is in `deploy/` because this repo's credential lacks GitHub's `workflow` scope,
so it has to be created through the web UI, and Pages has never been enabled. Everything runs
locally (`python -m http.server 8080`, or `deploy/storymap-local.bat`), against the same
Supabase project, with no loss of capability.

The Android app is a standalone APK built with EAS, installed on the writer's phone, and
takes JavaScript changes over the air — **except the braid's landscape lock, which is native
and needs a new build.** **Read §20 before shipping anything.**

**The two apps are now at parity**, and further work is meant to land on both. Map view is
gone from the PWA; the character web is in it. Trash and EPUB export are in mobile. See §19.

Source-confidence tagging used throughout:
- **[VERIFIED]** — confirmed directly by reading the current repo during this handoff.
- **[SESSION]** — established via direct implementation/testing earlier in the
  development session that produced this handoff, but not something the next
  agent can re-derive from a single file read (e.g. "we tested X and it worked
  on a real device"). Treated as reliable but not machine-checkable.
- **[UNVERIFIED]** — stated in conversation or in `CLAUDE.md`, not confirmed
  against the current repo or a hosted resource this session has no access to
  (e.g. actual Supabase table schema/RLS, actual deployment host). Must be
  checked before being relied on.

---

## 1. PROJECT PURPOSE

**StoryMap** ("The Trail to Kailash") is a personal, single-user (per account)
writing tool for planning and drafting a five-book mythological saga. **[VERIFIED]**
`BOOKS = ["Book One"..."Book Five"]` is hardcoded — this app is scoped to exactly
one saga with exactly five books, not a general-purpose multi-book tool, though
each account can hold multiple independent **projects** (see §5, multi-project).

Intended workflow **[VERIFIED from feature set + CLAUDE.md, consistent with code]**:
1. Plan structure on the Map (Book → Act → Chapter → Scene), dragging chapters
   to reorder/reassign book+act.
2. Fill in scene metadata (POV, summary, requires/provides) before prose exists —
   scenes are metadata-only, they never hold prose themselves.
3. Draft chapter prose in the full-screen editor; flag Plants/Reveals/Notes inline
   as you write.
4. Use Continuity check, the Plant Ledger, Mythic Threads, and POV tracking to
   keep a 5-book saga's cross-references consistent without needing to re-read
   everything.
5. Read back finished/outline chapters in the in-app paginated Reader, or export
   the whole thing as an `.epub`.

**Established product principles [VERIFIED against code behavior throughout]:**
- **Flags, never hard limits.** Word-count targets, continuity gaps, orphan
  plants are advisory only — nothing blocks saving or writing.
- **Soft delete only.** Chapters/scenes/documents go to `trash` (restorable),
  never hard-deleted directly from normal UI flows. (Exception: deleting a whole
  *project* is a genuine hard delete with a typed-confirmation modal — see §5.)
- **AI is fully optional and gated.** Every AI-touching button is disabled
  unless `aiEnabled` is on; core functionality (write/organize/persist) works
  with AI off. **[VERIFIED]** — see §7 for the current broken state of AI calls.
- Aesthetic (Cinzel/Spectral fonts, dark parchment/leather palette, embedded
  map imagery) is a deliberate design choice, not a placeholder theme.
- Zero build step. This is one static HTML file plus three tiny static
  sidecar files — no bundler, no package.json, no node_modules. **[VERIFIED]**
  (`ls` shows no build tooling of any kind in the repo).

---

## 2. CURRENT REPOSITORY

```
E:\StoryMap\
├── index.html                          — the entire application (~4850 lines). HTML+CSS+JS in one file.
├── manifest.json                       — PWA manifest.
├── service-worker.js                   — PWA app-shell cache (Stage 1 offline support only).
├── supabase-config.js                  — SUPABASE_URL + anon key (public, safe client-side per Supabase design).
├── CLAUDE.md                           — original project brief. STALE — see note at top of this doc.
├── STORYMAP_CODEBASE_HANDOFF.md        — this file.
├── story-map-export-2026-08-05.json    — a JSON export taken 2026-08-05. LIKELY PRE-DATES the UUID
│                                          migration (see §6) — DO NOT import into the current app
│                                          without checking ID formats first (§7).
├── icons/
│   ├── icon-192.png                    — placeholder PWA icon (simple gold mountain motif).
│   └── icon-512.png                    — placeholder PWA icon, same motif.
├── git                                 — [VERIFIED] a stray, empty (0-byte) file literally named "git" in
│                                          the repo root. Origin unknown/unresolved (see §7). Left untouched
│                                          per explicit user instruction in a prior session — do not delete
│                                          without asking, and do not assume it's safe to ignore either.
└── .claude/                            — Claude Code local settings (permissions, etc.), untracked.
```

There is no `package.json`, no `node_modules`, no bundler config, no test
suite, no CI config, no `.gitignore`, and no server-side code beyond the
static `service-worker.js`. **[VERIFIED]**

**Frontend**: all of `index.html` — inline `<style>` block (~590 lines), inline
`<script>` blocks (~4250 lines), inline SVG map rendering, inline base64/asset
usage where present.

**Backend**: none owned by this repo. All persistence and auth go through a
hosted Supabase project (`supabase-config.js` → project ref `lqjhxogravonkfpmtxtm`).
There is no Edge Function, no serverless function, no proxy of any kind in this
repo. **[VERIFIED — absence confirmed by directory listing]**. This matters a
lot for the AI features — see §5 and §7.

**Configuration**: `supabase-config.js` (connection details only, no secrets
beyond the public anon key).

**PWA**: `manifest.json` + `service-worker.js`, both minimal, both described
in full in §5/§6.

**AI**: no server-side AI code exists. Client-side calls to
`https://api.anthropic.com/v1/messages` exist directly inside `index.html`
with no API key attached — see §7, this is effectively non-functional outside
the original Claude.ai sandbox.

**Assets**: two small PNGs in `icons/`. The large embedded map background
image mentioned in `CLAUDE.md` is presumably inline in `index.html`'s CSS/HTML
(not independently verified byte-for-byte in this handoff pass, but the file's
688KB size is consistent with an embedded base64 image).

**Tooling**: none. Development/testing in this session was done by copying
`index.html` into a scratchpad, injecting a mock Supabase client, and serving
via a throwaway `python -m http.server` + a `.claude/launch.json` preview
config — see §10 for why this matters to the next agent.

---

## 3. CURRENT ARCHITECTURE

**Single-file, no-framework, hand-rolled DOM manipulation.** Everything is
global functions and global `let`/`const` state at the top of the main
`<script>` block (see §3.1). Rendering is done by wholesale re-generating
`innerHTML`/SVG children for the relevant container, not by any virtual-DOM
diffing or component model.

### 3.1 State management **[VERIFIED]**

All state is module-level (global) `let` variables declared near the top of
the script (~line 1092 onward). No store/reducer pattern, no reactivity system
— every mutation is followed by an explicit call to a `render*()` function and
usually `saveData()`. Key state:

- `chapters`, `scenes`, `documents`, `stickyNotes`, `trash` — the five
  persisted entity arrays (mirror of the five Supabase tables, see §4).
- `actLabels`, `chapterWordTargets`, `aiEnabled`, `viewMode`, `projectBookmarks`
  — persisted per-project settings (mirror of the `project_settings` table).
- `currentProjectId`, `currentProjectName` — which project is currently open.
- `nextId` — legacy auto-increment counter, **now used only for nested
  annotation IDs** (`chapter.annotations[].id`), not for any top-level entity
  (see §6, UUID migration).
- `selectedChapterId`, `editorChapterId`, `editorReturnTo` — which chapter the
  drawer/editor currently targets.
- `dragState`, `lastNodeInteractionEndTime`, `lastPositions`, `layoutBands`,
  `bandRects` — map drag/touch interaction state (fragile area, see §6/§9).
- `readerFontFamily`, `readerFontSizePt`, `readerAspectMode`, `readerTextAlign`,
  `readerCurrentBookIndex`, `readerCurrentPage`, `readerTotalPages`,
  `readerPageStepPx`, `readerChapterStartPages` — in-app Reader state.
- `DEBUG_TOUCH_OVERLAY`, `debugTouchState`, `debugTouchEl` — **temporary
  diagnostic overlay, currently `true`/enabled and committed (it has shipped
  in every deploy this whole session — "temporary" here means "meant to be
  removed eventually," not "not yet committed").** Still actively needed for
  the ongoing Map-drag `pointercancel` investigation (§6/§9) — do not remove
  until that's confirmed fixed on the real device. This remains the single
  most important "don't forget about this" item in the handoff.

### 3.2 Data flow / persistence flow **[VERIFIED]**

- `loadData()` — on entering a project, fetches all five entity tables plus
  `project_settings` filtered by `user_id` + `project_id`, maps snake_case DB
  columns to camelCase JS object shapes, and populates the global arrays.
  Creates a default `project_settings` row if none exists yet. On any error,
  **silently resets all state to empty** and logs to `console.error` only —
  there is no user-facing error surface for a failed load.
- `saveData()` — maps all five global arrays back to snake_case row shapes and
  `upsert()`s each table, plus a `project_settings` upsert. **Every call
  re-upserts every row in every array that has ≥1 item** — this is per-row
  upsert (not one JSON blob), but it is **not granular per-entity** (editing
  one chapter still re-sends every chapter, scene, document, sticky note, and
  trash row on every save). `CLAUDE.md`'s "deferred" note about per-row writes
  is half-true: the blob-storage problem is fixed, the granularity problem is not.
  **Also silently swallows all errors** (`catch(err) => console.error(...)`,
  no rethrow, no UI feedback) — this was directly responsible for a real,
  hard-to-diagnose bug earlier in this session (bookmark saves silently not
  persisting) — see §6.
- Almost every mutating UI action calls `saveData()` directly (fire-and-forget,
  not awaited by the caller in most cases) after updating the in-memory array.
- `render()` → `applyViewMode()` → either `renderMap()` or `renderListView()`
  depending on `viewMode`. Most sub-features have their own
  `render<Feature>()` function that rebuilds one specific screen's DOM from
  current global state on demand (not automatically reactive — must be called
  explicitly after any relevant mutation).

### 3.3 Authentication flow **[VERIFIED]**

Plain Supabase email/password auth (`signInWithPassword` / `signUp`), no OAuth,
no magic link. Flow, driven by `sbClient.auth.onAuthStateChange`:
`auth-screen` (signed out) → `project-screen` (signed in, no project chosen)
→ `app` root (project chosen, `enterProject()` called → `initApp()` →
`loadData()` → `render()`). Sign-out and "switch project" both route back
through `showAuth()`/`showProjectScreen()`. There is a `project_type` column
on `projects` with a branch point already written in `enterProject()` for a
future non-`'writing'` project type, but `'writing'` is the only type that
currently exists or has any handling.

### 3.4 Frontend/backend boundary **[VERIFIED]**

The "backend" is entirely Supabase's hosted REST layer (via `supabase-js`
loaded from a CDN) plus Supabase Auth. There is **no first-party server code**
anywhere in this repo. The only place this boundary is currently violated is
the AI feature's direct `fetch()` to `api.anthropic.com` from client JS — see
§7, this is a known, unresolved architectural gap, not a design decision.

### 3.5 Editor architecture **[VERIFIED — current state differs from CLAUDE.md]**

`CLAUDE.md` describes the editor as "textarea + synced highlight-layer overlay."
**That is no longer how it works.** The current editor (`#editor-content`) is a
`contenteditable="true"` `<div>` that has inline `<mark class="hl-plant|hl-reveal|hl-note">`
tags injected directly into its `innerHTML` on every render pass
(`renderAnnotatedContent()`). Supporting mechanics, all load-bearing and all
fragile:
- `getCaretOffset()` / `setCaretOffset()` / `getPlainTextRange()` — manually
  walk text nodes to save/restore caret position across every re-render
  (`reRenderEditorKeepingCaret()`), since replacing `innerHTML` would otherwise
  reset the cursor to the start on every keystroke.
- A `beforeinput` handler intercepts `insertParagraph`/`insertLineBreak` and
  manually inserts a plain `\n` text node instead of letting the browser insert
  `<div>`/`<br>` — this keeps the DOM restricted to plain text nodes + `<mark>`
  wrappers only, which the caret-offset math and the annotation re-matching
  logic both depend on.
- A `paste` handler force-strips to plain text for the same reason.
- Annotations locate themselves by **searching for the exact flagged substring**
  in the current text (`text.indexOf(a.text)`) on every render — they do not
  track a fixed offset. If the surrounding prose is edited enough that the
  substring no longer matches, the annotation stops rendering inline but is
  **not deleted** (this specific behavior is confirmed unchanged from what
  `CLAUDE.md` describes, and is still a known, accepted limitation).

**Do not "simplify" this editor back to a plain textarea** without
understanding that the inline-`<mark>` rendering, not a separate overlay, is
what currently produces the visual highlight — that would be a regression, not
a cleanup.

---

## 4. DATABASE / SUPABASE

**[UNVERIFIED — hosted-only]** This entire section describes what the *client
code assumes* the schema looks like, inferred from `loadData()`/`saveData()`/
the auth+project script. **The actual live Supabase schema, RLS policies, and
any constraints/indexes have not been inspected in this handoff** — this
session only has the public anon key, not schema/admin access. A prior
diagnostic session in this same development history confirmed the `bookmarks`
column exists on `project_settings` via a REST probe (a request for a
non-existent column returns Postgres error `42703`; a request for `bookmarks`
did not), but that is the only schema fact actually confirmed against the
live database rather than inferred from client code.

### Tables the client code uses **[VERIFIED from code, NOT from live schema]**

- **`projects`** — columns referenced: `id`, `user_id`, `name`, `project_type`,
  `created_at`. One row per project; `project_type` is always `'writing'` in
  practice today.
- **`chapters`** — `id` (uuid), `user_id`, `project_id`, `book`, `act`,
  `order`, `title`, `status`, `content`, `notes`, `annotations` (jsonb array),
  `versions` (jsonb array), `updated_at`.
- **`scenes`** — `id` (uuid), `user_id`, `project_id`, `chapter_id`, `order`,
  `title`, `status`, `summary`, `requires` (jsonb array), `provides` (jsonb
  array), `deferred_requires` (jsonb array), `notes`, `pov`, `updated_at`.
- **`documents`** — `id` (uuid), `user_id`, `project_id`, `title`, `type`,
  `content`, `updated_at`.
- **`sticky_notes`** — `id` (uuid), `user_id`, `project_id`, `content`,
  `created_at`, `rotation`.
- **`trash`** — `id` (uuid), `user_id`, `project_id`, `type`, `payload`
  (jsonb — the soft-deleted entity's full data), `deleted_at`.
- **`project_settings`** — one row per `project_id` (used as a de facto
  primary/unique key for upsert purposes): `act_labels` (jsonb),
  `chapter_word_targets` (jsonb), `ai_enabled` (bool), `view_mode` (text),
  `bookmarks` (jsonb, confirmed present on the live DB — see above).

### Authentication **[VERIFIED from code]**
Supabase Auth, email+password, no third-party providers wired up in the client.

### RLS policies **[VERIFIED 2026-08-27 for five tables — see §23.3]**
Every query in the client filters by `user_id`/`project_id` manually, and **no
policy definitions exist anywhere in this repo**, so what follows was read off
the live project rather than from source.

`chapters`, `scenes`, `documents`, `projects` and `sticky_notes` **all have RLS
enabled with exactly one policy each**. The one policy read in full is
`sticky_notes`': `auth.uid() = user_id`, `ALL`, on both `qual` and `with_check`.
The other four match it in shape (one policy, `ALL`) but their definitions have
not been read.

So the old warning here — that the manual filters might be the *only* thing
preventing cross-account access — is **resolved for these five tables**.
Cross-account isolation is enforced server-side.

**What is not resolved**: that policy is **user-scoped, not project-scoped**.
Project separation really is a client-side convention with no database boundary
behind it, exactly as the sentence above feared for *accounts*. It is harmless
today (one writer, one account) and it is the assumption to revisit before
anything is ever shared or multi-user. Tables outside this five — the graph
tables, `project_settings`, `trash`, `health_marks` — remain unread.

### Migrations / schema changes known from session history **[SESSION]**
- `bookmarks` column added to `project_settings` via a manual `ALTER TABLE`
  the user ran themselves (this session's agent cannot run DDL — only has the
  anon key). Confirmed present via REST probe (see above).
- No migration files exist in the repo for any schema change — all schema
  evolution so far has happened by hand directly against the hosted project.
  **[UNVERIFIED]** whether any other manual schema changes happened outside
  what's reflected in current client code.

### Edge Functions / server-side code
**None exist.** **[VERIFIED — absence]**

### API integrations
- Supabase JS client, loaded from CDN (`@supabase/supabase-js@2`), not vendored.
- `api.anthropic.com/v1/messages` — called directly from client JS with no
  auth header. See §7, this is broken outside the original sandbox.
- JSZip, loaded from CDN (`jszip@3`), used for client-side `.epub` generation.
- Google Fonts, loaded via CSS `@import`.

---

## 5. COMPLETE CURRENT FEATURE INVENTORY

| Feature | Status | Notes |
|---|---|---|
| Project management (create/rename/delete/switch) | **COMPLETE** [VERIFIED] | Full CRUD in the auth+project script; delete requires typing the project name to confirm; delete is a genuine hard delete (no trash) by design. |
| Multi-project support | **COMPLETE** [VERIFIED] | Contradicts `CLAUDE.md`'s "deferred" note — this was fully built since that brief was written. Every entity table has `project_id`; every query filters by it. |
| Map view | **COMPLETE** [VERIFIED], fragile | SVG-rendered Book→Act→Chapter trail. Drag-to-reorder works on desktop and (after this session's fixes) touch. See §6/§9 for the exact fragility. |
| List view | **COMPLETE** [VERIFIED] | Accordion Book→Act→Chapter, independent of Map view, preference persisted via `viewMode`. |
| Books/Acts/Chapters/Scenes hierarchy | **COMPLETE** [VERIFIED] | Acts are inferred from chapters' `act` integers, not a stored entity, exactly as `CLAUDE.md` describes — this part of `CLAUDE.md` is still accurate. |
| Chapter drawer | **COMPLETE** [VERIFIED] | Position, status, scenes, word count vs. target, annotation widgets, delete-to-trash, Thread button. |
| Full-screen chapter editor | **COMPLETE** [VERIFIED], architecture changed | `contenteditable`-based, not textarea+overlay — see §3.5. Fragile; do not casually refactor. |
| Autosave | **COMPLETE** [VERIFIED] | 1200ms debounce after any edit, via `handleEditorContentChanged` → `autosaveChapter()`. |
| Undo/redo | **PLANNED / NOT IMPLEMENTED** [VERIFIED — absence] | No undo/redo mechanism found anywhere in the code. Version history (below) is the only rollback mechanism, and it's manual/per-save-snapshot, not a true undo stack. |
| Version history | **COMPLETE** [VERIFIED] | `pushVersionSnapshot()` on every autosave/save, capped at last 10, restorable via the Version modal. |
| Plant/Reveal/Note annotations | **COMPLETE** [VERIFIED] | Inline flagging, soft-suggested/hard-linked Plant↔Reveal matching by keyword overlap (`scorePlantMatch`), editable labels. |
| Plant Ledger | **COMPLETE** [VERIFIED] | `renderLedger()` — saga-ordered, paid/open status via the hard-link system. |
| Continuity check | **COMPLETE** [VERIFIED] | Keyword-overlap only (not AI), matches `CLAUDE.md`'s description; supports deferred/"not due yet" requirements. |
| Mythic Threads | **COMPLETE** [VERIFIED] | Free-text thread tagging on Notes, saga-ordered browsable index. |
| POV tracker | **COMPLETE** [VERIFIED] | Autocomplete via `<datalist>`, index with scene counts, full-screen per-POV browser. |
| Documents library | **COMPLETE** [VERIFIED] | Master Bible / character bibles / etc., free-text, own editor screen. |
| Sticky Notes ("The Margin") | **COMPLETE** [VERIFIED] | Parchment-card idea capture, autosave, badge count. |
| Search | **COMPLETE** [VERIFIED] | Full-text across chapters/scenes/documents/sticky notes with highlighted snippets. |
| Trash | **COMPLETE** [VERIFIED] | Soft-delete/restore/permanent-delete for chapters/scenes/documents. |
| Import/Export (JSON) | **PARTIAL** [VERIFIED] | Export works cleanly. **Import does not migrate/validate ID formats** — importing an export from before the UUID migration (e.g. the `story-map-export-2026-08-05.json` sitting in this repo) will load non-UUID `id` values that will very likely fail against the current UUID-typed Supabase columns on the next save. See §7. |
| Reader (in-app paginated) | **COMPLETE** [SESSION, heavily verified this session] | CSS multi-column pagination trick, Landscape/Portrait toggle, position slider, per-book bookmarks with resume prompt, font/size/alignment controls. Extensively tested this session — see §6. |
| EPUB export | **COMPLETE** [VERIFIED] | Client-side `.epub` generation via JSZip, shares `compileBook()` with the Reader. |
| Word-count targets | **COMPLETE** [VERIFIED] | Two independent systems: `BOOK_TARGETS` (hardcoded whole-book totals, display-only rollup) and `chapterWordTargets` (user-editable per-book, applies to every chapter in that book, persisted). Don't confuse the two. |
| AI features (scene-summary sync, Bible consistency check) | **BROKEN outside the original sandbox** [VERIFIED] | Client calls `fetch("https://api.anthropic.com/v1/messages")` with **no API key attached at all**. This is the exact "Claude-artifact-only proxy" dependency `CLAUDE.md` flagged as needing a serverless replacement — that migration **has not happened**. These two buttons will fail (network/auth error) in the real deployed app today. |
| Authentication | **COMPLETE** [VERIFIED] | Supabase email/password, working end-to-end per session history. |
| Supabase persistence | **COMPLETE, not granular** [VERIFIED] | See §3.2 — works, but every save re-upserts every row of every populated table. |
| PWA (installability) | **COMPLETE for Stage 1 scope** [VERIFIED] | Manifest + app-shell-only service worker. Explicitly does NOT cache/enable offline data — Supabase calls always hit the network. Confirmed via real offline test (server killed, page still loaded from cache) earlier this session. |
| Mobile / responsive behavior | **COMPLETE across map/header/editor/reader/drawer/mark-toolbar/annotation-panel** [SESSION, heavily verified across multiple follow-on sessions] | See §6 — many rounds of real fixes, well past the original handoff's scope. The chapter drawer (responsive width, no more skew), the editor's mark-toolbar (compact right-anchored dropdown, inactivity auto-close), and the annotation side panel (full-screen on mobile, larger edit textarea) — all previously explicitly deferred — have since been done. List view and the hamburger nav drawer were additionally given a full visual redesign (parchment/gilded concept) — see the dedicated subsection in §6. |
| Offline functionality (data) | **NOT IMPLEMENTED, explicitly out of scope for now** [VERIFIED] | Only the static app shell works offline (per PWA Stage 1). Chapters/scenes/etc. require a live connection to load or save. This is a deliberate staged scope, not an oversight. |

---

## 6. IMPLEMENTATION HISTORY THAT MATTERS

### UUID migration **[VERIFIED from code, mechanism not narrated in visible session history]**
Top-level entities (`chapters`, `scenes`, `documents`, `stickyNotes`, `trash`,
`projects`) now use `crypto.randomUUID()` for their `id`. The **shared
auto-increment `nextId` counter described in `CLAUDE.md` still exists but is
now scoped to exactly one thing**: `chapter.annotations[].id` (nested
Plant/Reveal/Note items inside a chapter). `loadData()` recomputes `nextId` on
every load by scanning existing annotation IDs across all loaded chapters —
there is no `nextId` column in Supabase; it's purely a client-side runtime
value. **Consequence**: any exported JSON from before this migration (e.g.
`story-map-export-2026-08-05.json`) has plain-integer top-level IDs that will
not round-trip cleanly through the current Import path (§5/§7). A separate,
one-time function (`uploadLocalDataToSupabase()`) exists specifically to
migrate old `localStorage['storymap-v2']` data into Supabase with fresh UUIDs
and remapped foreign keys — this is the *only* import path that does ID
remapping correctly; the regular Import button does not.

### Map touch interaction (multi-round fix, the most debugged area this session) **[SESSION, extensively verified]**
This went through several rounds because each fix uncovered a different real
bug layered underneath the last one. In order:
1. **Act-cluster rect made clickable** (to open the act popup) during the
   mobile touch-target pass — this was fine in isolation but set up later bugs.
2. **First reported bug**: tapping a chapter node opened the act popup
   instead. Root cause found: chapter nodes use `pointerdown`/`pointermove`/
   `pointerup` with a 4-SVG-unit movement threshold to distinguish tap from
   drag; on touch (where the map renders at ~1:1 SVG-unit-to-CSS-pixel scale),
   ordinary finger jitter routinely exceeds 4 units, misclassifying taps as
   drags. Fixed by using a **touch-only** 10-unit threshold **plus a 500ms
   duration cap** (mouse behavior — 4 units, no time check — deliberately left
   untouched).
3. **Second reported bug** (after the above fix): tapping dead-center on a
   chapter's number still failed. Root cause: `.node circle.halo` (a 50px
   invisible circle meant to enlarge the node's tap target beyond the 30px
   solid `.core` circle) had `fill:none`, which under SVG's default
   `pointer-events:visiblePainted` made it **completely non-hit-testable** —
   confirmed directly via `elementFromPoint()` at a point 20px off-node-center
   resolving to the act-cluster rect underneath, not the halo. Fixed two ways
   together: (a) `pointer-events:all` on `.halo`, scoped to
   `@media (pointer:coarse)` so desktop mouse hit-testing is provably
   unchanged, and (b) the pointer handlers were **attached directly to every
   sub-element** (`icon`, `label`, `scene-count`, `halo`, `core`, not just the
   `g` wrapper) as defense against engines where `pointer-events:none` on SVG
   `<text>` isn't reliably honored for touch — also added `user-select:none` /
   `-webkit-tap-highlight-color:transparent` to rule out native text-selection
   gesture hijacking as a contributing cause.
4. **Third reported bug** (confirmed via real-device telemetry from a
   temporary on-screen debug overlay, since USB remote debugging to the test
   device could not be established): pointerdown now correctly registered
   "last target: halo", but the outcome still resolved to the act popup. Root
   cause: pointer **capture** correctly redirects `pointerup` to the node, but
   the browser's synthesized compatibility `click` event (which is what the
   act-cluster rect's plain `'click'` listener responds to) is still
   hit-tested at the raw release coordinates on some touch engines, ignoring
   capture — so a "ghost click" can land on the rect immediately after a node
   tap already correctly opened its chapter. Fixed with a **400ms suppression
   window**: any click on the act-cluster rect/label within 400ms of a
   touch-originated node interaction ending is treated as a ghost click and
   ignored (`lastNodeInteractionEndTime`, touch-only — mouse never sets it, so
   desktop is unaffected by construction).
5. **This fix (step 4) is implemented but is the most recent uncommitted
   change in the working tree and has NOT yet been confirmed on the real
   device** — see §9. Do not assume the map's touch interaction is fully
   closed out; assume round 4 needs real-device confirmation before it's trusted.

A **temporary on-screen debug overlay** (`DEBUG_TOUCH_OVERLAY`) was added
specifically to diagnose round 3/4 above, since USB remote debugging never
achieved a stable connection to the physical test device across a full
authorization reset. It is currently **enabled (`true`) in the working tree**
and renders a live, fixed-bottom, semi-transparent readout showing pointerdown
count, last `pointerType`, last target sub-element, last outcome, and any
caught error. It is self-contained in one clearly marked block
(`/* ========== TEMP TOUCH-DEBUG OVERLAY ... ========== */`) plus a handful of
`if(DEBUG_TOUCH_OVERLAY) debugTouchLog(...)` call sites inside the map's
pointer handlers and the act-cluster click handlers. **Flip the flag to
`false` or delete the block once the round-4 ghost-click fix is confirmed —
do not ship this to real users.**

### Reader page breaks **[SESSION]**
The paginated in-app Reader uses a CSS multi-column trick (`column-width`/
`column-gap` both set to the measured viewport width, page-turn via
`translateX`). A reported "chapters don't start on a new page" bug turned out
to have **never been implemented at all** — there was no `break-before` rule
anywhere in the CSS or git history, only a `margin-top` visual-spacing hack
that looked like a page break but wasn't one. Fixed with a real
`break-before:column` (plus `-webkit-column-break-before:always` for broader
engine support) on `.reader-chapter:not(:first-child)`.

### Mobile responsiveness (multi-stage) **[SESSION, extensively verified]**
- **Missing viewport meta tag** was the single biggest hidden blocker,
  discovered while testing something else entirely: without
  `<meta name="viewport" content="width=device-width, initial-scale=1">`
  (which did not exist before this session), mobile browsers render the page
  in a phantom 980px virtual viewport and scale down — meaning every other
  mobile fix (touch targets, `vw`-based modal widths, the 16px input-zoom fix)
  would have silently done nothing on a real device. This is now fixed
  (`index.html` line 5) and is a **prerequisite everything else in this
  section depends on** — do not remove it.
- All modal/panel fixed pixel widths converted to
  `max-width:[N]px; width:min(95vw,[N]px)` so they cap to the screen on
  narrow viewports but render identically to before above the breakpoint.
- Touch targets audited to ~44×44px across header buttons, list rows, and
  small icon buttons, using `min-height`/`min-width` (safe on transparent
  elements) rather than changing visible glyph size.
- Every `<input>`/`<textarea>` bumped to `font-size:16px` (prevents iOS
  zoom-on-focus). One real gotcha found and fixed: a single high-specificity
  `#drawer-body input[type=text], #drawer-body textarea, ...` rule was
  silently overriding several lower-specificity per-class fixes back down to
  13px — fixed at that shared rule, not by chasing each override individually.
- **Header hamburger menu** (mobile only, ≤700px breakpoint — the same
  breakpoint already used elsewhere in the CSS): Map/List toggle and
  "+ Add chapter" stay always visible; everything else collapses behind a ☰
  into a dropdown. Implementation note that matters if this is ever touched
  again: the first attempt wrapped the collapsible buttons in a new container
  div, which **changed their visual order on desktop** (a real regression,
  caught via screenshot comparison) because "+ Add chapter" sits in the middle
  of the original button sequence, not at either end. Fixed by using a
  `.hdr-collapsible` **class** on individual buttons (no reordering, no
  wrapper) plus CSS `order` — desktop keeps the exact original DOM order and
  the hamburger/collapse behavior is 100% CSS-driven for mobile only.
- **Editor header Close button was confirmed unreachable on a real phone**
  (the reported bug: users could get trapped in the editor with no way out
  except signing out). Root cause: `#editor-head` had no `flex-wrap`, and the
  mark-toolbar + History + Close buttons' combined width exceeded phone width
  even with the title crushed to zero, and since the app has global
  `overflow:hidden`, the overflow was invisible/unreachable rather than
  scrollable. Fixed the same way as the main header: mark-toolbar + History
  collapse behind their own ☰ (`#editor-menu-btn`/`#editor-menu-panel`, using
  a `display:contents` wrapper this time, which is safe here because there's
  no pinned button sitting in the middle of that particular sequence); `Close`
  is structurally outside the collapsible group with `flex-shrink:0`, so it is
  now **always** visible regardless of menu state.

### Project/multi-project migration **[VERIFIED present in code; narrative not in visible session history]**
Fully implemented (see §5) — this directly supersedes `CLAUDE.md`'s
"deferred to the real build" note on multi-project support. No further work
needed here architecturally; treat `projects`/`project_id` as a settled,
load-bearing part of the schema, not a future task.

### PWA filename rename **[SESSION]**
The app file was renamed `story_map.html` → `index.html` specifically so
static hosts serve it at the site root by default. This required more than a
file rename: `manifest.json`'s `start_url` was updated, and the service
worker's cached-URL list needed **both** `'./'` and `'index.html'` as separate
cache entries — they are genuinely different request URLs even though a
static host resolves both to the same file, so caching only one of them would
have left the bare-root URL uncached and failing offline.

### Round-4 ghost-click fix — CONFIRMED **[SESSION]**
The map ghost-click suppression window described above (§6, step 4) has
since been confirmed working on the real device: real-device telemetry
showed `"overlay click suppressed - ghost click after node tap"` firing
correctly, and tap-to-open now reliably opens the chapter drawer instead of
the underlying Act popup. This closes out the round-1-through-4 map ghost-
click saga described earlier in this section — **do not reopen or rework
this specific mechanism** (`lastNodeInteractionEndTime`, the 400ms window,
the `pointer-events:all` + `@media(pointer:coarse)` halo fix) without new
real-device evidence that it's actually broken again.

### Service worker cache versioning — critical fix, was silently blocking every other fix **[SESSION]**
`service-worker.js` used a hardcoded `CACHE_VERSION` that never changed
between deploys, with a pure cache-first fetch strategy and no
`self.skipWaiting()`. Practical effect: **every fix pushed to devices in
this session was invisible on a real phone until this was found** — the
service worker kept serving the exact `index.html` snapshot from first
install, forever, regardless of how many new commits were deployed. Fixed by
bumping `CACHE_VERSION` and adding `self.skipWaiting()` so a version bump
actually takes effect on next load instead of requiring every tab on the
site to be fully closed first. **Consequence for future work**: any
CSS/JS/HTML change to the app shell (`index.html`, `manifest.json`,
`supabase-config.js`) needs `CACHE_VERSION` bumped again in
`service-worker.js`, or it will not reach real devices no matter how many
times they reload. There is no automatic versioning — it's a manual bump,
easy to forget, and forgetting it looks exactly like "the fix didn't work"
from the user's side. **Testing implication**: after every deploy, the user
must fully close and reopen the app (not just reload) on their phone for the
service worker update to take over.

### Map-mode touch-drag reorder — separate bug from the ghost-click fix, multi-round investigation, current status: fix pushed, NOT YET real-device-confirmed **[SESSION]**
Distinct from the tap-to-open ghost-click saga above — this is about
press-and-drag reordering specifically. Went through several rounds, each
disproven by real-device evidence before moving to the next theory (the
same "don't guess, get evidence" discipline as the ghost-click rounds):
1. **Verified the underlying reorder logic itself is sound** by dispatching
   real `pointerType:'touch'` `PointerEvent` sequences directly (not
   clicks) — forward and backward reorder both worked correctly, reusing
   the same `handleDrop()` mouse uses. This ruled out "native HTML5
   drag-and-drop doesn't fire on touch" as the cause — the app never used
   native drag-and-drop; it's Pointer Events end to end.
2. **Real-device evidence** (via the same on-screen `[TOUCH DEBUG]` overlay
   pattern used for the ghost-click rounds) showed `pointerdown` firing,
   then **nothing further** — no threshold-crossed, no tap, no drag outcome.
   The gesture silently died.
3. **First theory, disproven**: Android long-press context-menu arbitration
   cancelling the touch. Added `contextmenu` `preventDefault()` +
   `-webkit-touch-callout:none`. Real-device retest: `pointercancel` still
   fired, still `moved=false`. Kept the fix anyway (harmless, standard
   practice) but it wasn't the cause.
4. **Second theory, disproven**: `svg.appendChild(g)` (bring-dragged-node-
   to-front) was called *after* `g.setPointerCapture(e.pointerId)` in
   `handlePointerDown` — re-parenting an already-attached DOM node is a
   remove+reinsert per the DOM spec, which can implicitly release pointer
   capture on some engines. Reordered so the DOM move happens before
   capture is acquired. Real-device retest: `pointercancel` **still**
   fired, still `moved=false`.
5. **Third theory, current fix, not yet real-device-confirmed**: a
   `resize`-triggered `renderMap()` (added earlier for the portrait
   Map-sizing fix, see below) does `svg.innerHTML=''` and rebuilds every
   node from scratch. Android can dispatch a `resize` event mid-touch when
   its toolbar animates during touch-scroll gesture arbitration, whether or
   not real scrolling ends up happening. If that fires while a drag is in
   progress, it destroys the exact `<g>` element holding pointer capture —
   which fits the evidence (instant cancellation, zero movement) far better
   than either prior theory. Fixed by guarding the resize handler on
   `dragState` (checked both immediately and after the debounce, since a
   drag can start/end within that window) so an active drag is never
   rebuilt out from under itself. **Verified in a JS-driven test** (a
   `resize` event dispatched mid-synthetic-drag no longer destroys the node
   or clears `dragState`, while a resize with no active drag still
   re-renders normally) — **but per this document's own standard, a
   synthetic/simulated test is not proof of real-device correctness for
   anything touch-related. This needs the user to retest the actual drag
   gesture on their phone before being treated as fixed.**

`DEBUG_TOUCH_OVERLAY` (see §3.1/§6 above) is **still enabled** specifically
to carry this investigation — do not remove it until round 5 above is
confirmed. It has been shrunk from ~4-5 wrapped lines (~100-150px, which
was itself confirmed to be the cause of a separate false "drawer won't
scroll" report — see below) to a single truncated line.

### Map portrait/landscape sizing **[SESSION]**
Map's SVG `viewBox` height was a fixed `640` (tuned for landscape/desktop),
which on a portrait phone (usually taller than 640 CSS px of available
height) just added unused letterboxing above/below via
`preserveAspectRatio`'s default `meet` behavior, rather than using the
screen it was actually given. `getMapVerticalMetrics()` now sizes the
viewBox height (and derives `Y_MID`/`AMPLITUDE`) from `#map-wrap`'s real
available height, but **only in portrait** (`matchMedia('(orientation:
portrait)')`); landscape and desktop keep the original fixed 640/340/120
unchanged. `#map-wrap`'s `overflow-y` was also changed from `hidden` to
`auto` as a defensive fallback. A `resize`-triggered re-render was added so
rotating the device re-lays-out the map — **this is the same resize
listener responsible for the Map-drag `pointercancel` bug above**; if this
listener is touched again, re-read that subsection first.

### Landscape phones falling through to the full desktop button row **[SESSION]**
All mobile-breakpoint CSS was gated purely on `@media (max-width: 700px)` —
no `pointer` check at all. A landscape phone's width (commonly 700-900px+)
fails that check and falls through to the full un-collapsed desktop header
row, causing severe button overlap/wrapping. Fixed by changing all three
`@media (max-width: 700px)` blocks in the file to
`@media (max-width: 700px), (pointer: coarse) and (max-width: 900px)`, so a
touch device stays collapsed in both orientations while desktop/mouse at
the same CSS widths is unaffected. **Verified at 750px width with coarse
pointer emulated** (the old rule alone fails there, the new one correctly
collapses the header) and **at 1280px with fine pointer** (full row
unaffected) — the true 800-900px-with-real-touch-hardware case could not be
tested in the available browser tooling (its touch emulation only goes up
to 768px wide) and should be spot-checked on an actual phone in landscape
if this area is touched again.

### List view + hamburger nav drawer — full visual redesign **[SESSION]**
Both were redesigned from scratch to match an approved parchment/gilded
design reference (two concept images), replacing what had drifted into
plain default-ish styling. This was **layout/presentation only** — no nav
item's behavior, click handler, or underlying data changed; every existing
`id` was preserved so `document.getElementById(...).addEventListener(...)`
call sites kept working unmodified.

**What's real vs. placeholder in this redesign — be honest about this with
the user, don't claim finished art that doesn't exist:**
- **Book cover art**: genuine slot architecture
  (`getBookCoverUrl(bookIndex)` as the single resolution point, checked
  before rendering an `<img>` vs. the CSS placeholder), but **no actual
  artwork exists** — confirmed by checking `icons/` (only the two PWA
  icons exist, no book/character key art anywhere in the repo). Every book
  currently renders the CSS-gradient placeholder.
- **Paper/leather texture**: `--texture-parchment`/`--texture-leather`
  custom properties, implemented as `feTurbulence`-based inline-SVG
  procedural noise layered into each surface's `background-image` stack via
  `background-blend-mode`. This is explicitly a placeholder for real
  scanned/generated texture assets — procedural turbulence noise reads as
  mechanical/uniform up close and does not have the organic aged quality of
  the design reference. Swapping either custom property for a real seamless
  tile image later is a one-line change per the properties, not a rewrite.
- **Icon set**: 17 nav icons replaced from emoji to a shared inline-SVG
  `<symbol>`/`<use>` sprite, single consistent stroke weight, `var(--gold)`.
  Deliberately simple/geometric placeholders, not the richly illustrated
  icon style in the design reference — flagged as a follow-up asset need,
  not resolved in this pass.
- **Ornamental frame**: real (not placeholder) — a reusable inline-SVG
  compass-star flourish (`--flourish` custom property) at the corners of
  both the app shell and the hamburger panel, CSS double-border treatment.
  Good enough to ship as final, not marked as needing replacement.

**Real bugs found and fixed during this redesign pass** (worth knowing about
as patterns, since more than one of them recurred):
- **CSS shorthand property collision, found twice**: `background:
  linear-gradient(...)` (shorthand) followed later in the same rule by a
  separate `background-image:` declaration for the corner flourishes — the
  second declaration silently overwrites the shorthand's implicit
  `background-image`, discarding the gradient. This was the actual cause of
  a real, confirmed-on-device bug where the hamburger drawer rendered fully
  transparent and visually bled through with the List view underneath it
  (initially misdiagnosed as a testing-tool screenshot artifact — it was
  not). **Pattern to watch for**: once `background-image` is going to carry
  multiple layers, use `background-color` for the solid base and put
  *everything* (including any gradient) into one single `background-image:`
  layer list — never mix the `background` shorthand with a later
  standalone `background-image` on the same element.
- **`flex-wrap` inherited from the base/desktop rule**: the hamburger
  panel's `.header-actions.menu-open` never overrode `.header-actions`'s
  base `flex-wrap:wrap`. Combined with `flex-direction:column`, content
  taller than the panel didn't scroll in place — it wrapped into a *second
  column* that spilled out past the panel's own border onto the List view
  underneath. Fixed with an explicit `flex-wrap:nowrap` override.
- **Shrink-to-fit width caused visible resizing**: an attempted fix sized
  the drawer via `width:auto;min-width:50vw;max-width:82vw` (content-driven)
  — this meant collapsing/expanding the Discover/Manage/Assist sections
  visibly changed the panel's width. Replaced with a fixed,
  viewport-derived-only `width:min(80vw, 300px)`, verified identical width
  regardless of expand/collapse state.
- **Hamburger button vertical misalignment**: `header-actions` wraps onto
  two rows on mobile (Map/List row, then `+Add chapter` wraps below);
  `header-menu-btn`'s parent (`header-right`) centered it
  (`align-items:center`) across that *combined* height, so it visually
  floated between the two rows instead of sitting level with Map. Fixed
  with `align-items:flex-start`.
- **`#header-menu-btn` had to move out of `#header-actions`**: once the
  hamburger panel became `position:fixed` (to be a full-height sliding
  drawer), any child of `#header-actions` — including the hamburger button
  itself, if left nested inside — would be swept into that fixed panel and
  disappear from the header row when opened. It now lives in a sibling
  `.header-right` wrapper instead. This also required updating the
  "click outside closes the menu" document-level listener to explicitly
  exclude `#header-menu-btn`, since it's no longer a descendant of
  `#header-actions` (previously excluded implicitly by nesting).
- **False "drawer won't scroll" report, resolved as not-a-bug**: real-device
  debug logging (`scrollHeight`/`clientHeight` on every touch event) showed
  the two values equal (content genuinely fit the viewport, e.g.
  `697 === 697`) even while the user reported being unable to scroll to see
  everything. The actual cause was the `[TOUCH DEBUG]` overlay itself — a
  separate, always-on-top, fixed-bottom element — visually covering the
  bottom ~100-150px of the drawer's real (already-fitting) content. Shrunk
  the overlay to a single line rather than removing it outright, since it's
  still needed for the Map-drag investigation above.

Desktop was explicitly re-checked after each of the above (all mobile-only
via the `@media` breakpoints and `display:contents` grouping-wrapper
pattern already established) — confirmed unchanged: same flat button row,
same 440px chapter drawer width, no visual regressions.

### StoryMap rebrand **[SESSION]**
"The Trail to Kailash" removed from every app-facing UI surface — the login
screen title, the header's `#app-project-name` placeholder, the page
`<title>`, and `manifest.json`'s `name` field — replaced with "StoryMap"
everywhere it appeared as the app's own branding. The header's small
subtitle line (under the project name) is now derived from `document.title`
at runtime rather than a second hardcoded copy of the same string, so it
can't drift out of sync with the page title again. `CLAUDE.md` and this
handoff doc were deliberately **not** rewritten to scrub "The Trail to
Kailash" — that's the saga's actual title (the content this tool exists to
help write), not app branding, and remains correct to reference by name in
project documentation.

---

## 7. KNOWN BUGS / TECHNICAL DEBT

**Confirmed bugs:**
- AI features (`editor-save-sync`, `check-bible-btn`) call
  `api.anthropic.com` directly from client JS with no API key — will fail
  outside the original Claude.ai sandbox. [VERIFIED]
- `saveData()` and `loadData()` both silently swallow all errors to
  `console.error` only, with no user-facing feedback. This directly caused a
  real, hard-to-diagnose incident earlier in this session (a bookmark write
  appeared to succeed in the UI but wasn't actually persisted) before the
  actual cause was traced. Any future "it looks like it saved but didn't"
  report should start here. [VERIFIED + SESSION]
- Import (regular JSON import button) does not validate or migrate ID formats
  — importing `story-map-export-2026-08-05.json` or any other pre-UUID export
  is likely to produce chapters/scenes with non-UUID `id` values that will
  fail on the next `saveData()` upsert against UUID-typed columns. Not
  reproduced/confirmed by actually attempting the import in this session —
  this is a reasoned risk from reading the code, not an observed failure.
  [VERIFIED code path; failure itself UNVERIFIED]
- A stray empty file named `git` sits in the repo root with unknown origin.
  Investigated in a prior session (ruled out: not created by any Claude Code
  tool call in that session, no git hook exists, no unusual git config) but
  never conclusively explained. Left in place per explicit user decision. [SESSION]

**Suspected / needs real-device verification:**
- **Map-mode drag-to-reorder `pointercancel` (round 6+, current — this is
  the SAME bug family as the old round-5 resize-guard fix, but round 5's
  specific diagnosis is now disproven).** Real-device testing (Chrome
  DevTools attached over wireless adb, both console instrumentation and
  timing analysis — see §9) found: (a) the resize-triggered `renderMap()`
  rebuild that round 5 guarded against has been **removed entirely** as
  part of the living-map Phase 1a work, since the map's layout no longer
  depends on viewport/orientation — so round 5's specific failure
  mechanism can no longer occur at all; (b) despite that, the underlying
  `pointercancel` bug is still real and pre-existing — confirmed present on
  the *old* build too, not a regression; (c) a full 17-attempt real-device
  test found a ~24% failure rate, including purely horizontal drags, which
  disproves an earlier "vertical-drag races with newly-real vertical
  scroll" hypothesis formed mid-investigation; (d) a Performance-trace-
  equivalent capture (console-based `PerformanceObserver` longtask
  monitoring + fine-grained per-call timing) found **zero long tasks and
  zero slow JS calls anywhere in the capture**, including during the one
  captured failure, which fired `pointercancel` ~2.5ms after the drag
  threshold crossed — far too fast to be a JS-timing cause. This points at
  the OS/OEM touch-gesture layer (observed on a Samsung Galaxy M34, One UI)
  reclaiming the touch before the page's own `pointerdown`
  `preventDefault()` can act, not at anything in this codebase's own
  timing. **`touch-action:pan-x` was added to `#map-wrap`** based on an
  early (later-disproven) directional hypothesis — kept because it's
  low-risk and reasoned, but real-device testing found no clear evidence it
  helps. **An experimental `touchstart`-level `preventDefault()` was then
  added** to the node listeners, grounded in the "OS/OEM layer, not JS
  timing" finding — real-device results after that change were much
  stronger (9/9 successes in one production-data session, vs. 13/17
  before), but the sample size is smaller than the 17-attempt baseline that
  found the 24% rate, so this should be treated as promising, not proven.
  **Do not remove either CSS change without re-testing on real hardware
  first.** [SESSION]
- `setPointerCapture` behavior on the actual failing device is still not
  100% understood — the working theory (native compatibility-click hit-tests
  ignore pointer capture on some touch engines) fits all observed telemetry
  but was never confirmed against engine source/spec for the specific
  device/browser in question. [SESSION, reasoned but not spec-confirmed]
- **Hamburger drawer: "Discover" section becomes unreachable after
  interacting with other sections.** Real-device-confirmed, present on the
  actual production app (not a mock-harness artifact), but **root cause not
  confirmed** — diagnosis was interrupted mid-investigation when the
  wireless adb connection dropped before the requested DOM-position data
  (bounding rects of `.hdr-section`/`.hdr-section-label` elements) could be
  captured. Ruled out: this is not the scroll-related false alarm already
  documented at the `handleDrop`/section-toggle code (search for "Issue 3
  (drawer scroll) resolved by evidence" in `index.html`) — that one was
  confirmed to be the `[TOUCH DEBUG]` overlay visually covering the
  *bottom* of the panel; the current report is about the *top* of the
  Discover section becoming unreachable, a different symptom. Get a stable
  debugging connection (USB preferred — wireless dropped mid-session twice)
  before attempting this again; don't guess a fix without the DOM data.
  [SESSION, unresolved]
**Resolved since the previous version of this document:**
- **Drop-target highlight flashing on ordinary taps — fixed.** Root cause:
  `updateDropHighlight()` painted `.band-rect.drop-target` as soon as
  `dragState.moved` became true inside `handlePointerMove`, and ordinary
  touchscreen jitter crosses the 10px drag-movement threshold easily even
  on a simple tap (tap-vs-drag classification in `handlePointerUp` already
  correctly resolved these as taps — this was purely a visual flash, not a
  functional bug). Fixed by gating the highlight behind a separate,
  distinctly larger movement threshold (2.5x) than the one that governs
  node-following/tap-vs-drag classification, so the node still follows the
  finger immediately while the highlight only appears once a drag is
  unambiguous. Verified via dispatched pointer events confirming no
  highlight at small movement, correct highlight at larger movement.
  [SESSION, CONFIRMED]
- **All app-wide "Close" text buttons replaced with a smaller "×" icon** —
  12 buttons (Documents, POV browser, Ledger, Thread view, Mythic Threads,
  Trash, Reader select + main, Notes board, Annotation browser, Note
  editor, chapter editor). Kept the existing solid `btn small` styling
  (still matches sibling buttons like Delete/Save in the same row) rather
  than the app's separate borderless modal-header `×` style, since these
  live inline with other text buttons, not alone in a header corner.
  `title="Close"` added for accessibility. [SESSION, CONFIRMED]
- **List-mode chapter reordering — new feature, built.** A dedicated drag
  handle (⠿) on each `.lv-chapter` row reorders chapters within their
  current act (not cross-act/cross-book, unlike Map's drag — List's
  accordion layout has no equivalent of one continuous position across
  every book, so that would need auto-expanding collapsed sections and
  drag-scrolling, a materially larger feature). Deliberately simpler
  architecture than Map's drag: the handle is the *only* thing that starts
  a drag (no threshold-based tap-vs-drag disambiguation needed, since the
  row's tap-to-open and the handle's drag are just different elements),
  and DOM position updates directly on threshold-crossing rather than a
  floating/transform-following ghost. Two real bugs caught during testing
  (not assumed away): `stopPropagation()` on `pointerdown` does not
  suppress the browser's separate `click` event (tapping the handle
  without dragging was still opening the drawer — fixed with an explicit
  click-level `stopPropagation()`), and `setPointerCapture()` can throw
  (confirmed via testing) — handlers now wrapped in try/catch, matching
  Map's established convention. [SESSION, CONFIRMED via dispatched pointer
  events; NOT YET real-device tested — this is genuinely new code with no
  device testing history, unlike Map's drag]
- **Reader view mobile crop — fixed, root cause confirmed by direct
  measurement.** The Reader header (7 controls: Books, title, chapter-
  select, 4 reading-setting selects, close) had no mobile wrap/collapse
  handling at all, unlike the main header and editor header which both
  already solve this exact problem — on a narrow phone the controls
  wrapped across multiple lines, inflating the header to a measured 160px
  tall and squeezing the reading area. Fixed by applying the identical
  collapsible-panel pattern already used for `#editor-head`/
  `#editor-menu-panel`: the 4 setting selects move into `#reader-menu-panel`
  (`display:contents` on desktop, a hamburger-triggered dropdown on
  mobile); "‹ Books", title, chapter-select, and close stay always-visible.
  Verified: header height 160px → 72.8px at 375px width; desktop confirmed
  unaffected (all 4 selects still inline, no hamburger shown). [SESSION,
  CONFIRMED via direct measurement + screenshot; not yet real-device
  tested]
- The round-4 map ghost-click fix — **confirmed on the real device** (see
  §6). Tap-to-open reliably opens the chapter drawer; the Act popup no
  longer steals the tap via a synthesized ghost click. [SESSION]
- The service-worker cache-versioning bug — **the actual reason several
  earlier "fixes" appeared to do nothing on the real device**: no
  `CACHE_VERSION` bump + no `self.skipWaiting()` meant the app shell was
  served from a permanently stale cache regardless of new deploys. Fixed;
  see §6 for the ongoing implication (still needs a manual version bump on
  every future app-shell change). [SESSION]
- **Chapter-drag visual lag ("stays in limbo, then suddenly swaps") —
  genuinely fixed, not just diagnosed.** Root cause confirmed directly in
  the code: `handleDrop()` used to chain `renderMap()` to run only after
  `saveData()` resolved — and `saveData()` upserts every row of every
  populated table on every save (see the "not per-row-granular" item
  below), over a real network round-trip, so the visual reorder was gated
  on that entire save completing (up to ~1 second on real content) instead
  of reflecting the already-updated in-memory state immediately. Fixed by
  calling `renderMap()` synchronously right after the in-memory data
  update, with `saveData()` now firing in the background without blocking
  the visual update. Verified two ways: real-device testing after the fix,
  and a direct in-browser test that artificially delayed `saveData()` by 2
  seconds and confirmed `handleDrop()` still returned (with the new layout
  already in the DOM) in ~4ms. [SESSION, CONFIRMED]

**Unverified state:**
- Supabase RLS policies — existence and correctness unverified (§4). Client
  filters by `user_id`/`project_id` everywhere, but that's a client-side
  courtesy, not a security boundary, if RLS isn't correctly enforcing the same
  thing server-side.
- Whether the app is actually deployed anywhere right now, and to what host.
  `CLAUDE.md`/session context strongly imply a static host (the `index.html`
  rename was specifically done for "static hosts... default to index.html" —
  Vercel was named in conversation as the target) but no deployment config
  file (e.g. `vercel.json`) exists in the repo to confirm this independently. [UNVERIFIED]
- Exact content/size of the embedded map background image and whether it's
  base64-inline or referenced externally — not independently re-verified in
  this handoff pass beyond noting the file's overall size is consistent with
  an embedded image. [UNVERIFIED]

**Architectural/security concerns:**
- Anthropic API key handling: even once "fixed," putting any API key in
  client-side JS is unsafe by design — this needs a real serverless proxy
  (Supabase Edge Function or equivalent), not just "add the key to the fetch
  call." `CLAUDE.md` already says this; it remains true and remains undone.
- `saveData()`'s full-array-upsert-every-time pattern will not scale
  gracefully to a large saga (hundreds of chapters/scenes) — every keystroke's
  debounced autosave re-sends every chapter row, not just the edited one.
  **No longer purely theoretical**: this directly caused the chapter-drag
  visual-lag bug fixed this session (see §7's "Resolved" list) — the full
  upsert's network round-trip was blocking the visual update. That specific
  symptom is fixed (render no longer waits on save), but the underlying
  full-upsert pattern itself is unchanged and will keep costing real save
  latency as saga content grows.

**Intentionally deferred (not bugs):**
- Chapter drawer's fixed 440px width on mobile — explicitly out of scope for
  the mobile-responsiveness work, deferred to its own future stage.
- Editor mark-toolbar's overall layout (as opposed to the Close-button
  reachability fix, which *was* done) — same deferral.
- Annotation side panel (`#editor-anno-panel`) mobile behavior — same deferral.
- Offline functionality for actual data (only the static shell is offline-capable).
- AI-assisted plant/reveal matching (currently pure keyword overlap) —
  `CLAUDE.md`'s original deferral, still accurate, nothing changed here this session.
- Rich-text/position-tracking annotations (vs. current substring-search
  re-matching) — same, still accurate, nothing changed.

---

## 8. IMPORTANT DESIGN/ENGINEERING CONSTRAINTS

These are established and should not be silently overridden by a future session:

- **No build step.** Keep this a single static HTML file plus small static
  sidecar files unless the user explicitly asks to introduce tooling. Don't
  introduce a bundler/framework as a "cleanup."
- **AI stays optional and gated** behind `aiEnabled`; never make any core
  feature depend on AI being reachable.
- **Flags, not hard limits** — do not turn any advisory check (word targets,
  continuity gaps, orphan plants) into something that blocks saving/writing.
- **Soft delete for content** (chapters/scenes/documents) — trash, not
  permanent delete, for anything a user might want back. Project deletion is
  the one deliberate exception (explicit, typed-confirmation, genuinely
  permanent, by design).
- **Mobile fixes must not touch desktop behavior.** Every mobile fix this
  session was deliberately scoped with a breakpoint (`@media (max-width:700px)`),
  a pointer-type check (`pointerType === 'touch'`), or a coarse-pointer media
  query (`@media (pointer:coarse)`) specifically so desktop mouse/layout stays
  byte-for-byte identical. Preserve this pattern — don't "simplify" by
  applying a mobile fix universally without checking desktop impact first
  (this exact mistake was made and caught once already this session, in the
  header hamburger menu's first draft — see §6).
- **Don't regress the contenteditable editor** back to a plain textarea
  without understanding the caret-preservation and plain-text-only DOM
  constraints described in §3.5 — the annotation rendering depends on them.
- **The aesthetic is deliberate**, not a placeholder — don't restyle the
  parchment/leather/Cinzel theme as part of unrelated fixes.
- **Anything genuinely temporary must be clearly marked and actually removed**
  — the debug overlay (§6/§9) is the live example of "marked temporary,
  correctly isolated, not yet cleaned up." Follow that pattern (a single flag
  or a clearly delimited block) for any future throwaway diagnostic code, and
  actually remove it once it's served its purpose.

---

## 9. CURRENT DEVELOPMENT STATE

*(Rewritten again — the previous version described an unconfirmed round-5
map-drag fix that has since been superseded entirely: the code it patched
around no longer exists. Everything below reflects a single long session
covering presentation-config foundations, the living-map architecture
(Phase 0 + Phase 1a), and real-device debugging of drag-to-reorder and
drag-visual-lag bugs. Four commits landed this session, in order:
`017af63` (presentation-config), `0f7aa7a` (living-map Phase 1a),
`2927917` (temp perf instrumentation), `153dfa7` (drag-lag fix).)*

**Confirmed done, committed, and pushed — presentation-config foundations
(`017af63`):**
- `project_settings` gained two additive, nullable columns (`preset_id`,
  `presentation_overrides`). An unset `preset_id` resolves to `"the-atlas"`
  in memory only for rendering — the fallback is never written back, so
  existing rows stay untouched unless a project explicitly picks a preset.
- All ~135 hardcoded `font-family` declarations replaced with
  `--font-display`/`--font-heading`/`--font-body`/`--font-literary`/
  `--font-mono` CSS custom properties, defaulting to the exact fonts
  already in use — zero visual change, verified via real screenshot
  comparison against the pre-change commit.
- `resolvePresentationConfig()`/`applyPresentationConfig()`: a small
  resolver that merges a project's preset + overrides and applies
  palette/typography/layout/motion/background as CSS custom properties +
  `data-*` attributes on `<html>`. Only `"the-atlas"` preset is populated
  (matching SAGA-01's current look exactly); the schema supports more
  presets but none are built out.

**Confirmed done, committed, and pushed — living-map Phase 1a
(`0f7aa7a`), confirmed on real hardware:**
- The map's background image is no longer CSS-positioned on `#map-wrap`
  (which caused a real, confirmed drift bug — the image didn't scroll with
  its content). It's now an `<image>` element inside `#map-svg` itself, in
  the same coordinate space as the node/trail layer, at native size
  (1024×559px, the source JPEG's actual dimensions).
- The map's world size is now `Math.max(image dimensions, chapter-layout
  extent)` in each dimension — fixed, not derived from viewport/
  orientation. `getMapVerticalMetrics()` simplified to fixed constants
  accordingly.
- The resize-triggered `renderMap()` rebuild (the exact code the old,
  never-confirmed round-5 fix guarded) has been **removed entirely** — it
  only existed to react to viewport-dependent layout, which no longer
  exists. This also removes the specific "resize destroys the dragged
  `<g>` mid-touch" failure class that guard was defending against; there's
  no rebuild left for a resize to race with.
- **Real-device confirmed** (not just reasoned): background and node/trail
  layers move in perfect lockstep across scroll, in both directions, in
  both orientations — zero drift. Portrait is no longer cropped the way
  `background-size:cover` used to crop it (major regions were previously
  never visible at all in portrait; now the full world is reachable by
  scrolling).
- `svgPoint()` (pointer-position conversion) required **zero code changes**
  and was confirmed still accurate after scrolling — it already computes
  position via `getScreenCTM().inverse()` at call time.
- **Known, reported, unresolved limitation, not a bug**: the current art
  (1024×559px) is much smaller than a populated multi-book project's actual
  chapter-layout extent. Past the image's right/bottom edge, the world
  shows plain background color, no art — confirmed both in local testing
  and on the real production app with real SAGA-01 content ("only Book One
  has art, Books 2 onward are empty"). This needs either new,
  larger/differently-composed art or a different scale approach — flagged
  for a product decision, not something further code tuning alone fixes.
  `MAP_ZOOM_SCALE = 0.5` (a CSS-only render-size scale-down, coordinate
  math untouched) was added after real-device testing found native-pixel
  scale too zoomed-in for a phone screen — it's a first-pass value, not a
  tuned final answer, and it doesn't resolve the art-runs-out issue (it
  changes how much of the *existing* art is visible per screen, not how
  much art exists).
- Initial map scroll position resets to top-left, once, on project load
  only (not on every re-render triggered by edits/saves).

**Confirmed done, committed, and pushed — drag-bug investigation and fixes
(`0f7aa7a`, `2927917`, `153dfa7`):**
- `touch-action:pan-x` on `#map-wrap` — added mid-investigation based on an
  early directional hypothesis (later disproven by a full 17-attempt
  real-device test). Kept, but its actual net effect is unproven.
- An experimental `touchstart`-level `preventDefault()` on map nodes,
  grounded in Performance-trace-equivalent evidence (zero long tasks, a
  2.5ms-post-threshold `pointercancel`) pointing at the OS/OEM touch-gesture
  layer, not JS timing. Real-device results after this change were much
  stronger (9/9 vs. the 13/17 baseline) but on a smaller sample — promising,
  not proven. See §7 for the full evidence trail.
- **The chapter-drag visual-lag bug is genuinely fixed** (not experimental):
  `handleDrop()` no longer chains `renderMap()` behind `saveData()`'s
  network round-trip. See §7's "Resolved" list for the full root-cause
  explanation and verification method.
- Temporary, clearly-marked, console-only debug code left in place,
  intentionally not yet removed: fine-grained `handlePointerMove` per-call
  timing (`[MOVE PERF]`, threshold 4ms, in `handlePointerMove`) and a
  separate hamburger-drawer scroll/touch diagnostic (`[HDR-SCROLL DEBUG]`,
  attached to `#header-actions`) for the still-unresolved drawer bug (§7).
  Both follow the established "clearly marked, remove once it's served its
  purpose" convention — neither has yet, because neither investigation is
  finished.

**`DEBUG_TOUCH_OVERLAY` is still `true`/enabled** in the working tree —
unchanged status from before this session, still gating the on-screen
`[TOUCH DEBUG]` overlay bar used throughout tonight's real-device
debugging. Still not removed, for the same reason as before: the
underlying drag bug it was built to help diagnose is improved but not
confirmed fully resolved.

**Flagged this session, fixed/built in a follow-on pass (see §7 for detail
on each):** the tap-triggered drop-highlight flash; all app-wide "Close"
buttons → smaller "×"; List-mode chapter reordering (new feature); the
Reader view mobile header crop. All four confirmed via direct testing
(dispatched pointer events / direct measurement + screenshots) but **not
yet real-device tested** — List-mode reordering in particular is genuinely
new code with zero device-testing history, unlike Map's drag.

**Still open, not yet built at all (see CLAUDE.md's "Still deferred" for
the short version):**
- A gold ring/glow visual indicator on the chapter node that was just
  dragged and dropped, so its new position reads clearly.
- The hamburger drawer "Discover section unreachable" bug (§7) — still
  unresolved, diagnosis was interrupted mid-session by a dropped
  debugging connection.
- **Day/night/sunrise/sunset living-map visuals** — real reference mockups
  now exist for four states (bright neutral day covering both "morning"
  and "afternoon" as one treatment with just a live clock readout; a warm
  orange/pink sunset-sunrise treatment; a dark night treatment with
  glowing settlement windows), sequenced `night → sunrise (1hr) → day →
  sunset (1hr) → night`. Intended schedule source: real astronomical
  sunrise/sunset times (like a weather app), computed client-side via
  `navigator.geolocation` + a public-domain solar-position formula (no
  external API/key needed — consistent with this app's no-backend-proxy
  constraint, §8). Intended to also include animated water/ship "living
  map" layers, per the architecture already designed for this (a generic
  layer system sharing the same coordinate space as Phase 1a's background/
  node layers — see the conversation history for the full proposal if it
  isn't captured elsewhere in this repo). **Blocked on two open questions,
  not yet answered:**
  1. Production-resolution, map-only background image files for each
     state — only composited mockup screenshots (all 6 app panels at
     reduced scale) exist right now, not usable as real assets directly.
  2. What happens when `navigator.geolocation` is denied or unavailable
     (e.g. desktop browsers without location services) — needs a sensible
     fallback (e.g. fixed local-clock assumption) rather than the feature
     breaking, not yet designed.

**Next logical task, in order**: (a) real-device confirmation of the four
fixes above (tap-highlight, close-buttons, List-mode drag, Reader header) —
none have been tested on actual hardware yet, only via dispatched-event
testing and direct measurement, (b) resolve the two day/night open
questions with the user, (c) get a stable debugging connection (USB
preferred) to finish diagnosing the hamburger-drawer bug rather than
guessing, (d) the gold drop-ring visual indicator. None of these block
each other; sequence by what the user wants next.

---

## 10. FRESH-SESSION INSTRUCTIONS

**Read first, in this order:**
1. This document, in full.
2. `git log --oneline -15` and `git diff HEAD` — to see exactly what's
   committed vs. not, since this document will go stale the moment more work
   happens.
3. The current state of the map's pointer-handling code (`renderMap()` and
   everything from `let dragState` through the `[g, halo, core, icon, label,
   sceneCountEl].filter(Boolean).forEach(...)` listener-attachment block) —
   this is the single most-patched, most-fragile piece of logic in the app
   right now.
4. `CLAUDE.md` — but only after the above, and only as historical background.
   Do not treat its roadmap, its "deferred" list, or its editor-architecture
   description as current truth; this document supersedes all three.

**Verify before changing anything in these areas:**
- Before touching the map's touch/pointer logic: re-read §7's drag-bug
  evidence trail in full (Performance-trace-equivalent findings, the
  `touch-action:pan-x`/`touchstart preventDefault` experiments, the
  9/17 vs. 9/9 sample sizes). The old round-5 resize-guard fix is now
  moot (its target code was removed in Phase 1a), but the underlying
  `pointercancel` bug is real, pre-existing, and still not fully resolved
  — don't assume either CSS change is a proven fix, and don't re-run the
  same directional-hypothesis reasoning that was already disproven.
- Before touching anything in `renderMap()`, `getMapVerticalMetrics()`, or
  the background-image/world-sizing code: this is now the shared
  coordinate space Phase 1a built and confirmed on real hardware — don't
  reintroduce viewport/orientation-derived sizing, and don't move the
  background image back to a CSS `background` property on `#map-wrap`.
- Before touching `saveData()`/`loadData()`: know that errors are currently
  silent, and that "looks saved in the UI" is not the same as "actually
  persisted" — verify against the actual Supabase table if in doubt, not just
  the in-memory state or a mock. Also know that `saveData()` is no longer
  assumed-safe to chain a visual update behind (see §7's drag-lag fix) —
  any new code that needs to reflect a data change on screen should update
  the DOM from in-memory state directly, not wait on `saveData()`'s promise.
- Before touching the editor: re-read §3.5. The `contenteditable` + caret-math
  + plain-text-only constraints are load-bearing, not accidental complexity.
- Before touching anything mobile-specific: check whether the existing fix is
  scoped by breakpoint/pointer-type/coarse-pointer media query, and preserve
  that scoping in any change — don't let a mobile fix leak into desktop.
- Before touching the hamburger drawer (`#header-actions`): the "Discover
  section unreachable" bug (§7) is unresolved — get real DOM-position
  evidence before guessing at a fix, the same discipline used for the drag
  bug. Don't assume it's the same root cause as the already-resolved
  "debug overlay covering the bottom of the panel" false alarm documented
  in the code near `handleDrop`/section-toggle — the current report is a
  different symptom (top of Discover, not bottom of panel).
- Before importing `story-map-export-2026-08-05.json` (or trusting it as a
  content backup): check its `chapters[].id` format against the current
  UUID-based schema first.
- Before starting any day/night/living-map work: the two open questions in
  §9 (asset delivery, geolocation-decline fallback) need answers first —
  don't guess at either.

**Must not assume:**
- That the AI features work — they don't, outside the original sandbox (§5/§7).
- That RLS is correctly configured — unverified (§4/§7). (A partial check
  this session found anonymous/unauthenticated REST access correctly
  blocked on all tables — consistent with RLS being enabled — but
  cross-user isolation between two real authenticated accounts remains
  unverified; that check needs a second real account.)
- That the app is deployed anywhere reachable right now — actually
  **confirmed** this session: real-device testing happened against the
  live Vercel production deploy, with four commits pushed and verified
  live during the session.
- That `touch-action:pan-x` or the `touchstart preventDefault` experiment
  are confirmed fixes — see §7, both are real-device-tested but not
  conclusively proven.
- That `CLAUDE.md` reflects current reality on: storage layer (it doesn't —
  Supabase has been live for a while), multi-project (it's done, not
  deferred), or the editor's implementation (it's `contenteditable`, not
  textarea+overlay).

**Should be tested on a real device before being called done:**
- Any future change to map touch/drag/tap logic, full stop — this session's
  history (again) shows sandbox/simulated testing repeatedly missed
  real-device-only failure modes that only surfaced from actual hardware.
  This session specifically found that even the Browser pane's own
  synthetic drag gesture (`left_click_drag`) does not trigger this app's
  real Pointer Event handlers at all — it produced zero drag-related log
  output despite the gesture appearing to execute. Simulated events of any
  kind should not be treated as proof of real-device correctness for
  anything touch-related.
- Any change to the map's world sizing / background art — screenshot
  comparison in both portrait and landscape, on a real device.
- Any change to the mobile header/editor-header collapse behavior, especially
  re-checking desktop is untouched (screenshot comparison, not just a
  behavioral test, since the first hamburger-menu attempt broke desktop
  *visual order* without breaking any specific behavior a quick test would catch).

**Particularly fragile architectural areas, ranked:**
1. Map SVG pointer/touch interaction (§6/§7) — most-patched, least "done."
   Now confirmed to be at least partly an OS/OEM-level issue outside pure
   JS control, not purely a code bug — factor that into how much further
   code-only iteration is worth attempting before considering
   device/OS-level mitigations instead.
2. The `contenteditable` editor's caret-preservation + inline-annotation
   rendering (§3.5) — correct today, easy to break by a well-intentioned refactor.
3. `saveData()`/`loadData()` error handling — silent failures are the default;
   any new feature built on top of these inherits that silence unless it
   explicitly adds its own error surfacing. Also now confirmed to be slow
   enough on real content to matter for UX (§7's drag-lag fix) — treat its
   full-upsert-every-save pattern as a real latency source, not just a
   theoretical scaling concern.
4. The map's shared coordinate space (Phase 1a, §9) — newly built, confirmed
   solid on real hardware for its actual scope, but the "art runs out past
   Book One" and "empty space in portrait" limitations are real and
   unresolved — don't extend this system (e.g. for Phase 1b living-map
   layers) without accounting for those.
5. Anything touching both mobile and desktop styling/behavior in the same
   change — the established pattern (breakpoint/pointer-type/coarse-pointer
   scoping) must be followed deliberately, it will not happen by accident.

---

## 11. SOURCE CONFIDENCE SUMMARY

Quick reference for how much to trust specific claim categories in this document:

| Claim category | Confidence |
|---|---|
| File/directory structure, function inventory, HTML screen/modal IDs | **VERIFIED FROM CURRENT CODE** |
| `loadData`/`saveData` behavior, table/column names used by the client | **VERIFIED FROM CURRENT CODE** (client-side usage only) |
| Actual live Supabase schema, constraints, indexes | **UNVERIFIED / MUST CHECK** |
| RLS policy existence/correctness | **UNVERIFIED / MUST CHECK** |
| AI feature being non-functional outside the sandbox | **VERIFIED FROM CURRENT CODE** (no API key in the fetch call, no proxy exists in repo) |
| Map touch-interaction bug history and fixes (rounds 1–3) | **ESTABLISHED IN A PRIOR SESSION**, each round's fix independently verified via direct testing at the time |
| Round-4 ghost-click fix | **CONFIRMED ON THE REAL DEVICE** in a follow-on session — no longer "sandbox-verified only" |
| Round-5 Map-drag `pointercancel` fix (resize-guard) | **NOT YET REAL-DEVICE-CONFIRMED** — only verified via a JS-driven simulated resize-during-drag test. Two earlier theories for this same bug (contextmenu/long-press, pointer-capture-vs-appendChild ordering) were each individually implemented, pushed, and then disproven by real-device evidence — treat this one with the same skepticism until confirmed. |
| Service-worker cache-versioning bug and fix | **CONFIRMED** — directly explained why multiple earlier fixes appeared to do nothing on the real device across this session |
| List view / hamburger drawer redesign (textures, icons, frame, layout bugs found+fixed) | **ESTABLISHED IN THIS SESSION**, layout/transparency/wrap bugs each verified via direct browser testing + real-device screenshots; texture and icon quality explicitly flagged as placeholder, not verified-as-final |
| Editor architecture (`contenteditable`, caret math) | **VERIFIED FROM CURRENT CODE** — the *reasoning/history* behind choosing this architecture is not in this session's visible history (it likely predates it), only the resulting code and its inline comments are verified |
| UUID migration having happened | **VERIFIED FROM CURRENT CODE** (consistent `crypto.randomUUID()` usage, `nextId` scoped to annotations only) — the migration *process/history* itself is not in this session's visible history |
| Multi-project support being complete (vs. `CLAUDE.md`'s original "deferred" note) | **VERIFIED FROM CURRENT CODE** |
| Deployment target (Vercel) | **CONFIRMED** — real-device screenshots throughout this session show a `*.vercel.app` URL in the browser bar |
| Origin of the stray `git` file | **UNVERIFIED** — actively investigated in a prior session, inconclusive |
| Mobile-responsiveness fixes (viewport meta, touch targets, hamburger menus, input zoom) | **ESTABLISHED IN A PRIOR SESSION**, each verified via direct browser testing (including a real desktop-vs-mobile screenshot comparison to catch a regression) at the time |
| Reader page-break fix | **ESTABLISHED IN A PRIOR SESSION**, verified via direct rendering test at the time |
| StoryMap rebrand (all "The Trail to Kailash" app-UI text → "StoryMap") | **VERIFIED FROM CURRENT CODE** — `grep`-confirmed zero remaining occurrences in `index.html` |
| Presentation-config resolver + typography tokenization (`017af63`) | **CONFIRMED** — visual parity verified via real before/after screenshot comparison against the pre-change commit, zero differences found |
| Living-map Phase 1a shared coordinate space (`0f7aa7a`) | **CONFIRMED ON REAL HARDWARE** — zero drift between background/node layers, both scroll directions, both orientations, tested via real device with DevTools attached |
| "Art runs out past Book One" / portrait empty-space limitations | **CONFIRMED**, both in local multi-chapter mock testing and on the real production app with real content |
| Old round-5 map-drag resize-guard fix | **MOOT** — its target code (the resize-triggered `renderMap()` rebuild) was removed entirely in Phase 1a; the guard can no longer be relevant since there's nothing left for it to guard |
| Map drag-to-reorder `pointercancel` bug being pre-existing (not a Phase 1a regression) | **CONFIRMED** — reproduced against a git worktree checkout of the pre-Phase-1a commit, same failure signature |
| `touch-action:pan-x` and `touchstart preventDefault()` drag-bug mitigations | **REAL-DEVICE-TESTED, NOT CONCLUSIVELY PROVEN** — see §7 for the full evidence trail and sample-size caveats |
| Drag `pointercancel` root cause being OS/OEM-level, not JS-timing | **STRONGLY EVIDENCED** — zero long tasks, zero slow per-call timing anywhere in a real-device capture including the one caught failure (`pointercancel` fired 2.5ms after threshold crossing); not spec-confirmed against the specific OEM's gesture-arbitration internals |
| Chapter-drag visual-lag fix (`renderMap()` no longer gated on `saveData()`) | **CONFIRMED** — root cause identified directly in code, fix verified via both real-device testing and a synthetic-delay test proving the render no longer waits on the save |
| Anonymous/unauthenticated Supabase REST access being blocked on all tables | **CONFIRMED** via direct REST calls this session (empty result sets, not permission errors, on `projects`/`chapters`/`scenes`/`documents`/`sticky_notes`/`project_settings`) — cross-user isolation between two real accounts remains **UNVERIFIED** |
| App being live and reachable on Vercel production | **CONFIRMED** — four commits this session were pushed and tested against the real production deploy on a real device |
| Hamburger drawer "Discover section unreachable" bug | **CONFIRMED REAL, ROOT CAUSE UNKNOWN** — investigation interrupted by a dropped debugging connection before DOM-position evidence could be captured |
| Tap-triggered gold highlight flash | **DIAGNOSED FROM CODE**, not yet fixed — the mechanism (`updateDropHighlight()` firing on drag-threshold crossing, which ordinary tap jitter reaches) is clear; the fix itself is not yet implemented or tested |
| Reader view cropping — root cause and fix | **CONFIRMED via direct measurement** (header 160px → 72.8px) and screenshot comparison; **NOT YET real-device tested** |
| Drop-highlight-flashes-on-tap fix | **CONFIRMED via dispatched pointer events** (no highlight at small movement, correct highlight at larger movement); **NOT YET real-device tested** |
| "Close" → "×" button restyle (12 buttons) | **CONFIRMED via direct DOM/CSS inspection + screenshot**; visual-only change, low regression risk |
| List-mode drag-to-reorder | **CONFIRMED via dispatched pointer events** (DOM reorder + underlying `chapters[].order` both verified correct); **NOT YET real-device tested — this is genuinely new code with zero device-testing history**, unlike Map's drag |

---

## 12. SESSION ADDENDUM — Reader overhaul, Account/Profile, Landing Page, Auth Screen (this session)

*(Everything below happened in one long follow-on session, 17 commits,
`1eeddd7` through `cf98d02`. Unlike §6-9 above, this work was almost
entirely straightforward feature-building verified via dispatched
DOM/pointer events and direct measurement in the Browser pane tool — real
device testing was **not** performed for any of it, which is the single
biggest gap between this section's confidence and §6-9's. Treat everything
below as "verified in a simulated/desktop browser," not "confirmed on real
hardware," per the same skepticism §7/§9 already apply to touch-specific
code — several items below (swipe gestures, drag-to-close) are exactly the
kind of touch interaction that has repeatedly needed real-device correction
elsewhere in this app's history.)*

### 12.1 Reader — full redesign, Kindle-style (`1eeddd7` through `d0c4599`, `658cd2f`, `f273922`, `7be2f7b`)

The paginated in-app Reader was substantially rebuilt from the version
§5/§6 describe. Current state:

- **Full-screen, chrome-free by default.** The reader opens showing only
  the page, no header/footer. Header/footer are solid-background overlays
  (not real flex children — see the note below on why) that toggle via a
  `chrome-hidden` class, auto-hiding after 3.5s **unless** the Font/Layout
  or chapter-list dropdown is open, in which case the auto-hide timer
  (`readerChromeAutoHideTick()`) keeps deferring itself until both close.
- **Page turning**: tap the left/right quarter of the screen, or swipe
  left/right (real `touchstart`/`touchmove`/`touchend` tracking, not a
  library) — both trigger `readerNextPage()`/`readerPrevPage()`. Tapping
  the middle band toggles the header/footer chrome. Page transitions
  animate (`transform:transform .32s` on the translateX-shifted CSS-column
  content strip) rather than snapping instantly; pagination-recalculation-
  triggered transform changes (resize, font/size change) use a `.no-anim`
  class to skip the animation for those, since animating a resize/reflow
  would look wrong.
- **Even page-bottom alignment**: pages are CSS multi-columns with a fixed
  height, so text fills each column until it runs out — if that height
  wasn't an exact multiple of the actual rendered line-height, each page's
  last line ended at a slightly different point (read as inconsistent
  page endings). Fixed by `snapReaderContentHeightToLines()`, which
  measures the real line-height off a `.reader-prose` element and adjusts
  `#reader-page-content`'s top/bottom padding (not its box height) each
  recalculation so the flowed area is always a whole number of lines.
  Chapter side margins reduced 60px → 32px per user feedback ("too much
  blank space").
- **Font/Layout settings sheet**: the "Aa" button opens a tabbed dropdown
  (Font: a grid of font-preview buttons + a size slider; Layout: alignment
  + continuous-scrolling toggle + a brightness slider), replacing the old
  inline-on-desktop/collapse-on-mobile `<select>` row pattern, at every
  screen size now.
- **Continuous scrolling** (opt-in toggle): swaps the paginated
  horizontal-column layout for plain vertical scroll. Page-turn taps/
  swipes and arrow keys are disabled while it's on; the chapter picker
  scrolls to the chapter instead of jumping a page index; the position
  slider is replaced by a scroll-derived "% read" label; the page-based
  bookmark ribbon hides (no meaningful page position in this mode).
- **Brightness slider**: simulates screen brightness via a black scrim
  overlay (`#reader-brightness-overlay`/`#editor-brightness-overlay`) —
  there's no real brightness API available to a web page. One shared
  `appBrightness` value (0-100, default 100/no dim) drives both the Reader
  and Editor sliders and both overlays, so it's a genuinely app-wide
  setting, not per-surface. **Not persisted** — resets to 100 each session,
  unlike the profile/motion settings in §12.2 which are.
- **Bookmarks — two independent systems now**: the original single "moving"
  bookmark (`projectBookmarks[bookIndex] = page`, yellow ribbon, one page
  per book) is unchanged in behavior but now triggered by a **single tap**
  on the ribbon (300ms hold before firing, to disambiguate from a double
  tap). **New**: a double-tap on the same ribbon toggles an independent
  **red pinned bookmark** (`projectPinnedBookmarks[bookIndex] = [page, ...]`)
  — any number of pages can be pinned at once, positioned as a second
  ribbon icon next to the yellow one so both can be visible together on
  the same page. Persistence: the `bookmarks` settings JSONB column
  changed shape from a flat `{bookIndex: page}` map to
  `{current: {...}, pinned: {bookIndex: [page, ...]}}` — **backward
  compatible**, old rows without `current`/`pinned` keys are read as the
  legacy flat map with no pins.
- **Highlighting + Reader↔Editor sync** (`d0c4599`): selecting text in the
  Reader shows a floating popup (Highlight / Editor), positioned off the
  selection's `getBoundingClientRect()`. **Highlight** saves the selection
  as a `{id, type:'highlight', text}` entry in that chapter's existing
  `annotations` array — reusing the same array/mechanism Plant/Reveal/Note
  already use, which means the Editor's existing `renderAnnotatedContent()`
  picks up Reader-made highlights automatically (no new Editor-side code
  needed) since it already wraps any `ch.annotations[]` entry's `text` in
  `<mark class="hl-${type}">`. **Editor** opens the full chapter editor
  with that exact text located and selected, reusing the same
  substring-search pattern the existing "jump to annotation" feature used
  (factored out into `scrollEditorToRange()`/`jumpToTextInEditorInline()`).
  Selecting text that **overlaps an existing highlight mark** shows "Remove
  Highlight" instead of "Highlight" (creating a second overlapping
  highlight isn't supported — the paragraph-highlighting render logic
  silently drops overlapping ranges — so this is the only way out of that
  state, identified via `data-annotation-id` on the rendered `<mark>` and
  `Range.intersectsNode()`).
  The Reader's "Aa"-adjacent menu gained an "Edit this chapter" button
  (tracks whichever chapter is currently in view, including during
  continuous scroll, via a `.reader-toc-row.current` class kept in sync).
  The Editor's hamburger menu gained a matching chapter-level "View in
  Reader" button. Both directions use a `editorReturnTo = {type:'reader',
  bookIndex, chapterId}` case added to the pre-existing `editorReturnTo`
  mechanism (previously only used for returning to the Act modal) so
  closing the editor after a reader-initiated jump returns to the reader
  at the right chapter. Word/phrase-level jumps in **both** directions now
  actually select the text (not just scroll to it) — editor→reader was
  initially scroll-only, fixed to match reader→editor's behavior of
  leaving the text visibly selected.
- **Architecture note — why header/footer are overlays, not real flex
  children**: an earlier version of this redesign made the header/footer
  real flex children of a column layout, so the page area's box literally
  shrank when the header opened. This looked right but caused a real bug:
  since pagination is CSS-column-based with a *fixed* column height, a
  shorter box (from the header opening) meant a shorter column, forcing a
  full repagination against the new height *every time chrome toggled* —
  different text reflowed into view, which read as the page silently
  auto-scrolling. Fixed by making the page area fixed-size again
  (`position:absolute;inset:0`, pagination computed once) with the
  header/footer as solid-background overlays layered on top (`z-index`
  above the page) — same "chrome covers part of the page" visual result,
  zero layout/reflow triggered by toggling.
- **No dedicated Editor "Save" button anymore** (`7be2f7b`) — autosave
  (debounced 1.2s on every keystroke, plus fire-and-forget on every
  navigation-away action) already covered everything it did; Ctrl/Cmd+S
  is kept as an on-demand "save now with visible confirmation," calling
  the extracted `saveEditorNow()` function directly.
- **Fire-and-forget saves on navigation**: several handlers (editor-close,
  view-in-reader, the reader highlight action) were changed from
  `await autosaveChapter()`/`await saveData()` to unawaited calls, since
  `autosaveChapter()`'s in-memory content sync happens synchronously
  *before* its own internal network call — navigating away immediately
  rather than waiting on the round-trip doesn't lose anything, it just
  removes a visible lag on every reader↔editor transition.

**Not done / explicitly out of scope this pass**: real device testing of
any Reader touch interaction (page-turn swipe, chapter-editor jump
timing); AI-assisted anything in the Reader; the brightness slider isn't
persisted; continuous-scroll mode's chapter-jump and bookmark-pin
interplay hasn't been stress-tested with a very long single chapter.

### 12.2 Account/Profile + global motion-preference toggle (`3c2b195`, part of `bdb0d6e`)

- **New account-wide profile fields** — display name, birthday, and a
  free-form list of "special occasions" (label + date, add/remove rows) —
  plus the conventional basics (view email, change password). Backed by
  Supabase Auth's built-in `user_metadata`
  (`supabase.auth.updateUser({data:{...}})`, reads via
  `supabase.auth.getUser()`), **not a new database table** — `user_metadata`
  is already a JSONB column on `auth.users`, so this needed zero schema
  migrations, unlike everything in §4's table list. Reachable via a
  Settings modal (`#account-settings-modal`) opened from both the landing
  page and the main app header.
- **Landing page greeting**: `#project-screen` shows "Welcome, {first
  name}" (falls back to "Welcome back") once `loadProjectOptions()` has
  fetched the user.
- **Global motion-preference toggle** (`appMotionEnabled`, also stored in
  `user_metadata`, same account-wide mechanism): a single `motion-on`
  class on `<html>` that any current or future animated surface is meant
  to check, rather than each surface having its own on/off switch. Default
  off; an explicit "on" from the user is intended to override the OS's
  `prefers-reduced-motion` (informed choice vs. accident) — **note: no
  surface actually checks this class yet** (there's no animated surface
  built that needs to respect it yet — the auth-screen background in
  §12.4 doesn't gate on it, since it's a simple CSS transition, not the
  kind of ambient motion this toggle was built for). This is
  infrastructure ahead of its own use case, built in anticipation of the
  day/night/sunrise/sunset living-map work already flagged as blocked in
  §9 — when that or the auth-screen's layered/animated mode (§12.4's "not
  built" list) eventually lands, it should read this class rather than
  inventing its own toggle.

### 12.3 Landing page redesign (`bdb0d6e`, `ebe254b`)

`#project-screen` gained a bottom tab bar (Home / Projects / + / Explore /
Profile) replacing the old single static panel:
- **Home**: a decorative pull-quote box ("Chart the past. Shape the
  future. Leave your legend.").
- **Projects**: the pre-existing project list/rename/delete/create panel,
  unchanged in behavior, restyled with icon buttons.
- **+**: switches to the Projects tab and focuses the new-project name
  input (not a separate quick-create flow).
- **Explore**: a "coming soon" placeholder — cross-project search across
  all projects at once was scoped in conversation but **not built**; the
  tab exists and is styled but does nothing beyond showing the
  placeholder text.
- **Profile**: opens the same Account Settings modal as §12.2.

**Color palette**: a light "parchment card" scheme
(`--ph-bg`/`--ph-text`/`--ph-accent`/etc., cream background + dark brown
text + amber accent) scoped entirely to `#project-screen` via CSS custom
properties defined on that element — deliberately **not** touching the
rest of the app's existing dark theme. Icon set: folder (Open), pencil
(Rename), feather (new project), gear (Settings), exit-door (Sign out),
compass (logo mark + Explore tab) — new SVG `<symbol>` defs added
alongside the existing shared icon sprite (§6's "List view + hamburger
nav drawer" redesign), same stroke-based style.

**Real bug found+fixed during this pass**: `.ph-tab-panel` (a `flex:1`
child of a row-flex container) was rendering at a fixed 480px instead of
shrinking to fit the viewport on mobile, because its child
(`#project-home-panel`, `width:480px;max-width:100%`) has an explicit
width that flexbox's default `min-width:auto` factors into the *parent's*
automatic minimum-size calculation, overriding the percentage
`max-width`. This is the classic flexbox min-width-with-explicit-child-
width overflow trap — fixed with `min-width:0` on `.ph-tab-panel`, the
standard fix. Worth knowing as a pattern if a similar "child won't shrink
below some fixed value despite max-width:100%" bug shows up elsewhere.

### 12.4 Auth screen redesign — full-bleed art + tap/swipe bottom sheet (`bdb0d6e` through `cf98d02`)

- **Real background artwork** now in the repo:
  `assets/auth-bg-sunset.png` (a user-supplied AI-generated sunset/castle
  illustration with the "STORYMAP" wordmark, tagline, and compass motif
  **baked into the image itself** — not rendered as separate HTML/CSS).
  At time of writing this is **2.3-2.5MB and PNG** — no image
  optimization tooling (ImageMagick, ffmpeg, a working Python+PIL) was
  available in this session's environment to compress/convert it, so it
  was used as-delivered. **Flagged, not fixed**: this should be converted
  to a compressed JPEG or WebP (photographic content compresses far
  better as either than as PNG) before this is considered production-
  ready — likely a large win for load time on mobile networks.
- **Opens showing just the image** (`#auth-screen`, full-bleed
  `background-image`, no visible form). A subtle pulsing "TAP TO SIGN IN"
  hint sits near the bottom. One **tap** anywhere reveals a sign-in sheet
  sliding up from the bottom (`#auth-card`, `translateY` + `opacity`
  transition); tapping outside the card while it's open collapses it
  again; tapping inside it (a field, a button) does nothing to the sheet
  state. **Swipe up** (anywhere, while closed) also opens it; **swipe
  down on the card** (only once its own scroll position is at the top, so
  it doesn't fight normal scrolling inside a tall/overflowing card) closes
  it, following the finger live during the drag (`touchmove` sets an
  inline `transform`, a `.dragging` class suspends the CSS transition
  while dragging) and snapping open/closed based on a 45px distance
  threshold on `touchend`.
- **Card sizing**: inset 16px from the screen edges (not edge-to-edge),
  rounded corners on all four sides (not just the top two), capped at
  `max-width:min(336px, calc(100% - 24px))` and `max-height:48vh`, then
  reduced again to those exact numbers (80% of an earlier, larger pass)
  per direct user feedback comparing against the reference mockup's
  proportions — the vertical `bottom` offset was recalculated
  (`16px + 6vh`) specifically to keep the card's *center point* fixed
  while shrinking its height, not just anchor it to the bottom edge.
- **Loading-gap fix**: the auth screen's `background-image` defaults to a
  same-toned CSS gradient (not blank/black), and a `<link rel="preload"
  as="image">` in `<head>` plus a JS `new Image()` preload swap the real
  photo in (via a CSS custom property + `.auth-bg-loaded` class) only
  once it's actually decoded — so the ~1-2s load time for the 2.3MB file
  reads as a smooth fade from a themed placeholder rather than a blank
  screen with the tap hint floating on nothing. This **reduces the
  perceived gap, not the actual byte count** — see the "not fixed" PNG
  note above for the real fix.
- **`-webkit-tap-highlight-color:transparent`** added to `#auth-screen`
  and all descendants — the default mobile tap-highlight (a
  semi-transparent blue flash on tap) was visible on the first tap before
  this; same class of fix already applied to the Reader in an earlier
  session (§ n/a, search `-webkit-tap-highlight-color` in `index.html`
  for the other call sites).
- **Google/Apple/Microsoft "Continue with..." buttons**: visually
  complete (real per-provider colored logos, inline SVG, not the shared
  mono icon sprite since these need actual brand colors) to match the
  reference design, but **intentionally inert** — clicking shows "Sign-in
  with this provider isn't set up yet." Wiring these up for real needs
  OAuth apps registered with each provider (Google Cloud Console, Apple
  Developer — requires a paid $99/yr membership, Microsoft Entra) plus
  that provider enabled in the Supabase Auth dashboard with the
  resulting Client ID/Secret — **none of that has happened**; it's
  account/dashboard work outside what a coding session can do. Once
  configured, the code-side change is small (`supabase.auth.signInWithOAuth
  ({provider:'google'})` etc.).
- **"Remember me"**: implemented as a genuine storage-adapter choice, not
  just a UI checkbox — `sbClient` is constructed with `auth:{storage:
  localStorage or sessionStorage}` depending on a `storymap-remember-me`
  localStorage flag read *before* the client is constructed (necessarily
  before the checkbox can be interacted with). **Known limitation,
  accepted as a reasonable tradeoff**: since the storage adapter is fixed
  at construction time, a changed checkbox value takes effect starting
  *next* sign-in, not retroactively for whichever session is currently in
  flight — most users won't notice since the default is "remembered."
- **"Forgot password"**: wired to `supabase.auth.resetPasswordForEmail()`
  — sends a real reset email via Supabase's built-in flow. **Not built**:
  the "set new password" page/route the reset email's link would need to
  land on — clicking the emailed link today has nowhere designed to go.
- **Day/night/dawn art for this same screen**: user has stated they have
  (or can generate) art for all four times-of-day for this specific
  screen, matching the living-map day/night/sunrise/sunset work already
  flagged as blocked in §9 — **not yet delivered/integrated**; only the
  sunset scene exists in the repo. If/when the other three arrive, the
  natural place to switch between them is wherever `presentationConfig`
  (§9's "presentation-config foundations") or the motion-preference class
  (§12.2) end up driving the map's day/night state — worth checking
  whether that mechanism should be shared rather than building a second,
  parallel one for the auth screen specifically.

**Not done / explicitly flagged as future work in conversation, not
started**: the layered/parallax animated version of this background (the
user described wanting a toggleable "moving animations" mode covering
this screen *and* the living map, using the §12.2 motion-preference
flag) — everything shipped this session is the **static** version only;
the layered-asset animated mode was scoped in conversation (sky/clouds/
sun/water/ship/birds as separate PNG layers, one scene fully built
end-to-end before the other three) but no layered assets have been
delivered yet, so none of that rendering pipeline exists in code.

---

## 13. DAY/NIGHT MODE — SCOPE EXPANDED TO THE WHOLE APP (2026-08-15, not yet built)

Conversation on 2026-08-15 broadened what had been two separate,
already-documented efforts — the living map's day/night/sunrise/sunset
visuals (§9) and the sign-in screen's day/night/dawn art (§12.4) — into
one requirement: **the entire app switches between a day mode and a
night mode together**, not just the map or just the sign-in screen.

**What "the entire app" means, confirmed with the user:**
- The sign-in screen (already scoped in §12.4).
- The landing page (`#project-screen`, §12.3) — currently a single fixed
  light "parchment card" palette with no day/night distinction designed
  at all yet.
- **The writing app itself** — map view, list view, the chapter editor,
  drawers, modals, everything under `#app` — currently a single fixed
  dark palette (`--bg`/`--panel`/`--text`/etc., see the `:root` custom
  properties near the top of `index.html`) with, likewise, no day variant
  designed. This is the largest of the three: unlike the sign-in screen
  and landing page (which are self-contained, isolated palettes already),
  the writing app's dark theme is the app's *only* theme today and touches
  every surface a user spends most of their time in. Expect this to need
  its own design pass (what does "day mode" even look like for the
  editor — a light parchment theme? something else?) before it's an
  engineering task, not just an asset-swap.

**Time source, confirmed with the user**: real astronomical sunrise/
sunset for the device's actual location (matching what §9 already
specified for the living map alone) — not a fixed clock-hour cutoff.
Computed client-side via `navigator.geolocation` + a public-domain
solar-position calculation, no backend/API key needed (consistent with
§8's no-backend-proxy constraint). This means the geolocation-decline
fallback question from §9 now blocks all three surfaces, not just the
map — needs a sensible default (e.g. assume a fixed local-clock cutoff
when location is denied/unavailable) designed once and shared, not
redesigned per surface.

**Art**: the user will supply day/night artwork (as they did for the
sign-in screen's existing sunset scene, §12.4) — not yet delivered as of
this writing. Nothing beyond the living map's four reference mockups
(§9) and the one sign-in sunset scene exists in the repo.

**Not yet decided / worth raising before implementation starts:**
- Whether all three surfaces share one single "is it day or night right
  now" computation and a single `<html>` class (extending the existing
  `motion-on` pattern from §12.2 — e.g. a `day-mode`/`night-mode` class)
  or whether each surface keeps its own independent switch. Sharing one
  source of truth is almost certainly right, mirroring how §12.2's
  motion-preference class was built once for reuse across surfaces.
  §9's `presentationConfig` resolver (Stage 1.5) is a plausible place
  for this to live, since it already resolves palette/background per
  preset.
  - Whether day/night should be a straight binary swap or, like the
  map's plan in §9, include ~1hr sunrise/sunset transition windows —
  §9 already calls for transitions on the map; whether the sign-in
  screen, landing page, and writing app should match that or use a
  simpler instant swap hasn't been discussed.
- What "night mode" even means for the landing page (currently light
  parchment) and "day mode" for the writing app (currently dark) —
  i.e. whether these are genuinely two new palettes each, or whether
  one of the two modes reuses each surface's existing palette as one
  side of the swap. Not decided.

**Do not start implementation** without first confirming the shared-
switch architecture and getting at least the writing app's day-mode
palette direction from the user — this is explicitly the biggest open
design question of the three surfaces and the one most likely to be
guessed wrong without that input.

### 13.1 Sign-in screen — implemented (2026-08-15, same session)

The user supplied `assets/auth-bg-env-day.png` and `assets/auth-bg-env-
night.png` (853×1844, matching the existing sunset scene's exact
dimensions) for the sign-in screen specifically — the other two surfaces
(landing page, writing app) are still unimplemented per §13 above; nothing
below applies to them yet.

- **Compressed to WebP before committing**, same treatment as the existing
  `auth-bg-environment.webp` (§12.4's PNG-weight lesson applied
  proactively this time): `auth-bg-env-day.webp` ~320KB, `auth-bg-env-
  night.webp` ~200KB, both via Pillow (`quality=82, method=6`). The
  original ~2.4-2.9MB PNGs are **not** committed to the repo, left on the
  user's disk only — same "commit the compressed derivative, not the
  source" pattern as the sunset background.
- **Time source**: real astronomical sunrise/sunset, implemented as
  standalone top-level functions (`calcSunTimes`, `resolveTimeMode`,
  `resolveCurrentTimeMode`, `requestGeoRefresh`, etc.) in their own
  `<script>` block just before the Supabase CDN script tag in
  `index.html` — deliberately *not* nested inside the auth-screen IIFE,
  so the landing page and writing app can reuse this exact resolution
  when their turn comes, without duplicating the solar-math. The equation
  set is the standard public-domain NOAA/Schlyter sunrise/sunset formulas,
  independently implemented here (not copied from a specific library like
  SunCalc, though the underlying math is the same well-known algorithm).
- **Geolocation-decline fallback** (§9/§13's open question, now answered
  for this surface): `navigator.geolocation` is never awaited for the
  mode shown on the *current* page load — that would either stall first
  paint waiting on a permission prompt, or cause a jarring image swap
  mid-session once/if permission resolves later. Instead: cached lat/lon
  in `localStorage` (`storymap-geo-coords`, 24hr TTL) is read
  *synchronously* and used for real sun-position math when present;
  otherwise a fixed clock fallback (6:30/18:30) is used for that load
  only. A live `getCurrentPosition()` call is only ever made to *refresh
  the cache for next time* — triggered on the existing tap/swipe gesture
  that reveals the sign-in sheet (not on cold load, so there's no
  unsolicited permission prompt before the user has done anything), via
  `requestGeoRefresh()`. Net effect: first-ever visit (or geolocation
  always declined) permanently uses the clock fallback; once permission
  is granted once, every subsequent load computes real sunrise/sunset
  instantly from the synchronously-read cache, no prompt, no flash.
- **The sunset scene isn't orphaned** — it's reused as the ~1hr transition
  art for *both* real sunrise and real sunset (±30min around each,
  `AUTH_TRANSITION_HALF_MS`), which is also the one place the existing
  ship-bob/bird-glide/lantern-flicker/ripple/sky-grade-tint animation
  layer still renders, since that's the only scene it was built against.
  Day and night are flat/static — no matching overlay assets exist for
  those yet (user confirmed: will supply them later). All of those
  sunset-specific overlay elements got a shared `auth-env-sunset-fx`
  class; `#auth-screen.auth-time-day .auth-env-sunset-fx` / `.auth-time-
  night` hide them via one CSS rule (`index.html` near `#auth-screen`'s
  other rules) rather than each element needing its own visibility logic.
- **Theme-color per mode**: `showAuth()`'s `setThemeColor()` call now
  picks from `{day:'#6b95bb', night:'#050c19', sunset:'#6b5a6e'}` (sampled
  from each image's own top-strip average color) instead of the old
  hardcoded sunset-only value.
- **Gold wordmark for night mode**: `#auth-wordmark`'s src swaps to the
  already-existing `wordmark-storymap-gold.webp` when `authTimeMode ===
  'night'` — the dark wordmark was illegible against night's near-black
  sky. Day and sunset keep the dark version, unchanged.
- **Live compass, tap-to-toggle**: `#auth-compass` defaults to the
  artwork's own resting orientation (no rotation) and is not tied to the
  sheet-reveal gesture at all — an earlier pass in this session did auto-
  start it on reveal, changed after user feedback that it shouldn't spin
  (and request a sensor permission) the moment the screen opens. Tapping
  the emblem itself (`pointer-events:auto`, was `none`) toggles live
  heading tracking on; a second tap stops it and snaps both the emblem
  and the `#auth-direction` N/W-E/S corner reference (which follows the
  same reading while tracking) back to that default. `e.stopPropagation()`
  on the compass's own click handler keeps the tap from also toggling the
  sign-in sheet underneath it. Reads `event.webkitCompassHeading` on iOS
  Safari, falls back to `deviceorientationabsolute`'s `alpha` (adjusted by
  `screen.orientation.angle`) elsewhere. iOS 13+'s
  `DeviceOrientationEvent.requestPermission()` must fire inside a direct
  user gesture — satisfied by the tap itself, requested from
  `requestCompassAccess()` inside the compass's click handler
  (`index.html`, near `attachCompassListener()`/`detachCompassListener()`).
  Same behavior across all three day/night/sunset modes — pure rotation
  layered on top of whichever background is showing, no mode-specific
  logic needed.
- **Manual scene override**: a "Sign-in screen scene" `<select>` in
  Account Settings' Preferences section (`#authscene-select`) — Auto
  (default), Always day, Always night, Always sunrise/sunset. Same
  account-wide `user_metadata` (`auth_scene_mode`) + synchronous
  `localStorage` cache (`storymap-authscene-mode`) pattern as the motion
  preference, since the auth screen resolves its mode before any session
  exists. Checked in the auth-screen IIFE right before
  `resolveCurrentTimeMode()` would otherwise run — a non-`'auto'` cached
  value wins outright, `'auto'` (or nothing cached yet) defers to the
  real astronomical computation. Verified all four values in the preview
  session that added this.
- **Not done**: the landing page and writing app still don't read
  `authTimeMode`/`resolveCurrentTimeMode()` at all — §13's original open
  questions (shared switch architecture across all three surfaces, what
  day/night even mean for a currently-light landing page and a currently-
  dark writing app) are unchanged and still block those two.

---

## 14. NATIVE MOBILE APP — React Native/Expo rewrite (`mobile/`, started 2026-08-16, in progress)

**Not part of `index.html` or this document's Stages 1-3.** A completely
separate codebase in `mobile/` (own `package.json`, its own git-tracked
source under `mobile/src/`), started after the user concluded a PWA — even
one made to feel maximally "installed" (the fullscreen manifest, auto-
updating service worker, day/night backgrounds, and live compass documented
in §13 above) — is still Chrome's rendering engine underneath, and decided
that ceiling wasn't acceptable (comparison point raised in conversation:
Kindle's own custom-drawn reading surface, which a web page fundamentally
cannot replicate). Read this section, not CLAUDE.md's brief pointer, for
the real current status.

### 14.1 What's shared with the PWA, and what isn't

- **Same Supabase project, same tables, no schema changes.** `mobile/src/
  lib/supabase.ts` uses the identical `SUPABASE_URL`/`SUPABASE_ANON_KEY` as
  the repo-root `supabase-config.js`. A chapter edited on the PWA shows up
  in the mobile app and vice versa — confirmed, not just assumed, since
  Phase 0's own verification bar was exactly this (sign in, see real data).
- **Nothing else is shared.** No UI code, no components, no CSS-equivalent
  — React Native has no CSS at all. Every screen is a from-scratch build
  using the PWA as a functional/behavioral reference, not a code source.
  PWA-specific mechanisms (service worker, manifest, the day/night/compass/
  fullscreen work in §13) have no native-app equivalent and aren't ported.

### 14.2 Stack

Expo SDK 57 (managed workflow), React Navigation (native-stack), Zustand
for state, `@supabase/supabase-js` + `@react-native-async-storage/async-
storage` (pinned to the exact version — `2.2.0` — Expo Go's SDK 57 build
expects; a newer version `expo install` initially pulled in resolved to a
null native module at runtime, see §14.5) for session persistence,
`react-native-gesture-handler`/`react-native-reanimated` (New Architecture,
Reanimated 4) for gesture-driven interactions, `react-native-reanimated-dnd`
for drag-to-reorder (chosen specifically because it's built against
Reanimated 4/gesture-handler, matching what's already installed — see
§14.5 for why the low-level `useSortableList` hook is used instead of the
higher-level `Sortable` component).

**Environment note**: this machine had no Node.js installed at all when
this track started — installed via `winget install OpenJS.NodeJS.LTS`
before anything else could happen. Worth knowing if a fresh session's
`node`/`npm`/`npx` commands mysteriously fail — check `PATH` was actually
refreshed in that shell before assuming something's broken.

### 14.3 What's built and verified on a real device

- **Auth** (`SignInScreen`, `authStore.ts`): real email/password sign-in
  against the live Supabase project, `onAuthStateChange`-driven session
  state mirroring the PWA's own auth-screen flow.
- **Project CRUD** (`ProjectPickerScreen`, `projectStore.ts`): create,
  rename, delete (type-the-project-name-to-confirm gate, hard delete —
  matches the PWA exactly, including its "no trash for projects" warning
  copy). **Project reordering** — a PWA-parity gap this session chose to
  fill anyway (the PWA has no `order` column on `projects` at all, and
  this session has no schema/DDL access, same anon-key-only constraint
  every PWA session has hit) — implemented via `user_metadata.
  project_order` (array of ids), no migration needed, same pattern as
  `motion_enabled`/`auth_scene_mode` in §12.2/§13.1. Drag-to-reorder using
  `react-native-reanimated-dnd`'s `useSortableList`, not the up/down-arrow
  version an earlier pass in this session shipped first (changed after
  feedback that it should work the same way as chapter reordering).
- **List view** (`ChapterListScreen`): Book → Act → Chapter accordion,
  ported from `renderListView()`. Real chapters from Supabase, live status
  colors/word counts. **Chapter drag-to-reorder spans the whole book, not
  just one act** — a deliberate divergence from the PWA (whose own List
  view is within-act-only by design, see `wireListDrag()`'s comment in
  `index.html` for why) — per this session's explicit request. Dragging a
  chapter past an act boundary reassigns its `act` to whichever chapter
  now sits immediately above it in the merged sequence (or below, if
  dropped at the very top); every other chapter's `act` is untouched, and
  `order` is renumbered within each resulting same-act run (not as one
  book-wide sequence) so a chapter's position among its own act-mates
  stays meaningful after an unrelated chapter moves elsewhere in the book.
  "ACT N" labels are computed live off the in-progress drag order, shown
  in a fixed-height slot reserved on *every* row (shown or blank) — this
  matters because `useSortableList` requires uniform item heights for its
  drag position math; letting only some rows grow taller for a label
  would have broken it.
- **Chapter drawer** (`ChapterDrawerScreen`): title, position ("Book X,
  Act Y, Chapter Z" — see §14.4), status pills, notes, word count vs. book
  target (read from `project_settings.chapter_word_targets`), a
  lightweight scenes list (title/status/summary only — POV autocomplete
  and requires/provides plant-tag editing are Phase 3 scope, see §14.6),
  delete. "Open full editor" button now sits *above* Delete (moved per
  feedback — was below it).
- **Chapter editor** (`EditorScreen`) — the highest-risk piece per the
  original plan, and the one that actually needed the most real-device
  iteration. Two modes: a read view with genuine inline highlight spans
  (nested `<Text>`, `computeHighlightSegments()` in `storyData.ts` — ports
  `renderAnnotatedContent()`'s exact substring-relocation algorithm, first-
  occurrence search, overlap-dropping, all of it), and a plain-`TextInput`
  edit mode for typing. Autosave debounced at exactly 1200ms matching the
  PWA's `editorSaveTimer`, flushed immediately on Done/unmount rather than
  left pending. Version history: last 10 snapshots, skip-if-unchanged/
  skip-if-empty, restore pushes the pre-restore text to history first —
  all matching `pushVersionSnapshot()`/the restore confirm copy exactly.
  **Flagging** (Plant/Reveal/Note) lives inside edit mode itself (a "Flag
  text" button opens a modal over the still-live `TextInput`, not a
  separate top-level mode — an earlier version had one, changed after
  feedback) and is built entirely independent of native `TextInput` text
  selection — see §14.5 for why, this is the single most-iterated part of
  the whole mobile track so far. Annotations store `type`/`text`/`label`
  (+`thread` for notes) only; linked-plant matching, scene requires/
  provides auto-feed, and thread-based Mythic Threads browsing are Phase 3
  (§14.6), same as the drawer's scene fields.

### 14.4 New, not a PWA feature

- **"Chapter N"** in both the drawer and editor's position line ("Book X,
  Act Y, Chapter Z") — the chapter's 1-based position within its book
  across every act, computed fresh from the store (`chapterNumberInBook()`
  in `storyData.ts`) so it stays correct after a List-view reorder. The
  PWA's own `editor-title` never had this (`${title} — ${BOOKS[book]},
  ${chapterLabel}`, no number) — built new per this session's request.

### 14.5 Real-device bugs found and fixed this session (read before touching the editor or List view again)

Everything below was found by actually testing on a physical Android
device, not by code review — this track has had a much tighter build/
verify loop than the PWA sessions typically did, and it's caught real,
non-obvious platform issues every single round:

1. **`@react-native-async-storage/async-storage` version mismatch.**
   `expo install` initially resolved `3.1.1`; Expo Go's SDK 57 build
   expects `2.2.0`. Surfaced on-device as `[AsyncStorageError: Native
   module is null, cannot access legacy storage]` *after* the JS bundle
   had already loaded successfully — looked at first like a network/
   connectivity problem (the same session also independently hit real
   Wi-Fi/Expo Go SDK-mismatch issues while just getting the dev server
   connected at all), but was a real dependency-version bug. Fixed via
   `npx expo install --fix`. **Lesson**: run `expo install --check`
   whenever a dependency-related runtime error shows up before assuming
   it's environmental.
2. **Android's multiline `TextInput` only ever selects a single word**,
   even via long-press-and-drag. Confirmed on real hardware, not merely
   suspected — this is a longstanding, still-unresolved React Native/
   Android platform bug (`onSelectionChange` unreliability for drag-
   extend selection; see e.g. `facebook/react-native#18617`, `#29365`).
   **This is why flagging is built entirely independent of native
   `TextInput` selection** (§14.3) — a tap-a-sentence-to-select custom
   mechanic instead. Do not attempt to reintroduce `TextInput`-selection-
   based flagging without re-confirming this is fixed upstream first.
3. **Per-word tappable elements froze the JS thread for 10-15 seconds per
   tap.** The first version of tap-to-select flagging wrapped *every
   word* in the chapter in its own individually-touchable `<Text>` — for
   a real chapter (thousands of words) that's thousands of nodes re-
   evaluating on every tap, enough to trigger Android's ANR ("app not
   responding") dialog. Fixed by chunking at the *sentence* level instead
   (`tokenizeSentences()` in `storyData.ts`, stops at `.!?` or a paragraph
   break) — roughly cuts node count by the average sentence length in
   words, and reads as a more natural flagging unit anyway.
4. **`react-native-reanimated-dnd`'s `<Sortable>` component triggers
   React Native's "VirtualizedLists should never be nested inside plain
   ScrollViews" warning** when embedded inside List view's outer book/act
   accordion `ScrollView` — `<Sortable>` renders its own internal
   FlatList/VirtualizedList internally. Fixed by using the library's
   lower-level `useSortableList` hook instead, which hands back plain
   items to `.map()` over inside a bounded-height `Animated.ScrollView`
   (sized exactly to content, `scrollEnabled={false}`) rather than a
   virtualized list — confirmed via the library's own documented example
   for exactly this "sortable list embedded in another scrollable
   hierarchy" case. `ProjectPickerScreen`'s reorder uses the same hook for
   consistency even though its list isn't nested in another `ScrollView`
   today, so it won't silently break if one's added around it later.
5. **Screen headers defaulting to their literal static route title**
   ("Chapter") instead of the real chapter title — happened on *both*
   `EditorScreen` and `ChapterDrawerScreen` (the second one was a repeat
   of the same bug, missed when fixing the first). Root cause was a
   `chapter?.title ?? 'Chapter'` fallback that should have just left the
   title unset, combined with using `useEffect` instead of
   `useLayoutEffect` for `navigation.setOptions()` (React Navigation's own
   documented recommendation, to avoid a title-flash). Fixed on both
   screens; if a third screen ever needs a dynamic header title, use
   `useLayoutEffect` and don't give the fallback a placeholder string.

### 14.6 Not yet built (as of the 2026-08-16 session; superseded by §14.7-§14.10)

In rough intended order (no firm commitment to this exact sequence):
Map view (interactive drag-and-drop Book→Act→Chapter trail — the PWA's
other view mode), then continuity checker/Plant Ledger/Mythic Threads/POV
tracker (Phase 3 secondary features, deferred from the drawer and editor
work above), documents library, sticky notes, full-text search, real
trash (chapter/scene delete is currently a **hard delete**, an explicit
interim compromise flagged in code comments — the PWA soft-deletes to a
trash table), the in-app Reader, word-target/account settings screens, and
eventually the AI features (already broken even in the PWA — needs a real
serverless proxy either way, see §7).

Also **not verified**: whether the general "jerky" feel reported once in
this session is a real performance problem or just Expo Go's dev-mode
overhead (no compiled optimizations, debugging instrumentation always
on) — flagged to the user as a likely factor, not chased further yet.
Worth a real perf pass against a production build (`eas build`) before
concluding anything either way, not against Expo Go.

**Sticky notes and the Reader were built in the 2026-08-19 session** (§14.7)
— this list is kept as written for history; see §14.9 for what's still
actually outstanding.

### 14.7 Session 2026-08-19 — day/night theme, the Reader, Settings, sticky notes

A single long session that took the mobile app well past initial PWA
parity. Built and iterated on a real device across many rounds of
feedback (the number of rounds is itself worth knowing — several pieces,
especially Reader text selection, took 3-4 attempts before landing; see
§14.8 for what was actually wrong each time).

**App-wide day/night theme** (`mobile/src/theme.ts`): `ThemeProvider` +
`useTheme()`, two palettes (`NIGHT_COLORS` — the app's original dark
brown/leather/gold look, unchanged — and `DAY_COLORS` — white/cream
surface, dark brown/black text; gold and error colors are IDENTICAL in
both palettes by construction, not convention, since nothing outside
theme.ts holds a raw gold/error hex anymore). Every screen consumes
`colors` via `useTheme()` and builds its `StyleSheet` from a
`makeStyles(colors)` factory instead of a static module-level object.
`ThemePreference` is `'day' | 'night' | 'auto'` — `'auto'` resolves off
the **device's own clock** (6am-6pm = day), rechecked every 60s via
`setInterval`, not the OS's light/dark display setting (an earlier version
used `useColorScheme()`; changed after explicit feedback that "auto"
should track when it actually is). The Reader's own page surface (the
actual prose) follows day/night like everything else; the Reader's
*chrome* (header/footer/action bar) is a translucent band of the current
theme's own `bg` at ~94% opacity (`withOpacity()` helper) rather than a
fixed dark overlay, so day mode's chrome reads as beige, not brown.

**Icons** (`mobile/src/components/Icon.tsx`): every icon in the app is a
hand-ported `react-native-svg` re-render of the PWA's own `<symbol>` sprite
paths (index.html:1363-1390) at the exact same `d` data — pixel-identical
shapes, not a different icon set. Extended this session with new icons
that don't exist in the PWA yet: `flag`, `copy`, `share` (Reader's
selection action bar), `align-left/center/right/justify` (Reader's Font
sheet), `sun`/`moon`/`sun-moon-auto` (Settings).

**Reader** (`ReaderScreen.tsx`, `lib/paginate.ts`, `lib/readerPrefs.ts`) —
built from scratch, not a port of the PWA's own Reader (§12.1), since the
PWA's implementation is DOM/CSS-based and has no native equivalent:
- **Real page-level pagination**: each chapter's prose is split into
  fixed-height pages via an off-screen `Text` per chapter using
  `onTextLayout` line metrics — the only way to know where text actually
  wraps without a native text-measurement API. A line's rendered text is
  matched back to a real character offset in `chapter.content` via
  sequential `indexOf` (`buildPagesFromLines`), which is what makes
  precise cross-screen jumps (see below) possible at all. Pages from every
  chapter in the current book flatten into one continuous sequence — a
  real book, not a chapter browser; paging past a chapter's last page
  lands on the next chapter's first page.
- **Two view modes**: chrome-hidden is a single edge-to-edge page,
  immersive (OS status bar + Android nav bar both hidden for as long as
  the screen is focused, `expo-navigation-bar`); chrome-visible shows the
  header/footer AND switches to a peeking three-page carousel. A tap
  toggles between them (unless a selection is active, where a tap instead
  dismisses the selection).
- **Chapter heading + page number are baked into the page itself**
  (not part of the toggleable chrome, so they're always visible), heading
  only on a chapter's first page, page number is the book-wide position
  (`bookPageNumber`), not the chapter-relative one.
- **Table of contents**: one combined slide-in-from-the-left panel (not
  RN's `Modal` slide, which only does bottom — a custom `useSlideInPanel`
  hook drives an `Animated.Value` translateX, shared with the main
  hamburger menu, see below) listing every book, expandable in place to
  its chapters. Opening it from the header ☰ (or the footer's grid icon)
  pre-expands the CURRENT book, since a bare "pick a book" list is
  redundant once you're already reading one.
- **Bookmarking**: no header button — tap the top-right corner of a page
  to set a "moving" bookmark there (local `AsyncStorage`, `lib/
  readerPrefs.ts`, anchored by `{chapterId, charOffset}` rather than a
  page number, since pagination is geometry/font-dependent and a raw page
  index would silently point at the wrong text the moment either changes).
  Tap the same corner again to remove it. A "pinned bookmark" variant
  exists in the data layer (`addPinnedBookmark`) via the selection action
  bar's Pin button, but has no browsing UI yet (§14.9).
- **Selection**: word-level (`tokenizeWords`, storyData.ts), long-press
  ONLY. A long-press always (re)starts a fresh single-word selection.
  Extending to a range rides on a plain TAP on a different word while a
  selection is active (not a second long-press — see §14.8 for why that
  didn't work). Tapping the sole-selected word again deselects; tapping
  empty space always dismisses. No drag-to-extend (dragging a selection
  handle, the way native text selection works) — RN has no reliable way
  to hit-test which word is under a moving finger without per-word layout
  measurement, and this codebase already has a documented ANR from
  per-word touchables at chapter scale (§14.5); two-taps-not-a-drag is the
  deliberate, safe substitute given that real constraint.
- **Selection action bar**: Flag (writes a Plant/Reveal/Note straight to
  `chapterStore`), Copy (`expo-clipboard`), Pin (local pinned bookmark),
  Share (native share sheet), Editor (jumps to `EditorScreen` with the
  exact substring as `jumpToText`) — all icon buttons matching the app's
  gold-outline style, not emoji.
- **Two-way Editor↔Reader jump**: `Editor: { chapterId, jumpToText? }` /
  `Reader: { ..., jumpToText? }` nav params. Reader landing is exact (it
  can search its own paginated, offset-tracked pages for the substring).
  Editor landing selects the exact substring via `TextInput.
  setNativeProps({selection})`, wrapped in `InteractionManager.
  runAfterInteractions` (not just one `requestAnimationFrame`) so it fires
  after the screen's push transition actually finishes settling.
- **Font & Layout sheet**: text size, line spacing, alignment (left/
  center/right/justify — `textAlign: 'justify'` has known inconsistent
  Android support in RN, untested how it actually renders there), a
  curated font-family choice kept to the app's own three already-loaded
  families (Serif/Sans/Mono — not a generic picker, deliberately, so it
  doesn't undercut the app-wide "same font throughout" work also done this
  session), and an in-app reading dimmer (a dark overlay, NOT the same
  thing as the Settings screen's real device brightness).

**Settings screen** (new, `SettingsScreen.tsx`, reached from the
hamburger's Assist & Project section): Day/Auto/Night as a swipeable
paging strip (not tap buttons — three segments, snap-to-page, dots below
show which is active) and a real device screen-brightness slider
(`expo-brightness`, `Brightness.setBrightnessAsync` — the **app-scoped**
call, not `setSystemBrightnessAsync`, which needs a heavier Android
permission and would affect other apps too; this only affects the screen
while StoryMap is open). The brightness slider is visually distinct from
the rest of the app — a dedicated orange-yellow color (`#f2a13c`, not the
app's usual gold) and scaled up (`transform: scaleY(1.8)`, since the
slider library exposes no track-thickness prop) per explicit request for
a "thicker" control.

**Sticky notes / "The Margin"** (new, `stickyNoteStore.ts`,
`StickyNotesScreen.tsx`, real `sticky_notes` table — id, user_id,
project_id, content, created_at, rotation): a wrapping board of
parchment-toned cards (fixed look, not theme-swapped — meant to read as
actual paper in both day and night), each with a small random rotation
generated once at creation. Cards are a **read-only preview** — tapping
one opens a full-screen editor sheet (`Modal`, big `TextInput`, same
800ms-debounce autosave pattern as elsewhere) rather than typing directly
into the 160x160 card, which was the original (worse) design. Reached from
the hamburger's "Notes" item.

**Main hamburger menu — swipe-only, no button** (`NavDrawer.tsx`): the
button was removed entirely. A thin (24px) invisible edge-swipe zone on
the left of `ChapterListScreen` (`react-native-gesture-handler`'s
`Gesture.Pan()`) opens it on a rightward swipe; a leftward swipe on the
open panel itself closes it (`failOffsetY` configured so a vertical drag —
scrolling the menu's own item list — falls through to the `ScrollView`
untouched, only a clearly-horizontal drag triggers the close). Both the
menu and the Reader's TOC share the same `useSlideInPanel` hook
(`mobile/src/lib/useSlideInPanel.ts`) for their slide animation.

**Other changes this session**:
- `EditorScreen`'s header now shows only the back arrow (no chapter
  title — it already appears in the in-page position line).
- Chapter drawer's word count glows blue (under 75% of the book's target)
  / gold (75%-100%) / red (over) instead of printing "book target: X-Y"
  as text — the target is still book-level config (`project_settings.
  chapter_word_targets`), it's just not re-stated per chapter anymore.
  "Open full editor →" → "Editor".
- List view: a "+" on each book header opens a small dialog (title + act)
  that creates a chapter directly at the top of that act
  (`chapterStore.createChapter`, `order` set below every existing sibling
  in that act so nothing else needs renumbering).
- Editor's flag Plant/Reveal label input is now multiline with real
  height (was one line); the confirm button reads "Flag" (was "Flag it");
  the selection popup is a visible gold pill with an icon + "Flag" label
  (was an ambiguous "⋮").

### 14.8 Real-device bugs found and fixed in the 2026-08-19 session

- **Reader got permanently stuck on a loading spinner after returning
  from EditorScreen.** Root cause: the pagination-reset `useEffect` keyed
  off raw `useWindowDimensions()`, and Android's own nav-bar hide/show
  animation (triggered on every focus/blur of the Reader, since it's
  immersive-fullscreen) produces small width/height jitter — each jitter
  re-triggered a full re-pagination, and if the jitter kept arriving
  faster than pagination could finish, it never terminated. Fixed with a
  10px change-threshold filter before that state actually updates.
- **EditorScreen: couldn't scroll down reliably once the keyboard/cursor
  were active.** Two contributing causes, both fixed: (1) `onScroll` was
  calling `setState` on every frame while scrolling, forcing a full
  re-render per frame and fighting the `TextInput`'s own native scroll
  momentum — now writes to a `ref` instead, only read (lazily, at render
  time) when a selection changes. (2) `KeyboardAvoidingView`'s `behavior`
  was `undefined` on Android (only iOS got `'padding'`) — now uses
  `'height'` on Android too.
- **Reader selection: multiple attempts before something that actually
  held up.** In order: (1) a sentence-level anchor/focus range that could
  select "everything between two far-apart taps" — root cause was that
  EVERY tap on prose (not just long-presses) was calling the same
  select/extend handler, so ordinary reading taps kept silently extending
  a stale selection. (2) switched to word-level, single-long-press-only,
  no extend — fixed the overselection but then couldn't select more than
  one word at all. (3) removed touch handlers from gap segments (~half of
  all segments per page) to reduce touch-responder contention — didn't
  fix it. (4) the fix that actually addressed it: stopped relying on a
  SECOND long-press to extend a selection at all (two consecutive 500ms
  holds negotiating against the page's own paging `ScrollView` turned out
  fundamentally unreliable) and moved extension onto a plain TAP on a
  second word while a selection is already active — taps are a much
  simpler, more reliably-recognized gesture than a second long-press.
  Worth remembering if selection problems resurface: the failure mode was
  never really about word-vs-sentence granularity, it was two-long-presses
  being an unreliable gesture pairing in this exact context (nested touch
  targets inside a horizontal paging ScrollView).
- **Chapter heading in the Reader was too small/high/off-font** relative
  to what was actually wanted — moved down (`top: 18` → `32`, with
  `PAGE_PAD_V` bumped `56` → `66` to keep it clear of the prose), enlarged
  (`10.5px` mono/uppercase → `17px`), and switched to track whichever
  reading font is currently selected (`proseFontFamily`, applied inline)
  instead of a fixed mono style of its own.
- A transient `Element type is invalid... SceneView` error appeared once
  in Metro's log mid-session; `tsc --noEmit` stayed clean throughout and
  every new file's default export checked out, so this was most likely a
  hot reload landing mid-edit rather than a real bug — flagged here in
  case it recurs, but not chased further since it didn't reproduce.

### 14.9 Not yet built (as of the 2026-08-19 session; see §14.10 and §17.7 for later work)

Map view, continuity checker/Plant Ledger/Mythic Threads/POV tracker,
documents library, full-text search, real trash (chapter/scene delete is
still a **hard delete** — the PWA soft-deletes to a trash table), the AI
features (already broken even in the PWA — needs a real serverless proxy
either way, see §7). Also specifically:
- **Dictionary/word-lookup on tap** in the Reader — deferred by explicit
  user choice (needs a data source/API decision first).
- **Real device-wide brightness** — Settings' slider is app-scoped
  (`setBrightnessAsync`), not the system setting; that needs a heavier
  Android permission and was explicitly scoped out.
- **Pinned bookmarks have no browsing UI** — they save (Reader's
  selection action bar → Pin) but there's nowhere to see or jump through
  the list yet.
- **Drag-to-extend text selection** in the Reader (dragging a selection
  handle, the way native text selection works) — see §14.8, two-taps is
  the deliberate substitute given real RN platform constraints, not a
  stopgap expected to be revisited soon.
- **True blur-behind-panel** for the hamburger menu / Reader TOC — both
  use a plain dim scrim (`rgba(0,0,0,0.55)`), not an actual blur
  (`expo-blur` isn't a dependency); consistent with each other, not a bug.

Also **not verified**: whether the general "jerky" feel reported once in
an earlier session is a real performance problem or just Expo Go's
dev-mode overhead — still not chased further; worth a real perf pass
against a production build (`eas build`) before concluding anything.

---

### 14.10 Session 2026-08-22 — the Reader stops making flags, and starts showing them

The graph work from this same session is in §17; this is the mobile app's half of it.

The Reader no longer creates or edits story flags. The Flag button and its Plant/Reveal/Note
sheet are gone; `beginFlag` is gone with them. What it does instead is **show** the flags
that exist, and only when asked: a flag toggle in the header tints plants green, reveals red
and notes amber, using the character web's own colours so a line flagged green there is
green here. **Off by default** — the marks are for the moments you go looking for them, and a
chapter permanently striped in three colours is a chapter you cannot read. The preference
persists (`showFlags` in `readerPrefs`, which spreads over the defaults, so prefs saved
before it existed come back with it off rather than undefined).

Selecting a tinted passage prints what it is and what pair it belongs to, read-only, under
the action bar — otherwise the colour is a mystery — and **tapping that caption opens the
character web on that exact flag**, which is the finest granularity there is. A legend in the
footer names the colours and counts them, shown only while the toggle is on and the chapter
actually has flags.

**Highlighting stays.** It writes to `annotations` like a flag does, but it is a reading
mark, not a story flag — no label, no place in the Flags list, and the data model has drawn
that distinction since `chapterStore.ts` was written. Copy, Pin, Share and Editor stay too;
Pin is a local bookmark and changes no chapter.

One resolver now locates every annotation type rather than one per type — they differ in
what they mean and how they are drawn, not in how they are found — and the page renderer
takes a `MarkedTokens` record of three token sets instead of a single highlight set. Sets,
because that lookup runs per word per frame. `note` annotations are skipped: they have no
inline appearance of their own.

**Reachable from both screens, at any granularity.** The Reader's header gained the same
`link` icon the nav drawer uses and the Editor a "Web" button beside "Reader", both opening
the character web on the chapter in hand. Finer than that: a tap on a flag caption in the
Reader, or the "web" link beside any row of the Editor's Flags list, opens the web on that
one flagged line.

The route carries a single `focusNodeId` and needs no translation at either end, because a
chapter, a scene and an annotation are all graph nodes under their own database ids. An
earlier version of this passed `focusChapterId` and made the screen hunt for the event whose
`properties.chapter_id` matched; that is gone, and so is the case it could not serve — a
chapter with no event, which is any chapter nobody has been placed in.

**Traps:**

- `readerPrefs.loadReaderPrefs()` spreads over `DEFAULT_READER_PREFS`, which is why adding
  `showFlags` did not strand everyone who had saved prefs before it existed. Any new pref
  must keep that property.
- The page renderer takes a `MarkedTokens` record of **Sets**, one per mark kind. That
  lookup runs per word per frame; an array would not do.
- `EMPTY_MARKS` is shared rather than constructed per render — a page from a chapter other
  than the current one should not allocate three sets to say "nothing here".

---

## 15. IN-APP ASSISTANTS — Icarus and Daedalus (groundwork built 2026-08-21, dormant)

**Status: infrastructure complete and committed, deliberately not switched
on.** The database objects exist in the live project, the Edge Function and
both agent configurations are written, and the app has a toggle, an indexing
pipeline and a chat panel. Nothing runs and nothing is billed, because the
function has not been deployed and no API keys have been bought. This was an
explicit decision — build the groundwork now, defer the spend — not an
unfinished build.

### 15.1 Why an in-house agent rather than MCP

Both were considered. MCP would let *Claude* reach into StoryMap, which is
useful and worth adding later, but it cannot meet the stated objective: an
assistant **inside StoryMap, in real time, without going back to Claude**.
MCP is a second door onto the same retrieval layer, not a substitute for it,
and the retrieval layer has to exist either way.

The one real cost of choosing in-house: it bills to an API key. A Claude
Pro/Max subscription cannot power a third-party app — that is what MCP would
have given, and it is why MCP stays on the roadmap rather than being
dismissed.

### 15.2 The two agents, and why they differ structurally

They are not one assistant with two prompts. They differ in model, context
strategy and tools, because they answer different kinds of question.

**Icarus — validation.** Most of its work should never reach a model at
all: continuity checking is already keyword matching, "which sticky notes
are referenced nowhere" is a SQL query, "which POV has gone quiet" is a
query over scene metadata. Paying an LLM to do arithmetic over our own
tables is waste. The model is there only for the judgment step — *is this
actually a contradiction, or two compatible phrasings?* — which is
classification, and defaults to **Haiku 4.5** (the engine is selectable per agent --
see §16). Its system prompt forbids
proposing replacement prose and requires a quote for every finding.

**Daedalus — judgment.** Defaults to **Opus 5** with adaptive thinking and
`effort: high`. The motivating question — *would a mythological parallel
work for this character, why, how far should the resemblance run, and where
should it stop* — is not answerable from retrieved passages, because it is
about the shape of the saga rather than any passage in it. So Daedalus also
receives a **project digest** (every chapter's book/act/position/title/
status plus the canon documents), assembled per request in `buildDigest()`.
It has the **web search** server tool so comparisons to published work are
grounded rather than recalled — a model reasoning from memory about what
made a novel distinctive is exactly where confabulation appears, and here it
would be confabulation the writer acts on.

Deliberate choice: the agent is picked **per question by the writer**, not
routed automatically. Daedalus costs several times what Icarus does per
answer, and that is the writer's call, not something to hide behind a router.

### 15.3 Files

- `supabase/migrations/20260821_assistant_retrieval.sql` — **already run**
  against the live project (verified: `content_chunks` returns `[]` under
  RLS, `content_chunk_status` returns `{total: 0, embedded: 0}`).
- `supabase/functions/assistant/` — `index.ts` (routes), `chunk.ts`
  (chunking + hashing), `agents.ts` (the two configurations).
- `supabase/README.md` — deployment procedure, including how to get DDL
  access without the CLI.
- `mobile/src/lib/assistant.ts`, `mobile/src/store/assistantStore.ts`,
  `mobile/src/screens/AssistantScreen.tsx`.

### 15.4 Decisions worth not re-litigating

- **Chunks are a separate table**, not columns on `chapters`/`documents`:
  one chapter is many chunks, and a chunk must be able to point at either
  kind of source.
- **`match_content_chunks` is SECURITY INVOKER.** RLS therefore still
  applies and one account can never retrieve another's prose even if a
  project id were wrong or forged. A SECURITY DEFINER function here would
  bypass exactly the protection that matters most for this table.
- **HNSW, not IVFFlat.** IVFFlat must be built against existing data to
  choose its lists and degrades badly when created against an empty table,
  which is precisely the situation at migration time.
- **Chunking splits on paragraphs, never a character count.** A retrieved
  chunk is quoted back to the writer as evidence; one starting mid-sentence
  reads as a misquote of their own prose. Overlap is carried because a claim
  and the sentence qualifying it often straddle a boundary. Tested against
  manuscript-shaped prose, degenerate inputs, and a paragraph with no
  sentence punctuation at all — that last case produced a single
  22,889-character chunk before a hard word-boundary fallback was added, and
  would have failed the embedding call outright.
- **Chunks carry a content hash.** Editing one paragraph re-embeds one
  chunk, not the chapter. This is the difference between indexing being
  background noise and being a bill.
- **The toggle lives in `user_metadata`, not on the device.** It is a
  billing switch; it should not be possible to have it off on the phone and
  quietly on somewhere else.
- **Indexing is gated on the same toggle as asking.** Embedding is itself a
  paid API call, so a toggle that still spends money in the background is
  not a toggle.

### 15.5 What remains before it can run

1. Buy an Anthropic API key (set a spend cap in the console).
2. Decide the embedding provider and get that key — see §15.6.
3. `supabase secrets set --env-file supabase/.env` (the root `.gitignore`
   added in the same session covers that file; a key reaching git history
   must be **rotated**, not deleted).
4. `supabase functions deploy assistant --use-api` — `--use-api` bundles
   server-side, avoiding a local Docker requirement.

Until then the app reports "not set up on the server yet" rather than a raw
network error, so the dormant state reads as a step not taken rather than a
bug.

### 15.6 Open decision: the embedding provider

**Anthropic has no embeddings API**, so retrieval needs a second vendor.
Built against **Voyage** (`voyage-3.5`, 1024 dimensions), Anthropic's
recommended partner. This is not settled:

- The `vector(1024)` column type is sized for Voyage. Changing provider
  later means altering that column and re-indexing everything, so it is
  cheaper to decide before the first index than after.
- Open-weight models were raised as an alternative and are worth taking
  seriously. Kimi K2.6 is roughly $0.95/$4.00 per MTok against Opus 5's
  $5/$25 — about five times cheaper — and the same providers serve open
  embedding models, which would collapse this to **one vendor and one key**.
- The honest split: Icarus's work (constrained classification against
  supplied evidence) is where open models are genuinely competitive.
  Daedalus's is not — what is bought there is judgment and calibration, and
  cheaper models produce craft advice that sounds authoritative and is
  generic, which is the hardest failure mode to detect without already
  knowing the answer.
- **Weigh data retention above cost.** This is five books of unpublished
  fiction. Anthropic does not train on API traffic; policies vary widely
  across open-model hosts, and the cheapest resellers tend to be the
  vaguest.

Recommended next step when this resumes: make provider and model **per-agent
configuration** (most open-model providers are OpenAI-compatible, so the
change is confined to the two model-calling functions), default Icarus to a
cheap model and Daedalus to Opus, then evaluate Daedalus on questions where
the writer already knows what good looks like.

### 15.7 Not built

The deterministic half of Icarus — the SQL checks that should run before any
model is called (unpaid plants, unreferenced sticky notes, POV gone quiet) —
is designed but not written. The proposal/review queue for canon-document
edits, so the assistant proposes a diff rather than writing directly, is also
designed and not written; it exists specifically to honour the project's
"destructive actions get a confirmation and a trash entry" rule.

---

## 16. SELECTABLE ENGINES, AND WHAT ACTUALLY DEFINES AN AGENT (2026-08-21)

**Supersedes the model claims in §15.2.** Haiku 4.5 and Opus 5 are now only the
*defaults* for Icarus and Daedalus. The engine is writer-selectable per agent, and
deliberately so: the model is the least important thing separating the two.

### 16.1 The provider layer

`supabase/functions/assistant/models.ts` holds a catalogue; `call-model.ts` is the one
place any provider is called. Two dialects cover the field — Anthropic's own, and the
OpenAI chat-completions shape every open-model host has standardised on.

- **Providers**: Anthropic, OpenRouter, Moonshot, OpenAI, and `custom` (any
  OpenAI-compatible base URL — self-hosted vLLM, Ollama behind a tunnel, Together,
  DeepInfra). Each names the Edge Function secret holding its key.
- **Catalogue**: Opus 5 / Sonnet 5 / Haiku 4.5, Kimi K2.6 (via OpenRouter or Moonshot
  direct), DeepSeek V3.2, Qwen3 235B, GPT-5. Each carries rough per-MTok pricing, used
  only to show a per-question estimate in the picker.
- **Selection is validated server-side** against the catalogue rather than trusted, so a
  stale app build cannot ask for a model that no longer exists or route one provider's
  key to another's host.
- Thinking and effort parameters are applied **only to models that accept them**; web
  search only where the agent has the tool and the provider exposes it.
- The choice lives in `user_metadata.assistant_models`, per agent.

**The catalogue is duplicated** in `mobile/src/lib/assistantModels.ts` because Deno and
React Native cannot share a module. Both files say so and name each other. If they drift,
the app offers a model the function rejects.

### 16.2 What separates Icarus from Daedalus

In descending order of importance — none of it is the model:

1. **Tools.** Icarus reaches structured story data: open plants, unmet requirements,
   deferred requirements, idle threads, POV gaps, unused notes. Daedalus reaches prose,
   canon documents, the outline, and web search. Neither can call the other's.
2. **Permissions.** Icarus is read-only and forbidden from writing prose at all.
   Daedalus may propose document edits, which arrive as a diff to accept or reject.
3. **Output contract.** Icarus answers under a JSON schema (verdict, summary, evidence
   quotes) enforced rather than requested — a validation agent allowed free prose
   eventually replies "this looks broadly consistent", which is not a finding and cannot
   be acted on or dismissed. Daedalus answers in prose, because its job is explanation.
   The app renders findings as an evidence checklist, falling back to raw text if a host
   ignores the schema (open-model hosts vary on how strictly they honour it).
4. **Retrieval.** Daedalus additionally receives a project digest, because the shape of a
   saga is not retrievable from passages.
5. **Lifecycle.** Icarus's findings are meant to be persistent dismissible items;
   Daedalus is a conversation.

A cheap model running Icarus is still Icarus. That is the point.

The agent is chosen **per question by the writer**, not routed automatically — Daedalus
costs several times more per answer, and that is the writer's call rather than something
to hide behind a router.

### 16.3 Still true from §15

Everything is still dormant. No key has been bought, the function is not deployed, and
nothing bills. The remaining steps and the open embedding-provider question are unchanged
(§15.5, §15.6).

---

## 17. CHARACTER KNOWLEDGE GRAPH (2026-08-21, built)

Built to a written spec supplied in conversation; that spec's §9 explicitly invited
deviation with justification, and the deviations are listed at §17.5 below. Replaces Map
view as the spatial surface on mobile — a portrait phone cannot usefully show the PWA's
SVG trail.

### 17.1 Schema

Five migrations, each replacing `character_graph()` in place:

| File | Adds | Run against live? |
|---|---|---|
| `20260821b_character_graph.sql` | the two tables, the pair view, the function | **yes** |
| `20260821c_graph_progression.sql` | events and presence | **yes** |
| `20260821d_graph_detail.sql` | individual interactions | **yes** |
| `20260822_graph_flags.sql` | plants and reveals | **no** |
| `20260822b_graph_structure.sql` | chapters, scenes, notes | **no** |

The last two are **not yet run**. `20260822b` supersedes `20260822` entirely, so pasting
only the newer one into the SQL Editor is enough. Until then the Plants & Reveals and
Structure layers return nothing and **nothing else breaks** — `fetchCharacterGraph` defaults
each key of the payload independently rather than assuming the whole shape, so an app
talking to an older database loses a layer rather than the view. The client also records
whether the `flags` key came back at all, which is what lets the screen say "run the
migration" instead of the misleading "nothing has been flagged yet".

A property graph over two tables rather than a second database technology — at saga scale
(dozens of characters, hundreds of events, low thousands of edges) recursive CTEs are
more than adequate.

- **`graph_nodes`** — `node_type` in character / event / location / faction / fact,
  `label`, `properties` jsonb, `source` (extracted / manual / manual_override),
  `confidence`, `needs_review`.
- **`graph_edges`** — `from_node_id`, `to_node_id`, `edge_type` in PRESENT_AT /
  INTERACTS_WITH / KNOWS_ABOUT / CAUSES / MEMBER_OF, `event_id` (nullable — null means
  saga-level), `properties`, `confidence`, `needs_review`, `source`.
- **`character_pair_edges`** view — collapses a character pair into one visual edge with
  a count, event list and dominant type.
- **`character_graph(project_id)`** — everything the renderer needs in one call: nodes,
  events, aggregated links, individual interactions, presence, flags, chapters and scenes.
- **Flags, chapters and scenes are not in `graph_nodes` at all.** Flags are read out of
  `chapters.annotations` — the same jsonb the editor writes when a writer flags a line —
  and chapters and scenes straight out of their own tables. Copying any of it into
  `graph_nodes` would make a second source of truth that drifts the moment something is
  edited, and would need a sync path nobody would remember to run. Reading live means
  flagging a line in the editor puts it on the web immediately and unflagging takes it off.
  The annotation fields the graph reads beyond the existing ones are `pairId`, `pairLabel`
  and `sceneId`; all optional, and a flag without them belongs to its chapter and no pair.
- **A flag anchors to its chapter, or to its scene where it names one — not to an event.**
  It used to anchor to the event, which meant a flag in a chapter nobody had been placed in
  had nothing to attach to and floated. An annotation belongs to a chapter, and a chapter
  always exists.
- **`character_footprint(character_id)`** is unchanged and still the POV filter.
### 17.2 Extraction

`supabase/functions/assistant/extract-graph.ts`, on the Icarus tier (Haiku 4.5),
structured-output only. Reuses the retrieval pipeline's paragraph chunker and content
hashing, so only changed paragraphs are re-read. Receives a window of surrounding context
for pronoun resolution and a roster of known characters with their aliases.

Writes PRESENT_AT, INTERACTS_WITH and KNOWS_ABOUT edges plus fact nodes. A
`manual_override` row is never overwritten; the conflict is logged instead.

### 17.3 The renderer

One HTML document — `mobile/src/lib/characterWebHtml.ts` — used by the WebView on mobile
and intended for the PWA to serve verbatim rather than growing a second implementation.

`graph/character-web-demo.html` is **generated** by `scripts/build-graph-demo.mjs`: the
markup comes straight out of `CHARACTER_WEB_HTML` and the data is the real demo pack,
shaped exactly as `character_graph()` shapes it. It used to be a hand-maintained duplicate
with an invented cast pasted in, and had already begun to drift — two copies of a file
that must behave identically is a promise nobody keeps. Served by the `graph-preview`
launch config for looking at it in a browser.

That generator also **fails loudly if the extracted markup contains a backtick**, because a
backtick inside a `String.raw` template ends the template — the TypeScript module is broken
while the extraction, which reads to the *last* occurrence, still produces a page that
looks perfectly fine. This happened, in a comment quoting an identifier.

**Four layers, switched rather than merged:**

- **Relationships** — character to character, coloured by interaction type on a fixed
  palette. Strictly one hop.
- **Progression** — character to event, in chapter order. Selecting a character lights
  their chain of events *and every other character standing in those events* — a
  deliberate second hop, only in this mode, because the point of a progression is who
  else is in the room.
- **Plants & Reveals** — plant to reveal, plus notes, with a sub-row of filters: All /
  Plants / Reveals / Notes / Pairs / Unpaid. Selecting either end lights the whole pair and
  the moments both ends land in. An unpaid plant says so in words rather than expanding to
  an empty list; so does a reveal with no plant. A note is a flag with no far end: it gets
  its quote and its label and stops there, and is excluded from Pairs and Unpaid, which are
  about plant/reveal pairs by definition.
- **Structure** — book → act → chapter → scene, the same hierarchy the map uses, with every
  chapter carrying its scenes, its flags and its moment. This is what makes the web
  reachable at every granularity rather than only at "character" and "moment".

**A mythic thread is a note, not a seventh kind of node.** A note is an author's idea for a
line, scene or arc; a mythic thread is the subset of those that echo a known mythological arc
or setting. So it is a note carrying two extra fields -- `thread` names the parallel,
`characterId` says whose arc it belongs to -- and keeps the note's shape, anchoring and
panel. It changes colour (teal, to be told apart from the amber it is a subset of and the
plant green beside it) and gains one link, to its character. That link is what makes "show me
this person's threads" one hop rather than a scan. Threads are excluded from Pairs and Unpaid
for the same reason notes are, and from the Notes index tab, which would otherwise list them
twice. Authored from the Editor's Flags list, on note rows only.

**Plants and reveals are many-to-many, in both directions and both ways round.** Several
plants can converge on one reveal; one plant can spawn several reveals; and a single flag can
belong to more than one setup/payoff *grouping*, because a line of prose can be doing two
jobs at once. That last part is what the original one-`pairId`-per-flag shape could not
express at all.

A flag carries `pairs: [{id, label}]`. The RPC promotes a legacy single `pairId`/`pairLabel`
to a one-element array, so the client only ever sees the new shape. Every plant in a grouping
is joined to every reveal in it, deduplicated — two flags can share more than one grouping,
and the same two nodes joined twice would silently double the drawn weight of a link.

Consequences worth knowing:
- **"Paired"** means *any* grouping it belongs to has both ends. A flag answered in one and
  open in another is answered.
- **"Unpaid"** means nothing anywhere claims it, not "one of its groupings is thin".
- The panel names every grouping a flag is in and, when there is more than one, says which
  one each counterpart is reached **via**.
- Authored from the Editor's Flags list on plant and reveal rows. Groupings offered are those
  already used in **that chapter** — the editor holds one chapter, so a reveal three chapters
  later has to be joined from its own side. A real limit, not an oversight.

**Chapters are not events, and both are returned.** An event is somewhere characters are
present, written by extraction or by hand; a chapter with nobody placed in it has none. A
chapter exists regardless, owns the prose, and is what an annotation actually hangs off —
which is why flags now anchor to their chapter (or their scene, where they name one) rather
than to the chapter's event. Under the old arrangement a flag in an unpopulated chapter had
nothing to attach to and floated.

The panel changes with the mode: relationships lists individual interactions, progression
lists the arc with POV chapters marked, a flag shows its pair's title, the flagged line
itself, and the far end. All are headings that expand to a paragraph or two, one open at
a time.

**Serial numbers on events.** Chronological by default — 1..N over every event in the
project, in chapter order, drawn inside the diamond. In Progression *with a character
selected*, that character's own events renumber from 1 at the start of THEIR arc, and
every other event drops its number entirely rather than showing a chronological one
beside a progression one. Two numbering schemes on screen at once, meaning different
things, is worse than fewer numbers.

**The progression path.** Selecting a character in Progression also strokes a gold ribbon
through their events in order, with an arrowhead per segment so the direction reads. It is
drawn in `onRenderFramePre`, not as extra links: a link would join the simulation and pull
the events into a ring, whereas the overlay reads the positions the layout already chose
and never influences them. The gold spokes fanning out of the character stay as they were —
the ribbon is the other half of the answer, the *order* those events happen in.

**Tapping an event turns it blue.** The node takes a bright blue and a canvas glow (an
emissive material in 3D); the lines running out of it take a darker blue, so the node still
reads as the thing that was tapped rather than dissolving into its own edges. Gold stays
the colour of a selected *character*.

Six shapes, all distinct, checked by a build-time trace rather than by eye: a character is a
circle, an event a diamond, a chapter a hexagon (the only shape that reads as a container), a
scene a square, a note a page with its corner turned down, and a plant and a reveal are
triangles pointing up and down respectively — so a pair reads as two halves of one shape
before anyone notices the green and the red, which matters for anyone who cannot tell those
apart. In 3D the correspondence holds: octahedra for events, a dodecahedron for a chapter,
boxes for scenes and notes, tetrahedra for plants and reveals. Labels are drawn, not
hovered: a graph of unlabelled dots cannot be navigated.

**The detail panel is a sheet, not a modal.** It was a fixed 42vh slab with no way to
dismiss it, which on a phone is most of the graph -- and the node just tapped was as often
as not underneath it. It now collapses to its own title bar (tap the caret or drag the bar
down), closes outright, and caps at 38vh; `focusCamera` offsets a selection upward by half
the sheet's height so selecting from the index never parks the node behind the panel
describing it. The canvas above the sheet was always interactive; there was simply hardly
any of it.

**Reachable from the Reader and the Editor at every granularity**, not only the nav drawer.
The route takes one `focusNodeId`, and no translation is needed at either end: a chapter, a
scene and an annotation are all nodes under their own database ids. So the Reader's header
button hands over the chapter being read, a tap on a flag caption hands over that single
flagged line, and the Editor does both from its toolbar and its Flags list. The renderer
switches to whichever layer can draw the kind it turns out to be — flags to Plants &
Reveals, chapters and scenes to Structure, events to Progression — and ignores an id it does
not recognise, which is the right answer for something deleted since the screen opened.

**The index** (the hamburger chip) is a full-screen searchable list with five tabs —
Characters, Events, Plants, Reveals, Pairs — because past a couple of dozen nodes, finding
a specific one by panning the web stops being viable. Tapping a row selects the node,
centres the camera on it, and switches to a layer that can actually show it: a flag tapped
from the index switches to Plants & Reveals and clears any sub-filter hiding it, rather
than selecting something invisible.

**A layer switch reframes the camera** (`zoomToFit`), and so does a flag filter. This is not
cosmetic: switching layer replaces every node in the graph, and leaving the camera where it
was aims it at a region the new layer has nothing in. Since selecting anything zooms to 2.4x
and centres on it, the ordinary sequence -- tap a character, switch to Plants & Reveals --
landed on empty space with fifty-six nodes just off screen, while the layer's own counter
read "28 plants · 28 reveals". The refit is deferred rather than immediate because nodes new
to a layer have no position until d3's next tick; fitting before that frames only the
handful that carried over. `focusCamera` cancels a pending refit, or the framing it just
chose would be thrown away a moment later.

**Layer switching rebuilds `graphData`** from the same node objects rather than hiding
nodes in place. A hidden node still exerts charge, and fifty-odd flag nodes silently
shoving the cast apart in Relationships was worse than the reheat that reusing the objects
costs — positions survive, because d3 keeps x/y on the objects themselves. Under a flag
filter, events with no surviving flag are dropped too: sixteen empty diamonds around four
unpaid plants is the filter failing to filter.

**2D is the default and the only renderer loaded up front.** 3D and its dependencies are
fetched on first use; if that fails the graph stays in 2D and says so.

### 17.4 The three.js loading problem, recorded so nobody repeats it

Three attempts, and the constraint is not obvious:

- three.js has shipped **ESM-only since r160**, so there is no UMD build to put in a
  script tag. `three@0.180/build/three.min.js` is a 404 — and it fails **silently**,
  taking `three-spritetext` with it, since that needs the `THREE` global.
- Pinning back to r160 for its UMD build then breaks `3d-force-graph`, which calls
  `THREE.Timer` and requires a *newer* three.
- The working arrangement: import three dynamically as a module and publish it as
  `window.THREE` before loading the two UMD libraries that expect it.

### 17.5 Deviations from the supplied spec

*(Section numbers below refer to **that spec**, not to this document — which also has a §9,
about something else entirely.)*

1. **§9.1 aliases** live in the character node's `properties`, not a separate table, with
   a unique index on `(project_id, lower(label))` making one canonical character per name.
   A first-seen name is **always** queued for review regardless of confidence — a wrong
   character is the error that compounds, since every later passage attaches to the twin.
   Merging repoints every edge and folds the duplicate's name in as an alias.
2. **§9.2 edge aggregation — resolved by doing both.** Storage keeps one edge per event;
   the view collapses a pair for drawing. Neither fidelity nor legibility is traded.
3. **§3.1 extraction does NOT hook the debounced autosave.** Autosave fires 1.2s after a
   keystroke, so a paragraph being typed changes hash on nearly every save; content
   hashing prevents wasted *embedding*, not wasted *model calls*. It runs on leaving the
   editor, the first moment a paragraph is plausibly finished.
4. **§3.4 nothing below the 0.6 threshold is discarded** — it is written with
   `needs_review` set. A cautious model should never silently lose a real interaction; the
   threshold only decides what gets confirmed.
5. **§9.5** the renderer starts in 2D rather than falling back to it. Hit-testing a sphere
   at portrait width proved unreliable in practice (a click two pixels off does nothing at
   all). 3D remains available and is the full experience on a wide screen.
6. **Not in the spec:** extraction is gated on the assistant toggle, like indexing. It is
   a paid call.

### 17.6 Traps worth remembering

- **Two partial unique indexes**, not one, on the edge natural key. Postgres treats NULLs
  as distinct, so a single index lets unlimited duplicate saga-level edges through —
  exactly the rows most likely to be re-extracted.
- A **unique violation rejects the whole insert**, which surfaces as an empty graph with
  no error anywhere useful. This happened: the demo fixture had two saga-level edges
  between the same pair, and the import produced every character and not one
  relationship.
- An event nobody is present at is **not drawn**. It is a chapter no one has been placed
  in, and drawing it scatters unreachable dots.
- **A backtick in a comment inside the renderer breaks the module** and nothing about the
  generated demo page will tell you. See §17.3; `build-graph-demo.mjs` now checks for it,
  and `tsc --noEmit` catches it too.
- The renderer's chip row **wraps to two lines on a narrow phone, three with the flag
  filters showing**. Native chrome pinned to a fixed offset near the top lands on it — the
  screen's add buttons moved into the navigation header for exactly this reason, and
  anything added there later should go the same way.
- The link index is stored on the link object (`l.i`) at build time. `indexOf` over the
  link array, per link, per frame was fine at a few dozen links and is not at several
  hundred; the same applies to any per-node scan added to the draw call. `labelEverything`
  is computed once per view rebuild for the same reason — it was a `filter` over every node,
  inside the draw call, per node, per frame.
- **`byId` is built before the links**, not after, because a flag link has to ask whether
  the scene it names actually exists before anchoring to it. Moving that back breaks
  scene-scoped flags silently — they fall back to the chapter and nothing complains.
- **`focusCamera` clears `refitPending`.** A layer switch queues a `zoomToFit` 800ms out; a
  camera aimed deliberately in between would otherwise be thrown away by it.

### 17.7 Not built

Multi-hop cascade beyond the deliberate second hops (Progression's "who else was there",
Plants' "where does the far end land", Structure's chapter→scene→flag), the time-scrubber
("as of Book N" — flagged in the spec as the highest-value deferred feature), automatic
faction/location extraction, and the PWA's own embedding of the renderer.

**Nothing can be created or edited from this view.** It is a reading surface: it shows the
graph, isolates parts of it, and navigates to them. Specifically —

- **Pairing.** `pairId`/`pairLabel` are written only by the demo pack's build
  (`scripts/demo-plants-reveals.mjs`); the editor's Plant/Reveal buttons still write an
  unpaired flag. So every pair the app can *show* is one the app cannot *make*. This is the
  largest gap in the feature.
- **The PWA's `linkedPlant` shape** — `{chapterId, annotationId}` on the reveal — is a
  different model of the same relationship and is not read here. Whichever survives, the two
  halves of the app should not keep both.
- **Scene-scoped flags.** `sceneId` is read end to end and written only by the demo build.
  No UI offers the choice.
- **Books and acts are not nodes.** Structure draws chapter→scene; the two levels above that
  are carried as properties on the chapter (`book`, `act`) and shown in its panel, not drawn.
  For seventeen chapters that is right; for five books it may not be.

---

## 18. DEMO PACK (`demo/`, 2026-08-21)

A disposable test project — "The Southern Wing" — authored separately and converted into
a fixture by `scripts/build-demo-fixture.mjs`. **The markdown is the source of truth:**
edit it, re-run the script, the app picks it up.

Loaded from the app's Projects tab, not pushed from a script here, because every table is
behind row-level security — rows are written with the signed-in user's id, so a script
holding only the anon key has no session and its inserts are correctly rejected.

**Contents:** 17 chapters across 3 acts, 74 scenes carrying POV, 9 documents, ~15,000
words of prose, 11 characters with aliases, 26 relationships of which 15 are scoped to a
chapter, and 27 plant/reveal pairs flagged into the prose as 28 plants and 28 reveals.
Nine relationships arrive flagged for review so the queue has real work in it.

**The plant/reveal pairs** live in `scripts/demo-plants-reveals.mjs`, kept apart from the
build script because they are content rather than machinery — a writer editing the table
should not have to find it inside a build script. Each end is anchored by a **verbatim
quote** rather than a character offset, which is how annotations relocate themselves
everywhere else in this app. The resolver:

- Matches against a **normalised copy** of the prose with curly quotes and dashes folded
  to ASCII, so a quote pasted out of a plain-text document still matches typographic prose.
  The fold is strictly one character for one, so the offset found in the folded copy
  addresses the same span in the original and the text actually stored keeps the prose's
  own punctuation. An ellipsis character is deliberately *not* folded — three dots for one
  would break that alignment.
- Treats `...` inside an anchor as an **elision**: the fragments either side are located in
  order and the whole span between them becomes the flagged text. This is what lets a
  quote skip a subordinate clause without anyone transcribing the clause perfectly.
- **Throws** if an anchor does not match, matches more than once, or if two flags in one
  chapter overlap. All three matter: a flag whose anchor silently fails is simply not in
  the book and nothing in the app would say so, and overlapping flags are dropped at
  render time in array order, which would make one end of a pair invisible for reasons
  nothing explains. Two anchors failed on the first run — both cases of a closing quote
  falling after a comma rather than before it.

Three pairs are **deliberately unpaid** (the jasmine flower, the anklets/mirror/lamp, the
damaged portrait) and one — the accountant thread — is paired in the prose in a way that
**contradicts the planning documents**, which say it should stay unresolved. Both states
are carried rather than tidied away; the contradiction is stated on both ends of that pair.
Where the supplied table quoted a line that is structural rather than literal, or cited the
wrong chapter, the label says so instead of the discrepancy being smoothed over.

**Behaviours worth knowing:**

- Chapter `order` is the chapter *number*, so the Ch 0 prologue keeps its place ahead of
  Ch 1 rather than being renumbered.
- POV lands on **scenes**, which is what the POV tracker reads.
- Relationship explanations are **parsed from the bible's own prose**, not rewritten, so
  editing the bible changes what the graph says. A build-time guard fails if any edge has
  no explanation — an interaction that expands to nothing reads as broken rather than
  unwritten. It caught one on the first run.
- Short names are stated explicitly rather than derived positionally. Taking the last word
  works for "Karanavar Sankaran Thambi" but yields "Joseph" for "Dr. Sunny Joseph", which
  silently dropped all five edges involving the busiest character.
- Presence is derived from a chapter's POV plus any relationship scoped to it. That
  understates the truth — people appear in scenes they neither narrate nor interact in —
  but never invents a presence, which is the right direction to be wrong in.
- **Exactly one demo project survives a load.** `removeStaleDemoProjects()` deletes the
  rest on success; a load that fails part-way deletes its own half-built project and leaves
  the previous demo alone, so neither a run of successes nor a run of failures can
  accumulate copies. Only projects whose name starts with the demo's own prefix are ever
  candidates — real work is never touched, and neither is a project called "The Southern
  Wing" without the suffix.
- This did not hold before 2026-08-22, and copies piled up. The old version could fail in
  **three silent ways** and every one of them looked like success:
  1. the read that found the old copies **discarded its error**, so a failed read was
     indistinguishable from "there are no old copies";
  2. the delete reported `stale.length` as the number removed rather than what the database
     actually deleted — and **a delete refused by row-level security returns no error and no
     rows**, so a blocked delete reported a clean sweep;
  3. cleanup ran **only on the success path**, and there were seven earlier `return`
     statements that skipped it.
  All three are fixed: the read surfaces its error, the delete uses `.select('id')` and
  counts the rows that actually came back — saying so plainly when fewer come back than were
  asked for — and every exit routes through one `finish()` helper so no path can forget.
  The count is now reported on the demo card instead of being discarded by the caller, which
  is why nobody noticed.
- Matching is done in JS with `startsWith` rather than a PostgREST `like` filter. The filter
  was **not** the bug — the project name has parentheses in it and those survive the round
  trip, confirmed against the live API — but a client-side check cannot be wrong about
  escaping, and a writer has few enough projects that reading them all costs nothing.
- The Projects tab shows a **"Keep only the newest demo"** action whenever more than one
  exists. Loading the demo already leaves one behind; that action is for a pile that
  accumulated before this was fixed, so clearing it does not require a re-import.
- Flags land in `chapters.annotations`, which means they render as marks in the editor and
  the Reader as well as feeding the character web's Plants & Reveals layer. There is one
  source of truth, not two.

**Notes.** The pack had none, which left the character web's Notes filter with nothing to
draw and no way to tell whether it worked. They are derived rather than written: the Act
Breakdown already states what each chapter closes on, so that line becomes a note anchored to
the chapter's actual closing sentence — real pack content, mechanically placed, nothing
invented on the writer's behalf. Attached to the chapter's **last scene** rather than to the
chapter at large, because a note about how a chapter ends is a note about its final scene,
and because scene-level association is otherwise a field nothing exercises. 15 of the 17
chapters get one; the other two are skipped because the anchor would have collided with an
existing flag.

Scene ids do not exist until the scenes are inserted, so the fixture carries a `sceneOrder`
and `demoImport` rewrites it to a real id in a second pass after the scene insert returns.

**Every chapter's prose used to end with a stray `---`.** The splitter reads every line up to
the next chapter header, and the manuscript separates chapters with a horizontal rule — so
the rule belonged to the chapter before it, and was rendering in the Reader. Stripped now.
It surfaced because the note derivation takes each chapter's closing sentence and kept
finding `---`.

**Build order:** `node scripts/build-demo-fixture.mjs` first, then
`node scripts/build-graph-demo.mjs` — the second reads the fixture the first writes.

---

## 19. PWA / MOBILE PARITY PASS (2026-08-23)

Two independent codebases over one Supabase project, neither of which was a superset of the
other. Closed in both directions so that development can continue on both rather than one
drifting further ahead.

### 19.1 What moved

| | Direction | Note |
|---|---|---|
| Character web | → PWA | Embedded, not reimplemented (§19.2) |
| Map view | removed | The web replaces it; −228 KB from `index.html` |
| Day/night/auto | → PWA | Mobile's palette and rule, unchanged |
| Trash | → mobile | Same table and row shape as the PWA |
| EPUB export | → mobile | Same builder; only the last step differs |
| Mythic threads | both | New in this pass, in the shared renderer |
| Linear Progression | both | New in this pass, in the shared renderer |

### 19.2 One renderer, two hosts

`scripts/build-graph-demo.mjs` emits two files from `CHARACTER_WEB_HTML`:

- **`character-web.html`** — no data. The PWA loads it in an iframe and posts the graph in.
- **`graph/character-web-demo.html`** — the same markup with the demo pack baked in.

The PWA fetches `character_graph()` through `sbClient` and hands the payload over; mobile
does the same through a WebView. Neither implements the graph.

**The trap, found by testing rather than reading:** the renderer's `post()` only spoke to
`window.ReactNativeWebView`. In an iframe it did nothing at all, silently — the frame waited
for data forever while the host waited for the `ready` it never sent. It now falls back to
`window.parent`. Anything else added to that message channel has to work in both hosts.

### 19.3 Things worth knowing before touching these

- **The PWA's service worker is network-first for the app shell** and has been since an
  earlier session, with a comment recording why. A deploy is picked up on the next load;
  offline still works from cache. If a change appears not to ship, suspect the browser's own
  HTTP cache or a dead dev server before suspecting the SW.
- **`index.html` inlines the same 209 KB JPEG that List view uses as a background.** The map
  had a second copy of it, which went with the map. Pulling the survivor out into a real
  cacheable asset would roughly halve the file again and is the single biggest remaining win
  on download size.
- **expo-file-system v57 replaced `writeAsStringAsync`/`cacheDirectory` with `File`/`Paths`.**
  The old names still exist as exports and throw at runtime, which is worse than missing.
- **Native modules cannot arrive over the air.** `jszip`, `expo-file-system` and
  `expo-sharing` were added in this pass; `expo-sharing` is a config plugin. Anything else
  needing a native module has to go in before the APK is built, or wait for the next one.

### 19.4 Still not at parity, deliberately

- **POV tracker and Mythic Threads (the PWA's originals)** are not ported. Progression marks
  POV chapters already, and the PWA's Mythic Threads is superseded by the thread-flagged
  notes described in §17 — the same idea with an actual data model behind it.
- **Continuity checker** is not ported. It is Icarus's job now (§15), including spelling,
  grammar and punctuation, and including editing rather than only reporting.
- **Google Drive import and the assistants** remain mobile-only.

---

---

## 20. DEPLOYMENT (2026-08-23)

The app left the sandbox. Two surfaces, two mechanisms, one Supabase project — sync between
devices was never the problem and needed no work; only distribution did.

`deploy/README.md` is the operational document: the commands, in order, with what each asks.
This section is the reasoning behind them and the traps hit getting there.

### 20.1 The rule that governs everything

**JavaScript ships over the air; native code does not.** Screens, stores, styles, the
character web, the theme, the EPUB builder — all reach an installed app without reinstalling
it. A new Expo module, a config plugin, a permission or an SDK bump is compiled into the
binary and needs a fresh build and a manual install.

`jszip`, `expo-file-system`, `expo-sharing` and `expo-updates` were added *before* the first
build, deliberately, so trash and EPUB export did not later cost a reinstall.

### 20.2 The PWA

Publishes to GitHub Pages from `deploy/github-pages-workflow.yml` on every push to `main`,
staging only what the app actually serves. The service worker is already network-first for
the app shell, so a deploy is picked up on the next load.

**The workflow file is not at `.github/workflows/`.** The credential this repo pushes with
lacks GitHub's `workflow` scope and the push is rejected outright. It lives in `deploy/` and
must be moved by hand — GitHub's web UI is not subject to the token's scope, so creating the
file there works.

**`index.html` went from 826 KB to 395 KB.** List view's background was a 209 KB base64 JPEG
inlined in the document — and the same image was inlined a *second* time for Map view, which
is why removing the map took 228 KB out on its own. It is now `assets/list-bg.jpg`, cached by
the service worker (shell v5), fetched once rather than re-downloaded with every deploy.

The manifest moved from `display: fullscreen` to `standalone` and gained a `scope`.
Fullscreen is wrong for a desktop app living in a window beside other things.

### 20.3 The Android app

`eas.json` has three profiles; `preview` is the one that matters — an `.apk` on the `preview`
channel with `distribution: internal`, which is what makes EAS hand back an install URL
instead of preparing a store submission. Free: no Play Store account, no fee. iOS would need
the Apple Developer Program at $99/yr and is not set up.

Project **`@nx-1/storymap`**, id `e9da412f-855e-415f-b51f-2eb8a9d439c6`, committed to
`app.json` along with `updates.url`. Both must stay committed — a checkout without them
builds an app that silently never checks for updates, and a second `eas init` elsewhere would
create a different project whose builds cannot receive the first one's updates.

`useOtaUpdate` checks on launch and again a few seconds later, then **offers** a restart
rather than taking one. An update downloaded mid-sentence must not restart the app: a reload
nobody asked for is indistinguishable from a crash.

`runtimeVersion` is `appVersion`, currently `1.0.0`. **An update only reaches builds whose
runtime version matches** — bumping `version` in `app.json` strands every installed APK until
it is reinstalled. If updates ever stop arriving for no visible reason, check this first.

### 20.4 Traps hit, in order

Four of the five were self-inflicted. Worth reading before the next setup:

1. **`expo-doctor` went from 3 failures to 21/21 before the first build.** The one that
   mattered: `react-native-worklets` was a missing peer dependency of
   `react-native-reanimated`. It works perfectly in Expo Go and may crash a standalone
   build — the exact class of fault you only find after installing. **Run `npx expo-doctor`
   before every build.**
2. **`eas.json` rejects the `"//"` comment convention.** EAS validates it against a strict
   schema and refuses unknown keys, so `eas init` failed outright. That file carries no
   comments now; the profiles are explained in `deploy/README.md`.
3. **A placeholder `extra.eas.projectId` is worse than an absent one.** `eas init` reads the
   field's *presence* as proof the project is linked, skips creating one, then fails on the
   value not being a UUID. Omit keys you cannot fill.
4. **PowerShell 5.1 has no `&&`.** Use `;`, or `; if ($?) { ... }` when the second command
   should only run on success.
5. **PowerShell's execution policy is `Restricted` on this machine**, which blocks npm's
   `eas.ps1` shim. `eas.cmd` sidesteps it with no settings change; Command Prompt has no
   execution policy at all.

### 20.5 Worth doing, not urgent

**The font bundle is mostly waste.** Every weight of Inter, Spectral, JetBrains Mono and
Cinzel ships — around 90 files, several MB — while `theme.ts` names eleven. Trimming
`useAppFonts` to what is actually used would cut both the OTA payload and the APK.

`assets/` is ~7 MB, mostly uncompressed sign-in art, and is most of the PWA's download.

---

## 21. THE EDITOR'S CARET AND THE KEYBOARD (2026-08-23)

Reported from the phone: past a certain point the line being typed sat behind the keyboard.
Two separate faults, and the first fix was wrong in an instructive way.

**A multiline `TextInput` scrolls internally and React Native exposes no way to ask it to
reveal the caret.** So the editor now owns the scrolling: a `ScrollView` wraps the input,
the input has `scrollEnabled={false}`, and its height is its content. Two scrollers over one
body of text is what made the caret reachable by the input's own reckoning and invisible on
screen.

**`KeyboardAvoidingView` had `behavior="height"` on Android**, which is wrong here and is
gone. Android is given no behavior at all now; iOS keeps `padding`.

**The first attempt measured the viewport with `onLayout`, and failed.** Expo SDK 54+ enables
edge-to-edge, so **the window does not resize when the keyboard opens** — the scroll view
keeps its full height and simply has keys drawn over its lower part. "Two lines above the
bottom" therefore meant two lines above the bottom of the *screen*, underneath the keyboard,
which is exactly what the screenshot showed.

The overlap is now taken from the keyboard itself: `keyboardDidShow` gives its top edge in
screen coordinates, and measuring where the scroll view ends gives the covered height
directly. **That arithmetic holds whether or not the window resizes**, so it does not depend
on knowing which behaviour a given Android version and Expo SDK produce — which was the
assumption that broke it.

**A latent bug found on the way.** The off-screen `Text` that measures how many lines precede
the caret — used by the flag popup, and now by the caret tracking — was absolutely positioned
with **no width**. It laid out as one unbroken line however long the prose, so its line count
was always ~1 and the flag popup has been mispositioned since it was written. Constrained to
the input's real width.

Measurement is taken from a wrapper `View`, not the `ScrollView`: React Native does not
declare `measureInWindow` on `ScrollView` even though the host component has it, and a
wrapper is honest where a cast would only silence the compiler.

---

## 22. THE BRAID (2026-08-25/26) — replaces the character web in both apps

**Status: shipped in both apps. The migration it half-depends on is written and NOT run.**

The character web's force layout drew a different picture every run, so nothing about it
could be learned. The braid replaces it with a fixed axis: chapters ranked 1..N over
`(book, act, order)`, and every other coordinate derived from that ordinal. Same data, same
RPC, same handshake, same two consumers.

### 22.1 What replaced what

| | before | now |
|---|---|---|
| PWA | `character-web.html` in an iframe | `braid.html?theme=…` in the same iframe |
| Mobile | `CHARACTER_WEB_HTML` in a WebView | `BRAID_HTML` in the same WebView |
| Layers | Relationships, Progression, Plants & Reveals, Structure | Structure, Subplots, Mythic threads, Characters |

**Relationships was dropped by decision**, not by omission. It is the one layer with no
position on a reading-order axis — who knows whom has no place in chapter order — and the
force layout that suited it is exactly what made the web unreadable. `characterWebHtml.ts`
is still in the tree and still builds; nothing imports it.

### 22.2 Files

- **`graph/spine-layout.mjs`** — the geometry. Pure: no DOM, no canvas, no fetch. The
  prototypes inline it and the tests import it, so what is tested is what renders.
- **`scripts/build-braid-3d.mjs`** — the renderer. `--embed` emits `braid.html` (no data,
  for the iframe) and `mobile/src/lib/braidHtml.ts` (the same markup as a string, for the
  WebView). Default emits `graph/braid-3d.html` with the demo pack baked in; `--local`
  emits a gitignored copy from `graph/.local-project.json`.
- **`scripts/test-spine-layout.mjs`** — forty-odd assertions over the layout core.
- **`scripts/build-spine-prototype.mjs`** — the flat 2D prototype, kept for comparison.
- **`scripts/dump-project-structure.mjs`**, **`scripts/spine-report.mjs`**,
  **`scripts/report-real-graph-stats.mjs`** — read-only, token-gated, for looking at real
  projects. They need a signed-in session token; the anon key sees `[]` for everything.
- **`graph/embed-harness.html`** — drives the host handshake without signing in.

### 22.3 The rules that hold the layout together

- **Nothing may depend on payload array order.** Every sort carries an id tiebreak; every
  map is walked through a sorted key list. Tested by shuffling five arrays and comparing
  ordinals, lanes, angles, open counts and the health set.
- **Lane allocation never sees a filter.** Greedy interval packing is unstable under
  removal — hiding one subplot would repack 24 of 27 — so allocation runs over the
  unfiltered set and filtering only sets visibility.
- **Allocation is incremental.** A chapter reorder moves one subplot instead of seventeen.
  The angular denominator only ever grows; it comes back down on an explicit repack and
  never silently. `repackAdvised()` is a pure predicate for a "tidy up" control.
- **Incremental allocation is path-dependent**, by construction. 160 of 315 edit-path pairs
  diverge. X stays path-independent; lanes do not. Reported, not asserted away.
- **A reveal may be read before its plant.** That is what a flashback is. An earlier version
  clamped the span and collapsed such a grouping to a point; spans now cover every member
  whichever way round they fall, and the grouping is marked `reversed`.

### 22.4 story_time — a sparse second ordering

`chapters.story_time` and `scenes.story_time`, nullable numeric. **Mark the chapter where the
story jumps and the one where it returns; everything between carries forward.** An unmarked
chapter inherits the last marked one before it in reading order, ties broken by reading
order, and chapters before any mark stay at the front rather than being flung to the end.

`computeSpine(payload, {order: 'story'})` switches the axis; the braid reads `?order=story`.
With no times set the two orderings are identical and the control says so rather than
offering a view that does not exist.

Written from the chapter drawer ("When this happens", optional). **Blank means null, not
zero** — zero would place the chapter at the dawn of the timeline. Guarded in three places.

### 22.5 pairs is canonical; linkedPlant is gone

The PWA's Plant Ledger resolved paid/open through `linkedPlant`; the graph resolved it
through `pairs`. On the demo pack they disagreed **4 open versus 28**, which is two different
answers to one question inside one app.

`pairs` won: many-to-many where `linkedPlant` is one-to-one, and already what
`character_graph()` returns. `findRevealForPlant` resolves through groupings and reports the
earliest claimant in saga order; the editor writes a shared grouping;
`normalizeLegacyPlantLinks()` converts on load and on import and is idempotent. The import
remap survives on purpose — an imported file carries old chapter ids, and the remap keeps
`linkedPlant` resolvable just long enough to be converted.

### 22.6 Health overlays — built, held

`open-plant` and `flag-density` are the only reliable signals emitted. `long-absence` and
`late-arc` sit behind a strand-density gate (0.5) because they depend on the event-anchored
presence predicate and would otherwise accuse the writer of dropping a character who simply
has no logged events.

**Withdrawn deliberately:** `unresolved-at-book-end` (subplots are expected to span books; it
would have fired on nearly every deliberate long-range setup) and `subplot-collision`
(several reveals landing in one chapter is a climax, not a defect).

**Overlays stay off until pairing is actually used.** On Saga-01 they emit 8 of 8 — with no
pairing authored, every plant is open and every reveal unlinked *by definition*, so the
overlay reports the absence of a workflow rather than anything about the writing.

### 22.7 What real data said, and why the granularity question is still open

Saga-01: **52 chapters across 5 books, 9 annotations, zero `pairs`, zero `linkedPlant`.**
0.17 flags per chapter against the demo pack's 4.6. Five of seven projects are empty.

So the fork — is a pair grouping a subplot, or a single setup? — **has no evidence either
way** and stays open. The demo pack's 27 groupings at peak concurrency 21 is a property of
`scripts/demo-plants-reveals.mjs`, not of anyone's writing. Do not add a grouping entity, a
parent-of-groupings, or a rollup dimension for ribbons until real material says so.

The angular ceiling is recorded as a constraint, recomputed against the real target (a
laptop, 1440x900, 760px usable): **35 concurrent**, separation 17px at the demo's peak of 21.
40 concurrent would need a 1113px window. It grows with the square of concurrency, so
wrapping buys a little and then stops.

### 22.8 Traps recorded

- **`applyPresentationConfig` writes the preset palette INLINE on `<html>`.** Inline beats a
  stylesheet, so `html[data-theme="day"]` could never win once a project loaded — the day
  toggle appeared to work only on the braid, which is a separate document and the only
  surface the inline palette could not reach. Nine surface tokens are now the theme's;
  accents stay the preset's. The same applies to typography: changing a font in the
  stylesheet alone looks fixed until a project loads.
- **`applyTheme` runs during script evaluation.** Reading a `let` declared further down threw
  in its temporal dead zone and aborted the remainder of the script — no `loadCharacterWeb`,
  no handshake, and the braid sat on "loading the braid…" forever. Anything `applyTheme`
  touches must be hoisted or live on `window`.
- **Texture tokens lived only inside `html[data-theme="day"]`**, so night had no grain at all.
- **`:empty` does not match an element containing whitespace.**
- **The braid's markup must contain no backtick** — it is emitted into a `String.raw`
  template for the WebView. The guard fired on a comment in `spine-layout.mjs`.
- **A wider tube does not make a casing.** In 2D a casing is a wider stroke under the line;
  in 3D it surrounds and hides it. The 3D equivalent is an inverted hull — back faces only.
  The real fix underneath was removing transparency: transparent surfaces do not write depth,
  which is what defeated the over-under reading in the first place.
- **Additive glow bleaches.** Stacking a desaturated hue drives every channel up and trends
  white. The glow is the thread's own hue pushed UP in saturation and DOWN in value.
- **Additive glow does nothing on white**, so the day palette drops it entirely rather than
  inverting the night one.
- **Detail must be gated on device pixels, not camera distance.** Distance ignores field of
  view, viewport and density. Grain appears above 40 device px (36 bands, ~18 visible, two
  pixels each); the large texture swaps in above 64, where the 128px map starts being
  magnified.
- **Selection must not drain the picture.** Dropping unselected threads to a tenth of their
  saturation turned the whole braid grey on one click. Contrast comes from lifting the
  selected thread, not from bleaching the rest.

### 22.9 The PWA shell (2026-08-26)

The app opens to the braid. Wide viewports (min-width 1000px) get a grid shell: a dark
grey-green rail running the full height and owning the top-left corner, the braid filling the
middle, and a dock of three cards beneath it (the book's progress, a tabbed list, open
threads). The rail carries the project title, split at the middot so the moment gets its own
line.

The rail is dark in **both** themes and therefore has its own ink tokens (`--rail`,
`--rail-ink`, `--rail-dim`, `--rail-edge`, `--rail-hover`). It took `--text` at first, which
in day mode is dark ink on a dark rail.

The sidebar's non-pane entries **press the button that already opens their view** rather than
reimplementing it. The braid is **moved** into the workspace, not cloned — same node, same
iframe; a second copy would run a second handshake and hold a second copy of the graph.

Below 1000px the phone layout is exactly what it was.

### 22.10 Open, and honest about it

- **The migration `supabase/migrations/20260825_spine_support.sql` is NOT run.** Until it is,
  saving a chapter with a story time fails on an unknown column, `unanchorable` is not
  returned, and scene requires/provides/deferredRequires do not reach the graph.
- **`project_settings.complexity` does not exist.** The table does (verified live: six
  columns, no `user_id`); the column does not. The preset resolver reads
  `payload.settings.complexity` until it does.
- **Deferrals and dismissals are two values, one store** (`health_marks`, written not run).
  A defer is time-bounded; a dismissal is permanent. They must not collapse into one flag.
- **A grouping has no row**, so it cannot carry a dismissal. Held with the granularity fork.
- **The braid's threads are lit tubes, not pigment.** Matching the reference's dry-stroke look
  needs a shader or normal maps, not another canvas texture. Not started.
- **The theme switch's knob may not move.** The code sets a real element's transform and
  background directly; three separate measurements in the browser pane contradicted each
  other and the pane could not composite a screenshot. Unverified — check it by eye.
- **The icon set was drawn from a reference image**, not from its source. It matches shape and
  weight; it is not the original file.
- **Mobile's landscape lock needs a new native build.** `expo-screen-orientation` plus
  `app.json` orientation `portrait` → `default`; neither ships over the air.
- **Multi-book rendering has been exercised only on Saga-01's structure** (52 chapters, five
  books, no flags) and on a synthetic three-book remap of the demo pack.

## 23. PAGES — STAGE ONE, RAW CAPTURE (2026-08-27, both apps)

### 23.1 Why this exists

The braid was built, corrected and stress-tested, and on the real project it draws almost
nothing: 52 chapters, five books, 9 annotations, **zero pairings**. The diagnosis is not that
the writer failed to keep up with the tool. It is that the tool assumed the wrong workflow.

Every plotting feature in StoryMap — flag a plant while drafting, link it to its reveal,
maintain the ledger, defer a requirement — asks for a small recurring action. This writer can
do a large occasional pass reliably and a small daily one not at all. That is a stable trait,
not a discipline problem, and it is the specification the software has to meet.

The deeper error: **plants and reveals are not knowable at drafting time.** You do not know a
thing is a plant when you write it. You know later, looking at the shape of what has
accumulated. Annotation is therefore a *recognition* step performed on a rare deliberate day,
not a flagging burden carried through every writing session. That single reframe is what makes
the braid fillable.

### 23.2 The pipeline this is stage one of

1. **Raw capture** — this build. Anything, any time, no decisions. The only requirement is
   that it lands inside StoryMap; material drafted elsewhere is material that gets lost.
2. **Sorting, Daedalus in recall mode** — orientation, not generation. What is in this pile,
   what belongs together, what contradicts what. Every statement cited to a page and passage;
   no suggestions at all, so every line can be trusted as something the writer actually wrote.
   Resumable, not a batch job.
3. **Daedalus in SME mode** — terminology, prior art, standard counterarguments. Names what the
   writer has made; never proposes what he should have made. Web search matters here because a
   model recalling a philosopher from memory is where confabulation appears. Structural
   annotations surface at this stage.
4. **Arachne weaves** — transcribes the recognised structure into chapters, scenes, plants,
   reveals, pairings, threads. Transcribes decisions; does not infer them.

Running separately and continuously: the existing extraction pipeline (PRESENT_AT,
INTERACTS_WITH, KNOWS_ABOUT, fact nodes) machine-read from finished prose. **Character presence
is derivable from text; plants and reveals are not.** Those are the two halves that fill the
braid and only one is automatic. Icarus is unchanged: correctness against supplied evidence,
read-only, quote required.

**Only stage one is built.** Nothing downstream should start before this is in daily use.

### 23.2b Stage two, designed 2026-08-27 — NOT BUILT

Recorded now because the decisions were made now, and because the reason stage two is not
being built today is that it would repeat the exact mistake that produced the empty braid:
tooling ahead of the material it operates on. **Do not start this until there is a pile of
pages to sort.**

#### What Daedalus reads

**The prose, not just the bibles — and this is already true.** `content_chunks.source_type` is
`check (source_type in ('chapter', 'document'))`, and `match_chunks()` takes an optional
`p_source_type` filter rather than being scoped to documents. Chapters are already in the
retrieval corpus. This is a constraint to preserve as the corpus grows, not a gap to fill.

It matters most for contradiction checking, where **the bible is usually the stale one**. The
prose is what actually happened; a character bible is a summary of intent that drifts behind it.
Any check that treats the bible as the authority and the prose as the candidate has it backwards.

**The gap this build created**: that `check` has exactly two values, so **pages cannot be indexed
at all**. Stage two *is* Daedalus reading a month of pages. Widening `source_type` to admit
`page` is the first prerequisite of stage two — before the recall mode, before anything.

#### Append-and-tidy for canon documents

The workflow: a new arc or development occurs for a character, you open their bible and **type
the point in raw** — no patch format, no placement, no organisation. Later, it gets cleaned and
merged in properly.

**This is Pages for canon.** Identical shape: deposit with no structure, recognise on a
deliberate day. It should therefore inherit §23.5's rules rather than inventing new ones —
nothing deleted, prior text kept, and no nagging.

**The split is not a choice; the existing contract already decides it** (§15, §16):

- **Icarus detects.** Does this addition contradict the prose or the existing bible? Read-only,
  claim-and-evidence, quote required for every finding. Icarus **cannot write prose at all** —
  that is constitutive, not a limitation to work around — so it cannot own the append.
- **Daedalus writes.** Cleaning the raw text, choosing where in the document it belongs, merging
  it into the existing structure. It is already the agent permitted to propose document edits.
- **The writer accepts.** This is §15's already-scoped, still-unbuilt **proposal/review queue**:
  canon edits arrive as a diff to accept, never as a silent write. What is described here is the
  missing half of that, not a new mechanism. A silent tidy of a canon document is the single
  write in this system that could quietly corrupt the thing everything else is checked against.

#### Forks

When a contradiction cannot be resolved, it is **not** resolved. The addition and the existing
canon coexist as A and B, both live, neither chosen, to be decided later on what serves the plot.
**An unresolved fork is a legitimate resting state, not an outstanding task.**

Two traps to design against before anyone builds this:

1. **Extraction will eat both branches as fact.** PRESENT_AT / KNOWS_ABOUT / fact nodes read
   canon documents as truth. A fork holding "he never knew" and "he knew all along" would emit
   both into the graph — and Icarus would then cite the poisoned graph as evidence in its *next*
   contradiction check. **An unresolved fork is explicitly not canon yet** and extraction must
   refuse to ingest it, rather than merely down-weighting it.
2. **Anchoring.** Inline markers in document text would inherit the annotation system's
   relocation-by-substring fragility (§3.5) — edit the surrounding text enough and the marker
   silently detaches. A fork is more load-bearing than an annotation and must not be stored more
   fragilely than one.

**And forks must never be counted.** The moment a badge appears saying "3 unresolved forks", the
rule that makes this whole design work has been broken. See §23.5 and the closing rule of §23.2.

#### Recording what became of a page

Once a page has been read, sorted, or **used in the prose**, that has to be recorded, and such
pages want to be separable from the ones nothing has happened to yet.

What already exists after this build:

- `status` — `raw | reviewed`. Covers *read through*.
- `became_type` / `became_id` / `became_at` — covers *promoted into a chapter*, one landing.

**What is missing is the common case.** Material usually reaches the prose without promotion:
you read a page, and you rewrite its idea by hand into a chapter that already exists. Nothing
records that today. `became_*` is singular and promotion-shaped, and it cannot express "this
page's material ended up in chapters 12 and 31, neither created from it".

The shape that fits is an additive `used_in` list — `[{type, id, at, note}]`, jsonb, alongside
`became_*` rather than replacing it (which is live and populated). Consistent with `versions` and
`annotations`. Filling it is stage four's job — Arachne transcribing decisions made in a session
— though a manual "this one's in the prose already" is cheap and could come sooner.

**Archived means filtered, never deleted.** §23.5 holds without exception: a used or sorted page
stays exactly where it is and stays searchable. Hiding it from the default stack is a view. And
the stack must not grow a count of what is left — the pile is not a queue, however tempting it
becomes once pages start having states.

### 23.3 The two schema questions — ANSWERED 2026-08-27

The brief asked for both to be verified against the live schema before anything was built.
Neither is readable with the access this repo has:

- Supabase refuses the PostgREST OpenAPI endpoint to anything but `service_role`.
- `supabase/.env` is empty and the CLI is not linked, so there is no DDL-capable credential.
- The base tables were created by hand in the dashboard and have **no DDL in this repo** —
  §4's column list is inferred from client code, and says so.

What the anon key *can* establish, and did:

- The live `sticky_notes` column set is exactly `id, user_id, project_id, content, created_at,
  rotation`. `updated_at`, `type`, `status`, `title`, `became_*` all return `42703`.
- `content` is a string type, not `jsonb`: `?select=content::date` plans cleanly, which `jsonb`
  would reject at plan time with `42846`. **`text` vs `varchar(n)` is invisible over REST** —
  there is no read-only probe for a length cap.
- Anon selects return `[]` rather than an error, consistent with RLS being on and correct, and
  equally consistent with a table anon was never granted.

So both were settled by design rather than by inspection, and then **read directly from
`information_schema` once the dashboard was open**. Both designs held, and one of them mattered
more than it looked:

| question | answer | consequence |
| --- | --- | --- |
| `content` type | **`text`**, `character_maximum_length` null | The unconditional `alter column content type text` was a no-op, as intended. No length cap; a drafted scene of any size is safe. |
| `content` nullability | **NOT NULL** — not a question anyone thought to ask | The migration's `set default ''` is load-bearing, not cosmetic. An insert omitting content would fail without it. |
| `user_id` nullability | **still NOT NULL** | The open question from the multi-project migration was **live, not theoretical**. An insert omitting `user_id` fails. Both apps set it from the session, which is exactly why the migration left the constraint alone instead of relaxing it. |

**RLS on `sticky_notes`: enabled, one policy — `auth.uid() = user_id`, ALL, on both `qual`
and `with_check`.** Read in full, not inferred. Cross-user isolation is correct: nobody reads
another account's pages. This closes a question §4 has carried as open since before this build,
for this table.

But note what that policy is **not**. It is **user-scoped, not project-scoped**. Project
separation across this whole app is a client-side `.eq('project_id', ...)` convention and not a
database boundary — §4 says the manual filters "strongly imply" RLS enforces the same boundary
server-side, and this is the proof that it does not. Harmless with one writer and one account;
it is the assumption to remember before anything is ever shared.

**Which raised a question about `search_everything()`.** The function takes a project id from
the caller and is `security invoker`, so the only thing stopping a caller passing a project id
that is not theirs is whatever RLS the four underlying tables happen to have — and at the time
the function shipped, `chapters`, `scenes` and `documents` had never been read at all.

**They were then read, and the worry did not materialise**: all four tables have RLS enabled
with one policy each (§4). The function was never exposed. Recording this because the reasoning
was sound and the conclusion was wrong, and the next person is better served by knowing which
was which than by only seeing the fix.

`20260827_search_ownership.sql` (**applied 2026-08-27**) is therefore **belt-and-braces, not a
fix**. Unlike the pages migration, this one is recorded on the report of the run rather than
verified by probe: it replaces a function body, and a function body is not readable with the
anon key. `select pg_get_functiondef('public.search_everything(uuid,text)'::regprocedure) like
'%owns%';` would settle it from the dashboard if it ever matters.
It stops the function depending on that answer at all.
One `owns` CTE — `projects.id = p_project_id and projects.user_id = auth.uid()` — evaluated
once, with every branch gated on it. On today's database the test is redundant. It is
kept because a search function should not be the most privileged path into the data, and because
"redundant given four policies nobody has read the definitions of" is a weaker guarantee than
one `where exists` that is true by construction. The function body is otherwise byte-for-byte the applied version;
the diff is the CTE plus one `and exists (select 1 from owns)` per branch, and was checked as
such rather than asserted.

A CTE rather than a join on purpose: a join has to be repeated correctly in four places and
stops protecting anything the first time a fifth branch is added without it.

**Correction to the brief:** it stated `sticky_notes` is "already project-scoped with correct
RLS". That turned out to be right on both halves, but it was **not established at the time it
was asserted** — no policy definition exists anywhere in this repo, and it was verified only
after the fact. The migration reports the state with `raise notice` rather than enabling
anything blind, which is still the correct posture for a file that ships to an unknown database.

### 23.4 Schema — `supabase/migrations/20260826_pages.sql` (APPLIED 2026-08-27)

Extends `sticky_notes` rather than adding a table: it is already project-scoped and already
holds the thing being generalised. **A page IS a sticky note that got long.** The table is not
renamed, because renaming it would break two shipped apps for no gain.

| column | why |
| --- | --- |
| `type` | `prose\|note\|reference\|canon\|filler`, nullable. **Deliberately unconstrained** — a CHECK would turn a hint into a gate the first time a sixth word is wanted. |
| `status` | `raw\|reviewed`. A marker, never a location. |
| `updated_at` | the stack sorts on it. |
| `versions` | jsonb, same shape as `chapters.versions`. |
| `became_type` / `became_id` / `became_at` | where a page's words went. |
| `search` | generated `tsvector`, added to `sticky_notes`, `chapters`, `scenes` and `documents`, each with a GIN index. Generated rather than trigger-maintained: `to_tsvector` with a literal regconfig is immutable, so there is no application code to forget to call. |

Plus `search_everything(p_project_id, p_query)` — one ranked query across all four, `security
invoker` so RLS applies as the caller, `websearch_to_tsquery` so a nonsense query returns `[]`
rather than raising.

**It failed on the first run** and the fix is worth keeping: `42703: column "rank" does not
exist` on `create function`. `ORDER BY` after a `UNION ALL` resolves against the union's output
column names, and those come from the **first branch's select list** — which was unaliased, so
its columns were named `text`, `id`, `uuid`, `nullif`, `ts_headline`, `ts_rank`, `coalesce`. The
`RETURNS TABLE` names never reach that far. Branch one is now aliased and the `ORDER BY` uses
ordinal positions, which additionally cannot be shadowed by the OUT parameter names.

**The degraded path is still live code and still matters** — the demo project, any project on an
older database, and the PWA's `select('*')` read path all exercise it. The mobile store retries
the base column list on `42703` and sets `legacySchema`; the PWA detects the shape from a loaded
row and omits the new columns from its upsert; search falls back to the substring scan. Type,
status and history are unavailable in that state and both apps say so, once, inside the page.

### 23.5 Loss-proofing, which outranks everything else here

- **Nothing is ever deleted.** The delete controls are *gone* — the PWA's board had one on every
  card and one in the editor; neither survives. Mobile's stack has no swipe-to-delete.
- **Promotion copies.** The chapter gets the text, the page stays exactly as written and only
  learns where its words went. Deliberately not a move: the chapter will be rewritten, and the
  page is the record of what it first said.
- **Edits keep prior text.** `pushVersion`/`pushPageVersion`, one snapshot per 3 minutes of
  writing rather than one per autosave tick, capped at 20 — and **the oldest is never dropped**:
  the first thing a page ever said is the version most worth having, so the discard comes from
  the middle.
- **A row is created on the first keystroke, not when the blank page opens.** This is the only
  way "never delete a page" and "no empty clutter" hold at the same time — an abandoned blank
  leaves nothing behind, so nothing ever has to be cleaned up.

### 23.6 The surfaces

**The writing page** (`mobile/src/screens/PageScreen.tsx`, the PWA's `#note-editor`). One field.
No title, no type picker, no project or chapter selector, no save button. Spectral at 18/30 with
printed-page margins. Two low-contrast glyphs of chrome: back, and one dot. Everything else —
type, status, promote, history — lives behind that dot and is never visible while writing.

Note the tension deliberately: **the feel is casual and disposable, the storage is not.** The
interface must never imply a page might be thrown away.

**The stack** (`PagesScreen.tsx`, the PWA's `#pages-stack`). Reverse chronological, first line as
the de facto title, a date, nothing else. No status badges, no type chips, no counts. The PWA's
old "You have N ideas sitting here, unplaced. Worth a look before they go stale." line is
deleted — it was the one nag, and anything that reads as a queue with work outstanding is a
thing the writer stops opening.

**The Margin is gone as a view**, by decision this session. Board and stack over one table would
have meant two places to look for the same thing, and a 4,000-word scene rendered as a 210px
tilted card. No data was touched: every existing note is already a page.

**Search** (`SearchScreen.tsx`, the PWA's `runSearch`). Full-text over pages, chapters, scenes
and documents. The PWA's snippet path re-escapes `ts_headline` output and restores only the
`<mark>` pair — server output into `innerHTML` otherwise. Documents are now searchable on mobile
for the first time (they previously had nowhere to open).

### 23.7 Verified end to end, signed in, against real data (2026-08-27)

The PWA, running locally against the live Supabase project, with a real account. This is the
path every earlier check could not reach: everything before this ran as anon, which RLS
correctly shows nothing to, so no write had ever actually executed.

Walked and confirmed:

1. **Existing sticky notes appear as pages.** The old Margin rows read straight out as a stack,
   titled by first line — no migration of data, no conversion step, because they were always
   the same rows.
2. **A blank page opens with the cursor in it**, no title field and no save button.
3. **The page appears in the stack**, top of the list, titled by its first line.
4. **Reopening it returns the text exactly** — the round trip that had never run.
5. **The actions sheet is live**: type chips, promote, status. It did **not** show the
   `20260826_pages.sql` warning, which independently confirms the client's schema detection
   agrees with the migrated database.
6. **Search found the page by a word that existed only inside it**, labelled `Page`, highlighted.
   That is `search_everything()` executing for the first time against real content.

**Still not exercised live: promotion.** Deliberately — it creates a real chapter and a real
scene in whichever book is picked, and the first run of that belongs in a scratch project, not
in Saga-01. Its data behaviour *was* asserted in a browser against stubbed persistence (§23.7b),
so what is unverified is the Supabase write, not the copy-not-move logic.

### 23.7b Verified against the live database (2026-08-27, post-migration)

Probed directly over REST after the migration ran, so these are facts about the running project
rather than about the file:

- All seven new `sticky_notes` columns are present, plus the generated `search` tsvector on
  `sticky_notes`, `chapters`, `scenes` and `documents`.
- `search_everything()` exists and is callable.
- **A malformed query returns `[]` rather than raising** — tested with `"unclosed -and- or`.
  This was a claim in the migration's own comments and is now a tested fact; it is the property
  the search box depends on, because a search box that throws on a half-typed quote is worse
  than one that finds nothing.
- Every column the migration reads was probed *before* the re-run (`chapters.title/content/
  notes/updated_at`, `scenes.title/summary/notes/updated_at/chapter_id`, `documents.title/
  content/updated_at`), so the `rank` failure was the only one.

### 23.7c Verified before any of that, in code

- PWA inline JS parses (`node --check` over all five script blocks, exit 0); mobile `tsc
  --noEmit` clean.
- The stack renders titles/dates/blank-page correctly and in the right order, in a real browser.
- **The junction, end to end**: promoting a page created one chapter carrying a copy of the text,
  the page stayed in the stack with its text unchanged, and its `became_*` pointed at the new
  chapter. Asserted, not eyeballed.
- **The version rules**: rapid edits produce one snapshot not many; the oldest survives the cap;
  a blank page never snapshots.
- The headline sanitizer keeps `<mark>` and escapes everything else, including an `onerror`
  payload.

### 23.8 Not verified, and open

- **Nothing has been exercised against the live database**, because the migration is unrun and
  this session has no credential that could run it. Every store call is code-reviewed, not
  round-tripped.
- **Mobile has not run on a device this session** — typecheck only.
- **`created_at` on the PWA's upsert.** `saveData()` has always written `created_at` back on
  every save; it is preserved from the in-memory value, so it is stable, but it remains a
  column the client rewrites for no reason.
- **The PWA still saves pages through the whole-table upsert** (§7's non-granular writes). With
  long pages that is now a materially bigger write than it was with one-line notes. Mobile
  writes per page and does not have this problem.
- **Attaching a page to anything but a new chapter.** `became_type` is deliberately wider than
  `chapter`; only chapter is wired.


## 24. ARACHNE (2026-08-27) — a tool and a module, not an agent

### 24.1 Tool or agent — decided: TOOL

It was configured as a third agent first, and that was wrong. Recorded with the reversal
intact rather than tidied away, because the reasoning that produced the wrong answer was sound
and will recur.

**The argument for a third agent** was that the thing which DECIDES must not be the thing which
INSCRIBES: Daedalus is trustworthy because it proposes and never writes, and giving a
craft-judgment agent annotation-write tools lets it author structure as a side effect of
discussing it.

**Why that does not require a second speaker.** Split the work into what needs a model and what
does not, and nothing is left for one:

| the work | needs a model? |
| --- | --- |
| deciding what is a plant, what pays it, what is a motif | yes — **Daedalus** |
| turning a loose quote into an exact, unique, stable anchor | no — `graph/arachne.mjs` |
| minting grouping ids, joining many-to-many, staying idempotent | no — same module |
| writing the rows | no — a database call |
| accept or reject before anything lands | no — a queue |

The decide/inscribe boundary is held by **the proposal queue and the deterministic applier**,
which are the parts that are not models. Daedalus already works exactly this way for canon
documents via `propose_document_edit`; annotations are the same mechanism aimed at a different
target.

The cost argument dissolved too. Arachne was given Haiku so bulk transcription would not run on
Opus — but if transcription is code, no model runs at all.

**So: `arachne` is one more tool on Daedalus.** The model's whole contribution is choosing WHICH
line and naming the grouping; it never decides HOW a line is anchored. The name survives where
it is real — the module and the Loom. Arachne is the loom, not a speaker.

### 24.2 What Arachne does NOT own: the braid

The request was that Arachne own everything braid-related — labels, zoom, finding chapters.
It does not, and should not:

- Layout, label thresholds and zoom tiers are `graph/spine-layout.mjs`; drawing and the Find
  panel are the renderer. All deterministic, all working today **with every assistant switched
  off**, which is their current state.
- Routing a hover or a zoom through a model would make the braid slow, non-deterministic,
  billable and dependent on an API key — and would break the project's own first design
  principle, that AI stays behind `aiEnabled` and is never required for core functionality.

**Arachne owns what the braid draws. It does not own the drawing.** The braid has been
finished for weeks; what is missing is not a view, it is the data.

### 24.2b Lifecycle: available when the braid is open

Arachne has no on/off of its own and is not selectable. It is reachable when the braid is open
and `aiEnabled` is on, and otherwise simply is not offered — which as a tool is the natural
shape anyway: a tool is available in the context where it applies.

**Available, not active.** This is the same rule that governs Pages (§23.5) and it
matters more here, because the braid is a surface the writer is supposed to want to open.
Arachne must not begin proposing transcriptions because the braid was opened, must not
accumulate pending proposals, and must not be counted anywhere. The moment the braid carries
work outstanding, it becomes a thing to avoid opening — which is precisely the failure this
whole line of work exists to undo.

### 24.2c The braid needs no AI to draw itself

Worth stating flatly, because the two are easy to conflate. Once plants, reveals and pairings
exist as rows, the braid is deterministic geometry: chapters rank 1..N over `(book, act,
order)` and every other coordinate derives from that ordinal (§22). Same input, same picture,
every run. `graph/braid-3d.html` proves it — it renders the demo pack's 79 flags and 27
subplots with no key, no network and no assistant.

**There is a complete no-AI path from prose to a fully drawn braid**: flag in the editor, pair
in the Loom, and it draws. Arachne buys speed on a day when forty things were recognised at
once — not capability. Nothing in the braid is gated on a model, and nothing should become so.

### 24.3 The two halves

**The core** — `graph/arachne.mjs`, pure functions, no I/O, 34 assertions in
`scripts/test-arachne.mjs`.

*Anchoring* is the consequential part. An annotation stores no position: it stores the exact
flagged substring and relocates by searching for it on every render (§3.5). A bad anchor does
not throw and does not show up as a wrong number anywhere — **the annotation is not wrong, it
is invisible**, and the braid draws one thread fewer with nothing to say it should have drawn
more. `chooseAnchor` therefore: takes an exact unique quote as-is; recovers a quote whose
whitespace was flattened by a round trip through a chat window; **widens by whole words, never
characters, and never across a paragraph break** when a quote is ambiguous; and **fails loudly**
on a paraphrase or an unanchorable refrain rather than binding to whichever line came first.

*Idempotency* is by construction, not by bookkeeping: a grouping id is **derived** from the
anchor annotation's own id, so re-running an interrupted transcription computes the same id
and joins nothing twice. The flag and the grouping are recognised as already-done
independently, or resuming would re-join.

*Plans, not writes.* `planTranscription` returns `{creates, joins, skipped, failures}` — every
row inspectable before anything is written, and a second run of the same plan is empty.

**The surface** — "The Loom" in the PWA (drawer → The Loom). Needs no model, no key, no
network.

It exists because **the editor structurally cannot do this.** The editor holds one chapter, so
when a reveal is flagged it can only offer the plants it can see; a plant sown twenty chapters
earlier has never been joinable from its own side at all. That is the shape of the surface,
not a missing button, which is why the Loom is a separate one.

Groupings with members and paid/open state; loose flags in no grouping; tick two ends in any
two chapters and join; add to an existing grouping; take a flag back out. Many-to-many in both
directions, because a line can do two jobs at once.

### 24.4 Verified this session

- 34 assertions in `scripts/test-arachne.mjs`, all passing.
- Driven in a real browser: a plant in chapter 4 joined to a reveal in chapter 31 — **the join
  the editor cannot make** — one shared grouping, prose untouched, selection cleared, the pair
  leaving the loose list and appearing as `1P · 1R`.
- Many-to-many: a second plant added to the same grouping (`2P · 1R`), then removed, with the
  other member intact and the flag back among the loose ones.
- **The Loom, the Ledger and the braid all name the same open grouping.** That one-model-of-
  paid/open property is what `pairs` was introduced to guarantee (§22.5) and it now holds for
  a fourth consumer.

### 24.5 Found while doing this: the Edge Function has never parsed

`supabase/functions/assistant/index.ts` contained a single-quoted string literal spanning raw
newlines — a hard syntax error, committed in `525da5b`, present ever since. **No typecheck has
ever run on the assistant codebase**, because it could not get past the parser, and nothing
caught it because the function has never been deployed.

Fixed (backticks). With it fixed, `deno check` reports **42 type errors, all pre-existing** —
verified by checking a copy of the pre-change tree with only that one line patched, which gives
the same 42. They are almost entirely `Property 'x' does not exist on type 'never'` from an
untyped Supabase client, plus one Anthropic SDK `thinking` param shape. Arachne's additions
introduce **zero** new errors. None of this is fixed here; it is now merely *known*, which it
was not before.

### 24.6 Open

- **The tool has no handler.** `arachne` exists as a name in the tool union, a contract, and a
  described discipline. The implementation is not written, deliberately: there is nothing to
  transcribe until stages two and three exist, and the deterministic half it would call is
  already built and tested.
- **Two implementations of the same rules.** `graph/arachne.mjs` is the specified, tested one;
  `index.html` carries older equivalents in `pairsOf()`/`joinIntoGrouping()`. They agree today
  (§24.4 checks exactly that), and converging them is deliberately deferred: the inline ones
  are load-bearing on `normalizeLegacyPlantLinks()`, which runs at load time, and a module's
  deferred execution racing that conversion would corrupt groupings on load. It deserves its
  own change, not a rider on a UI one.
- **The Loom is PWA-only.** Mobile has its own pairing sheet with the same one-chapter limit.
- **Daedalus is dormant**, like Icarus, so the tool cannot run regardless.


## 25. INGESTING A FINISHED BOOK (2026-08-27) — SCOPED, NOT BUILT

Deferred by decision the moment it was scoped. Recorded because the sizing is done and the
one surprising finding in it should not have to be rediscovered.

### 25.1 The braid already does not care

`graph/spine-layout.mjs` **never reads `BOOKS`**. It builds its own band labels
(`rollup((c) => String(c.book), (c) => 'Book ' + (c.book + 1))`), hardcodes no count, and
`chooseFarTier` already adapts — banding by books when they divide the axis usefully and
falling back to acts when they do not. **A seven-book project would draw correctly today.**

The hardcoding is entirely in the two apps' UI: `BOOKS` is a five-element constant used 28
times in `index.html` and 23 times in `mobile/src`, almost always as `BOOKS[ch.book]` for a
label or as the array to iterate when building a picker.

### 25.2 The three steps

1. **Labels become data.** `project_settings` already stores `act_labels`, so the precedent
   exists: add `book_labels`, replace the constant with a `bookLabel(i)` resolver falling back
   to "Book N", and derive the count from the data (`max(book) + 1`) rather than an array
   length. Mechanical, ~50 call sites, one migration column, no behaviour change for Saga-01.

2. **Levels become declared, not assumed.** The hierarchy is fixed at Book → Act → Chapter →
   Scene, but `act` is just an integer and nothing in the data model requires it to *mean* an
   act. Let a project name its own levels and say how many it uses: Harry Potter is `['Book']`,
   Dune is `['Book', 'Part']`, Saga-01 is `['Book', 'Act']`. With level two unused, everything
   takes `act = 1`, the act pickers hide, and the braid bands by book without being told.

3. **An importer, which is the actual bulk of the work.** Nothing today parses a manuscript
   into chapter rows — Drive import brings documents, JSON import expects the app's own export
   shape. Split a text on its own division markers, map them onto (level1, level2, order),
   write the rows.

### 25.3 The limit to decide up front

Steps 1 and 2 buy **two levels above the chapter**. *The Lord of the Rings* has three (volume,
internal book, chapter) and so does Malazan. Those need either genuine variable depth — a path
array on the chapter, touching list view, the drawer, exports and the braid's rollups — or a
deliberate collapse of two levels into one at import time.

**Collapse.** Variable depth is invasive, and the braid's whole strength is that every
coordinate falls out of one ordinal; a tree would cost that.

### 25.4 What ingestion does and does not give you

- **Spine: immediate and deterministic.** Chapters with `book`/`act`/`order` draw at once, no
  model, nothing to run.
- **Character strands: derivable, not automatic.** The extraction pipeline reads presence out
  of prose, but it is a billable model call that runs when it is run — not on open. And it is
  dormant (§15).
- **Plants, reveals and pairings: never automatic.** That is the thesis (§23.1): presence is in
  the text, structure is not.


## 26. PRUNING THE PWA'S DRAWER (2026-08-27)

The braid subsumed several surfaces when it landed and none of them were taken out at the
time, so the drawer carried three ways to look at one dataset.

**Removed** — buttons, panels, CSS and now-unreachable functions:

| gone | what covers it |
| --- | --- |
| Plant Ledger (`ledger-btn`, `#ledger-view`, `renderLedger`, `allPlantAnnotationsInOrder`) | the braid's **Subplots** layer, plus **Still open** for unpaid plants — same `pairs` data, same rule |
| Mythic Threads browser (`mythic-index-btn`, `#mythic-index-modal`, `#mythic-browser`, `renderMythicIndex`, `openMythicBrowser`, `threadIndex`) | the braid's **Mythic threads** layer |

~10.7 KB out of `index.html`.

**Renamed**: `web-btn` and its panel said "Character Web". The web was replaced by the braid
on 2026-08-26 and that button has opened `braid.html` ever since — only the label was left
behind.

**Deliberately kept, and why the tempting deletions were not made:**

- **Mythic thread *creation* is untouched.** `allThreadTouches()` and
  `refreshThreadSuggestions()` stay, along with the `thread-suggestions` datalist: tagging a
  note with a thread name in the editor is how a thread comes to exist at all. Only the
  browser went. Removing viewing must never remove authoring.
- **Continuity Check stays.** CLAUDE.md says it is "Icarus's job now" — but Icarus is dormant
  and undeployed, so deleting the checker would remove a capability that works today in favour
  of one that does not run. It goes when Icarus runs, not before.
- **POV stays.** The braid shows a scene's POV in its detail panel (`told by`), but has no POV
  *index* — no list of POV characters with scene counts, no browser of every scene in one POV
  across the saga. That is not covered, so it is not redundant.

**Verified**: the app boots; a scan for `getElementById` calls naming elements that no longer
exist returns none; `node --check` clean on all five script blocks; the drawer and sidebar read
correctly. That scan mattered — the first pass left
`getElementById('mythic-browser-close').addEventListener(...)` behind, which runs at top level
and would have thrown on load, taking the whole app with it.


## 27. THE BRAID ON MOBILE (2026-08-30)

The ask was to add the braid to the mobile app and retire the character web there. **The braid
was already the thing mobile rendered** — `CharacterWebScreen.tsx` has loaded `BRAID_HTML` into
its WebView since the August swap. What was left was leftovers, and one of them was heavy.

- **`mobile/src/lib/characterWebHtml.ts` deleted — 82 KB of dead renderer**, imported by
  nothing, shipped in every OTA payload since the braid replaced it.
- **`CharacterWebScreen.tsx` → `BraidScreen.tsx`**, route `CharacterWeb` → `Braid`, prop
  `onOpenCharacterWeb` → `onOpenBraid`, drawer key `character-web` → `braid`, and the two
  user-facing labels ("Character Web") → "The Braid". Six call sites across the editor, the
  reader, the chapter list, the drawer, the navigator and the types.
- Renamed with `git mv`, so history reads as a rename rather than a delete plus an add.

**Verified:**

- `node scripts/build-braid-3d.mjs --embed` regenerates `braid.html` and
  `mobile/src/lib/braidHtml.ts` from the shared renderer and produces **no diff** — mobile's
  embedded braid was already current, not stale.
- `tsc --noEmit` clean; no `CharacterWeb` references remain outside the renderer's own prose.
- **The host handshake, end to end**, through `graph/embed-harness.html`, which drives
  `braid.html` exactly the way the WebView does: `ready` received → `{type:'data', payload}`
  posted → `{type:'focus', id}` → canvas rendering *17 chapters · 79 flagged · 27 subplots ·
  3 still open*. That is the same document, byte for byte, that `braidHtml.ts` ships, so the
  path is proven even though the RN app was not run this session.

**Not verified**: nothing has run on a device. This is a rename plus a deletion, both
typechecked, but the app itself has not been launched since.


## 28. THE BRAID'S DETAIL PANEL (2026-08-30) — reviewed against a ten-item wishlist

A list of ten improvements was put to the braid. Assessed against the code rather than
against a screenshot; **three were already built, two are not derivable from the data, and the
rest were mostly present.** Two were implemented. Recorded in full because the same list will
be produced again by anyone looking at a picture of this surface.

### 28.1 Already built

- **"Isolate the selected subplot; dim everything else to 10–20%."** `applyEmphasis()` already
  raises the selected thread in saturation *and* glow while dropping every other one — and the
  specific number suggested was already tried and rejected, with the reason in the code: an
  earlier version bleached unselected threads and "one click turned the entire picture grey and
  the braid stopped looking like dyed thread at all." The contrast comes from lifting the
  selection, not from draining the rest. The known cost is documented too — dimmed threads go
  transparent, and transparent surfaces do not write depth, so the over-under interlacing
  degrades while a selection is active.
- **"Make markers interactive."** They are picked and selected on click already.
- **"Make zoom semantically intelligent."** `spine-layout.mjs` has three LOD tiers, `tierFor`,
  `tierForSlotPx` and `chooseFarTier`, which already rolls up to books or acts depending on
  which divides the axis usefully.
- **"Only open" filtering** exists as both a layer and an index tab.

### 28.2 Not derivable, and deliberately not invented

- **"Plant → Open → Active → Escalation → Reveal → Resolution."** The data knows where a thing
  was planted and where it was paid. It knows nothing about *escalation*. Naming that stage
  would be the software asserting a reading of the story.
- **"Distinguish active from dormant stretches."** Same objection. A subplot planted in ch2 and
  paid in ch14 records nothing about ch3–13; drawing a dormancy would be an assertion, not a
  fact. The chapter card therefore says **"subplots crossing"**, which is true, rather than
  "active", which would not be.

This is the line the wishlist itself drew and is worth keeping: surface structural facts that
are hard to perceive from an outline; do not declare ⚠️ BAD PACING.

### 28.3 Built

**The detail panel became navigable.** Previously it printed `planted 1 / revealed 1` — counts
that were true and useless, because finding the far end was still left to the eye.

- **A subplot now lists its whole run**: every plant and reveal in reading order, each a jump to
  that flag. No invented stages; just the events, in the order they occur.
- **A flag's counterpart is a jump**, not a sentence to read and then hunt for. An unpaid plant
  still reports "nothing claims this yet" and offers nothing to click, because that is a real
  state and not an empty list.
- **A chapter card now shows what is structurally happening there**: every flag in it, every
  subplot crossing it (labelled *opens here* / *resolves here* / *running through* / *open,
  running through*), and which characters are present. All of it was already in the payload and
  none of it was reachable without leaving the chapter and hunting.

The panel is **bounded** — `max-height: 46vh` with its own scroll. Caught by looking at it
rather than by a test: the lifecycle rows make a subplot's card as tall as its flag count, and on
a short viewport a well-worked subplot ran off the bottom edge and into the legend. Worst case in
the demo pack is six events; it now fits and scrolls itself.

One delegated listener on `#dbody` rather than one per row, since the panel is rebuilt on every
selection. Styling stays marginalia — a `.jump` is a text row, not a button; the restraint of
the surface was explicitly to be preserved.

### 28.4 Verified

Driven in a browser against the demo pack: selecting a resolved subplot lists its plant (ch 1)
and its payoff (ch 10) as jumps; clicking the payoff lands on that exact reveal; a chapter card
renders six flags plus its crossing subplots with the right *opens here* labelling; a paid plant
offers one jump that lands on its reveal, and an unpaid one offers none. `braid.html`,
`graph/braid-3d.html` and `mobile/src/lib/braidHtml.ts` all regenerated from the one renderer;
`scripts/test-spine-layout.mjs` still passes; the embed harness still completes the full
handshake, so the WebView path mobile uses is unaffected.

### 28.5 Not done, and worth doing

Ranked as the wishlist ranked them, minus what is above: a **structural-density indicator under
the chapter axis** (data exists, medium build), **narrative queries in Find** (`reveals in act 2`,
`subplots involving X` — the index already has tabs to hang this off), and a **hover tooltip** so
a marker can be read without selecting it.


## 29. THE BRAID, BOTH WAYS (2026-08-30)

### 29.1 What was actually there

Asked whether navigation between the braid and the prose was two-way. Checked rather than
assumed, and the answer was **half of one direction**:

| | mobile | PWA |
| --- | --- | --- |
| Reader/Editor → braid, at any granularity | **yes** | **no** |
| braid → Reader/Editor | **no** | **no** |

`focusNode(id)` in the renderer has always resolved a chapter, a scene, a flag, a subplot or a
mythic thread — five granularities, each by its own database id, switching the relevant layer on
before it focuses. Mobile used it from the Reader and the Editor. **The PWA never sent a single
`focus` message**: the capability sat there unused.

And the braid posted exactly one message in its entire lifetime — `{type:'ready'}`. It was the
one surface in either app that was a dead end: you could get *to* a flag's place in the braid
and never back to the flag.

Which was pointed, because the Reader and the Editor have had exactly this two-way between
themselves for months.

### 29.2 Built

**Outbound, in the renderer.** A card for a chapter, a scene or a flag now carries one row that
leaves the braid: *read this chapter →* / *read this line in place →*. It posts
`{type:'open', chapterId, text}` and **asks** — a document inside a WebView has no business
deciding what the app around it shows, and the two hosts answer differently. `text` is the
flag's own anchored substring, so the host lands on the line rather than the top of the chapter,
which is the same contract the Reader and Editor already use with each other.

Guarded by `EMBEDDED`: opened standalone (`graph/braid-3d.html`) there is no host, and the row
is not rendered at all rather than being a dead control.

**Mobile answers with the Reader.** Deliberately: arriving from a structural view, the question
is almost always "what does this actually say", and the Reader can hand on to the Editor itself.

**The PWA answers with the Editor.** Also deliberately: this is the writing app, and someone who
followed a plant here is one step from changing it. An unknown chapter id is ignored rather than
opening something wrong.

**The PWA gained the inbound direction it never had** — `openBraidAt(nodeId)`, wired to a 🧵
control on every row of the editor's flag panel. The focus is **held until the frame reports
ready**: a focus posted into a document that has not finished booting is silently dropped and
reads as a broken button.

### 29.3 Verified

Driven in a browser, through the real embed harness and the real iframe rather than by calling
functions directly:

- The braid emits `{type:'open', chapterId, text}` with the **exact anchored substring**, not
  just a chapter id.
- Standalone, the way-out row is absent while the camera jumps remain.
- The PWA's handler, posted **as the frame itself** so the `e.source` guard was satisfied
  honestly: with text → `jumpToTextInEditor(chapterId, text)`; without → `openEditor(chapterId)`;
  unknown chapter → nothing at all. The braid view closes in the cases that navigate.
- The inbound queue: focus held while booting, sent exactly once on ready, **not re-sent** on a
  second flush.
- `tsc --noEmit` clean on mobile; all three braid builds regenerated from the one renderer.

**Not verified**: the mobile leg has not run on a device — `handleMessage` → `navigate('Reader')`
is typechecked only.

### 29.4 Open

- ~~The PWA's Reader has no braid control.~~ **Closed the same day.** The Reader's selection
  popup already held the cross-surface jump (“📝 Editor”), so “🧵 Braid” sits beside it. The Editor
  reaches the braid from its flag panel, where every row is a flag; the Reader has no flag list,
  so **the selection stands in for one** and granularity follows it: land on the flag if one was
  selected, on the chapter otherwise. A selection that is not a flag is the ordinary case in a
  reader, and answering it with “the chapter, then” beats refusing.

  Highlights are excluded from the match on purpose — a highlight is a reading mark, not a story
  flag, and the braid does not draw one, so matching against it would send the writer to
  something that does not exist. Verified: a selection inside a plant focuses that flag, one
  matching a highlight falls back to the chapter, and one matching nothing does too.
- **Subplots and threads have no way out**, by design — a subplot spans chapters and a character
  spans the saga, so neither has one place to open. Their own rows already jump to the flags that
  do.


## 30. TREATMENTS, AND WHY OTA HAD NEVER WORKED (2026-08-30)

### 30.1 The treatment layer — stages one to three of the treatment brief

**Stage one, applied.** `content_chunks.source_type` admitted only `('chapter', 'document')`,
so **pages could not be indexed at all** — every downstream thing (recall, contradiction
checking, both assistants) was blocked on that one predicate, and had been since pages
shipped. Widened to admit `page` and `treatment` (`20260830_index_pages_and_treatments.sql`).

Verified rather than assumed, because the brief asked: the function is `match_content_chunks`,
not `match_chunks`; its `p_source_type` is a nullable `text` compared with `=`, so a new value
needs no signature change; and its only caller doesn't pass it. **Widening the constraint was
sufficient on its own.** The constraint is dropped by *discovered* name — it was written
inline, so guessing what PostgreSQL called it would fail silently. Limitation recorded, not
fixed: a single-value filter cannot express "pages and treatments but not chapters".

**Stage two, applied** (`20260830b_treatments.sql`, `20260830c_treatment_history.sql`).

A treatment is a prose description of ONE scene at plot-summary granularity, dialogue
unwritten — the layer between pages (undated, unplaced) and chapters (finished prose). About
twenty scenes for Book One had lived only in chat transcripts because nothing in the database
could hold a finished description of an unwritten scene.

- **No `chapter_id`, no `book`, no `act`, and it must not acquire any.** Ordered saga-wide,
  because scenes are written before anyone knows which chapter they belong to. Nothing here
  touches `scenes`, `chapters`, `spine-layout.mjs` or the braid.
- **`position` is sparse numeric.** A drag writes one row. Numeric rather than int so a value
  always exists between two neighbours, however tight the gap.
- **Versions are rows, not jsonb** — the reason is recall: a version has to be independently
  rankable and addressable, or search answers "this treatment matches" and leaves ten versions
  to read, which is the complaint the layer exists to answer.
- **`search_everything()` gained a fifth branch and a `status` column**, so it DROPs before it
  creates (create-or-replace cannot change a return type). Additive for existing callers.

**One conflation in the brief, pulled apart** (`20260830c`). The brief asked for both
`treatment_versions` rows where several may be live at once *and* autosave on the pages
cadence. Those are different objects: a version is an authorial act, a snapshot is text about
to be overwritten. Had the cadence written rows, an afternoon's work would leave forty and the
one property `status` exists to express would be unfindable — and `status` would come to mean
both "an autosave" and "a draft I set aside". So rows stay authorial and the overwrite trail
lives in `treatment_versions.history`, same shape and cadence as `sticky_notes.versions`. The
rejected alternative (auto-marking snapshots stale) needs no migration and destroys the
distinction the column was added for.

**Stage three, built on MOBILE ONLY.** `TreatmentsScreen` (drag-ordered list),
`TreatmentScreen` (editor, versions behind one dot), `treatmentStore.ts`, both junctions —
page → treatment listed *above* page → chapter, since most of what gets deposited is
scene-level. `became_type` on `sticky_notes` was already wider than `chapter`; only `chapter`
had been wired.

Drag reuses `useSortableList` + `useSortablePositions`. **`SortableItem.onDrop` is
`(id, position)`, not `(from, to)`**, and the working pattern keeps a *local* reordered list
that `onMove` mutates and `onDrop` reads — a `useMemo` off the store is reset under the drag by
every store update. Matched to `ChapterListScreen` rather than invented.

**A bug fixed on the way**: mobile's `SearchScreen` routed any unrecognised `kind` through a
ternary to `openers.chapter(r.id)`, so a treatment hit would have opened the Editor with a
version id as its chapter. Treatment hits now also display live/set-aside, because a stale
version shown unlabelled above its replacement is the failure most likely to make recall feel
untrustworthy on first use.

**Not built**: the PWA's treatment surfaces, Stage Four (recall) and Stage Five (the version
diff). Stage Four's deterministic prerequisites are now all in place.

### 30.2 §20 IS WRONG: OTA delivery had never once worked

§20 records that the phone takes JavaScript changes over the air. **For the binary actually
installed, that was never true**, and a week of shipped work never reached the device.

Three faults, discovered in this order, each of which alone was sufficient:

1. **The `preview` channel had no branch pointed at it.** Builds ask for a *channel*; updates
   publish to a *branch*; nothing linked them. The server correctly answered "no update
   available" every time. Fixed: `eas channel:edit preview --branch preview`.
2. **`production` was pointed at branch `production`**, which has never had a publish.
3. **The decisive one: the installed APK had no update URL compiled into it.** The preview APK
   was built 2026-08-23 from `0883737`, where `app.json` read
   `updates: {enabled, checkAutomatically, fallbackToCacheTimeout}` — **no `url`**. The real
   `https://u.expo.dev/e9da412f…` was only recorded two days later in `77361dd`. That value is
   baked in at build time, so the binary never knew where to ask. **No publish could ever have
   reached it.**

**Why none of this was visible**: `useOtaUpdate`'s catch swallows a failed check on purpose —
"offline, or the update server is unreachable... neither is worth interrupting writing over."
Correct for a writing app, and it makes exactly this class of misconfiguration silent. If OTA
appears not to work again, **check the channel-to-branch mapping and the build's baked-in URL
before republishing anything**; a publish that succeeds proves nothing about delivery.

**Resolved by a rebuild** (`eas build --platform android --profile preview`, 2026-08-30), which
compiled the URL in. From that build onward `eas update --branch preview` should reach the
device with no rebuild. **That claim is unverified** — the first OTA onto the new binary has
not yet been attempted.

### 30.3 Open, from the first real-device session in a week

Reported on the new build, not yet diagnosed:

- ~~The braid's camera is over-constrained.~~ **Zoom fixed 2026-08-30; rotation is a design
  question, not a bug — see below.**

  **The zoom ceiling was a hard-coded 1400**, picked against a 17-chapter demo in landscape.
  It is arithmetic, not taste: the distance that frames a saga is
  `(width/2) / tan(hFov/2)`, and for 52 chapters in portrait that is **~3601** — unreachable.
  Worse, the initial `dist = framingDistance()` was itself unclamped, so the first zoom-out
  press jumped *inward* to 1400 with no way back out. Replaced with `maxDist()` derived from
  the content (`framingDistance() * 1.35`), and `clampDist()` applied everywhere the distance
  moves, including on resize — portrait and landscape differ by a factor of four, so turning
  the device used to leave the view stranded far inside the new maximum.

  **The far plane followed.** It was fixed at 4000, which a 52-chapter saga sits right against
  at its own framing distance: the far half of the spine would have clipped away exactly when
  the writer finally zoomed out far enough to see it. Now `max(4000, dist * 2.4)`.

  **There was no pinch gesture at all** — zoom was the wheel and the two buttons, and a phone
  has neither. Added on pointer events rather than touch events, so it shares one stream with
  the orbit instead of two handlers fighting over one gesture. Lifting out of a pinch is
  suppressed as a tap, or ending a zoom would select whatever was under the finger.
  `touch-action: none` on the canvas, without which the WebView claims vertical drags for
  scrolling.

  Verified in a browser at a 375x812 portrait viewport: initial framing 1150, zoom-out now
  reaches 1552 (= 1150 x 1.35, past the old ceiling), spread-to-zoom-in and pinch-to-zoom-out
  both move the camera the right way, and a lift out of a pinch selects nothing.

  **Rotation: the azimuth lock was raised as a design question and the author chose free
  rotation.** Built the same day. `phi` is now a real orbit angle with no clamp at all;
  elevation keeps its +/-1.35 rad limit, and the camera still never ROLLS -- `up` stays
  (0,1,0), so the horizon is level at every angle. The canonical side-on view is one tap away
  on the square button, which now resets phi along with theta and distance.

  Two consequences that had to be handled rather than left:

  * **Panning became camera-relative.** While the view was locked to one side, "drag right"
    and "move along +X" were the same thing. Once the camera can be anywhere, moving the
    target along world X sends the picture sideways at an angle to the gesture, which reads as
    a broken control rather than a rotated one. `panBy()` now extracts the camera's own basis.
  * **A one-finger drag no longer pans**, since it orbits. On touch that would have left no
    way to travel along the saga, so the two-finger gesture does BOTH jobs: the gap zooms, the
    centroid pans.

  Drag sensitivity is relative to the viewport in both axes (a full-height drag covers the
  elevation arc, a full-width drag turns it roughly once around) rather than a fixed rate per
  pixel, at which the arc needed ~450px of travel that a phone in landscape does not have.

  Verified at 840x420: starts at azimuth 0, one full-width drag turns ~1.14 rad, a second
  continues to ~2.28 with no clamp, `up` stays level throughout, and the reset returns exactly
  to azimuth 0.

  **A harness note worth keeping**: the braid computes its framing from `camera.aspect`, and
  when the Browser pane is HIDDEN the tab reports zero height, so aspect is NaN and every
  camera value downstream is NaN. That looks exactly like a broken camera and is not one --
  emulate a viewport before concluding anything about this renderer.
- ~~The two apps do not look alike.~~ **Diagnosed, and the first diagnosis was WRONG. Fixed
  2026-08-30.**

  It was recorded here that mobile was "still wearing the pre-redesign palette". **It was
  not.** Diffed role by role: `bg`, `border`, `text`, `text-dim`, `gold` and `error` are
  identical to the byte in BOTH day and night. The brown and the cream are the shared design,
  not a mobile-only leftover. Kept as a correction rather than tidied away, because the wrong
  answer was arrived at by reading commit *file lists* -- every redesign commit touched
  `index.html` alone, which is true and does not imply what it seemed to.

  **The divergence was entirely typography.** The visual pass moved the PWA's `--font-body` to
  **Spectral, a serif**, and `--font-display` from Cinzel Decorative to Cinzel. Mobile's
  `FONTS.body` was still Inter, and since `App.tsx` sets a global `<Text>` default from that
  one token, the whole app read as sans while the PWA read as serif. Identical colours,
  different face -- which is exactly what "it still looks like the old design" feels like.

  Ported: `body`/`bodyMedium`/`bodySemiBold` to Spectral, `display` to `Cinzel_700Bold`, and
  `Spectral_600SemiBold` registered in `useAppFonts` -- the family is already bundled, so it
  ships over the air rather than needing a build. One palette role had genuinely drifted:
  night `panel` was `#1a130b`, which is the PWA's `--bg-alt`, one step too dark; now `#221a10`.

  **Still not ported, and these are structure rather than tokens**: the rail (`--rail #1c211c`
  with its own ink), the leaf-green list cards, the parchment ornaments, and the two SVG grain
  textures -- CSS `background-image` data URIs with no React Native equivalent, so they need an
  `ImageBackground` with a bundled asset or a decision to drop them. The drawn icons are inline
  SVG `<symbol>`s that `Icon.tsx` re-renders by hand, so new ones must be redrawn, not
  imported.

  Port from the PWA's live `:root` block, which is the source of truth -- not from the
  reference images, which the PWA has already interpreted.


### 30.4 The braid on a real phone: three faults found by looking at it (2026-08-30)

All three were invisible in a browser and obvious in one screenshot of the device.

**The braid could never be in day mode on mobile.** `THEME` was read from
`new URLSearchParams(location.search)` -- which is how the PWA says so, because it sets the
iframe's `src` to `braid.html?theme=day`. **A WebView loading raw HTML has no URL and
therefore no query string**, so the expression always fell through to `night`: the app sat in
day mode, cream chrome and all, with a black braid inside it. That is why the olive-green day
palette had never once been seen on the phone.

Fixed with a second door: `window.__THEME__`, set by `injectedJavaScriptBeforeContentLoaded`
so it exists before the document's own scripts run, and checked FIRST because a host that
bothered to set it means it. The `<WebView>` is keyed on the theme, since the renderer decides
`THEME` once at module scope and a change has to remount the document rather than be posted
into a running one. Verified by injecting the same global into a fresh document: ground
`#faf7f0` instead of `#03060d`, olive threads on parchment.

**The native header cost about a fifth of the screen.** The braid is read in landscape, and a
header band there repeated a title the renderer already draws in its own top line. Removed
(`headerShown: false`); its two controls became corner glyphs over the canvas.

**The review bar broke the project's own rule.** It read "9 extractions to confirm" across the
bottom, over the renderer's legend and scrubber. Two faults: it spent scarce landscape height
on chrome, and it displayed **a count of pending work on a surface the writer is supposed to
want to open** -- the one thing §23 forbids outright, because it is what turns a map into a
queue and a queue into something avoided. Now a single unlabelled flag glyph beside the other
corner controls: reachable, not insistent.

**Still open**: the olive/leaf, rail and parchment-grain tokens exist only in the PWA's CSS.
The braid carries its own day palette (which is where the olive in that screenshot comes
from), but the mobile app's chrome around it has no equivalent, and those are structural
additions rather than token swaps -- see the design-parity note in §30.3.


### 30.5 One design, two hours: royal blue nights, olive days (2026-08-30)

Three decisions by the author, applied to both apps token for token.

**The braid is always dark.** Its ground stays midnight in every mode, in the PWA and on the
phone. That settles more than a background colour, so it is spelled out in the renderer: the
day palette is not "night on a pale ground", it is a different design -- thread on paper, dark
pigment, glow switched off, because adding light to white produces nothing. Pin the ground to
midnight while keeping those colours and you get dark green on near-black with nothing to
rescue it. So the braid takes the night palette entire. `HOST_THEME` still resolves, and
`THEME` is now fixed at `'night'`; the day palette is KEPT rather than deleted, because it is
a complete working design for a light ground and is the thing to reach for if the braid is
ever printed, exported, or embedded in a light document.

**Night is royal blue.** `--bg` moves from `#120d08` to `#0d1533`, with cream ink. The brown
was one note all the way down -- brown page, brown panels, brown rail -- so the gold had
nothing to sit against; it also fought the sign-in artwork, which has always been a blue
night. And because the braid is drawn on that same midnight, opening it no longer changes the
temperature of the whole screen.

**The drawer changes MATERIAL, not shade** -- the one inversion that makes the two modes read
as one design at two hours rather than as two designs:

| | page | drawer | drawer ink |
| --- | --- | --- | --- |
| night | royal blue `#0d1533` | cream `#efe6d0` | dark `#2c2011` |
| day | cream `#faf3e0` | olive `#3c4a2a` | gold `#e3c274` |

Mobile needed three new roles for this -- `rail`, `railInk`, `railDim` on `ThemeColors` -- since
its drawer had been painting itself from `bg`/`panel`/`text` and therefore could only ever be
a darker version of the page. `SlidePanel` now takes `rail`; `NavDrawer`'s ink, rules and
labels take `railInk`/`railDim`.

**Body ink stays dark on the cream in day mode.** "Gold letters upon cream" is right for the
chrome and wrong at reading size: gold text on cream at 14px is a legibility problem dressed
as a decision. The gold goes where it has something to hold -- on the olive rail, and on
headings.

**The drawer's ink is GOLD in both modes**, by decision -- but not the same gold. The app's
`#c69a3a` reads at roughly 2.3:1 against the cream rail: gold in name and grey in effect. Night
therefore uses `#8a6a35`, the same hue carried further down, which clears 4.5:1 and is legibly
gold rather than nominally gold. Day keeps the brighter `#e3c274`, which holds easily on olive.
One decision, two values, for the same reason a palette has a dim and a bright anywhere else.

### 30.6 The system bars were eating the braid's controls

Removing the native header did not cause this; it exposed it. The renderer's `Layers / Show /
View / Find` row sits at the very top of its own document, so full-bleed put it **under the
notification bar**, and the navigation bar sat over the legend and the time scrubber. Neither
was reachable, which on a surface whose entire content is one picture makes the picture the
only thing you can use.

Both bars now hide while the braid is open: `<StatusBar hidden />` (hidden rather than
translucent -- a translucent bar still reserves its height on Android and the top row would
stay underneath it) and `NavigationBar.setVisibilityAsync('hidden')`.

**Restored on BLUR, not on unmount.** This screen can be navigated away from and back to
without unmounting, and leaving a reader with no navigation bar on some other screen is a far
worse bug than the one being fixed -- so it hangs off `useFocusEffect`.

A display cutout survives hiding the bars, and **in landscape it is on the side** -- exactly
where the braid is read. The WebView is padded by the safe-area insets on all four edges, so
the renderer's chrome clears it without the renderer needing to know anything about phones;
the corner glyphs take the same offsets.


## 31. WRITING WITHOUT A NETWORK (2026-08-30)

The app did not open on a plane, and once it did it could not be written in. Both are fixed
for pages; chapters and treatments still read from cache and still write online only.

### 31.1 Why it would not open

`RootNavigator` waits on `initializing`, which clears only when `onAuthStateChange` fires.
Supabase restores the stored session fine, but an access token lasts about an hour, so a cold
start usually tries to REFRESH it -- and that needs a network. With none, the request does not
fail quickly; it hangs until the platform gives up, and the splash stays.

A 2.5s deadline now reads the session directly and lets the app in. It fabricates nothing: if
there is genuinely no session the sign-in screen is correct and simply arrives sooner, and a
late refresh still corrects through the listener.

Also relevant and NOT fixed: `updates.fallbackToCacheTimeout: 8000` in `app.json` adds up to
eight seconds before any of this runs. It is native config, so it needs a build.

### 31.2 Reading: last-known-good

`lib/offlineCache.ts`. Chapters, pages and treatments paint from AsyncStorage before the
network is asked anything, and keep it if nothing answers. A network failure is distinguished
from a database error by the ABSENCE of a PostgREST `code` -- so a missing table still
surfaces and a missing tunnel does not.

### 31.3 Writing: the outbox

`lib/outbox.ts`, wired into `pageStore`. Pages first, because pages are the deposit-anywhere
layer and a layer that cannot be deposited into on a six-hour flight is the exact failure the
design existed to end.

Four properties, and each is load-bearing:

1. **A write is never lost.** It lands in local state and in the cache BEFORE anything is
   sent, and stays queued until the server confirms it. A crash mid-flight loses nothing
   because nothing was ever only in memory.
2. **Replay is idempotent.** Rows carry **client-generated ids**, so an insert replays as an
   upsert on the primary key. This is the property that makes a queue safe rather than a
   duplicate factory, and it is why `createPage` now mints the id instead of Postgres.
3. **Order is preserved.** Oldest first, and a network failure stops the run rather than
   skipping ahead -- so an update never lands before the insert that created its row.
4. **Autosave does not flood it.** Updates to one row coalesce into a single op carrying the
   merged latest values. Six hours of typing is one pending write per page. An update against
   a row whose insert is still pending merges INTO that insert, because there is nothing on
   the server to update yet -- getting this wrong is how an offline page arrives empty.

**An op the server genuinely rejects is dropped**, not retried forever: a constraint violation
will never succeed, and leaving it at the head would block every write behind it. Only
codeless (network) errors are kept.

**Fetch does not clobber unsent work.** A refresh merges by `updated_at` and keeps any local
row the server has never seen, so landing does not overwrite what was written in the air.

**No new dependency for any of it.** The UUID is fifteen lines of `Math.random` -- deliberately
not crypto-strength, since these are row ids in an RLS-fenced table and the only requirement is
that two rows made on one device never collide. Reaching for `expo-crypto` would have bought
unguessability nobody needs at the price of a native module, and therefore a new APK, putting
the fix weeks away instead of minutes. The network is discovered by trying rather than by
asking `netinfo`, for the same reason. Flushes happen at launch and on every foreground.

### 31.4 Verified

`scripts/test-outbox.mjs`, 14 assertions: 500 autosaves collapse to one op still marked
insert and carrying the newest text; different fields on one row merge; separate rows stay
separate and in order; a network failure keeps the whole queue; a mid-run failure stops without
skipping; a rejected op is dropped without blocking those behind it; replaying an insert twice
touches one row.

**It tests the RULES, not the file** -- the module imports AsyncStorage and supabase, so the
test re-implements the two pure decisions and asserts against those. If the two diverge, the
test passes and the app is wrong. Worth knowing before trusting it.

**Not verified**: none of this has run on a device. The honest test is airplane mode -- write
three pages, force-quit, reopen still offline, confirm all three are there, then reconnect and
confirm they arrive exactly once.

### 31.5 Chapters and treatments, same treatment (2026-08-30)

Extended the same day. Every mutation in all three stores is now local-first: state and cache
first, queue second, network whenever there is one. `createChapter`, `createTreatment` and
`addVersion` mint their ids here rather than in Postgres, for the same reason `createPage`
does -- a row made in the air needs an identity the editor can open and the outbox can replay
onto.

Two things specific to these two:

**A treatment is two rows.** The version references the treatment, so the treatment is enqueued
first and the outbox's ordering guarantee does the rest: a failure stops the run rather than
sending the child on its own.

**Chapter reordering enqueues one op per row**, not one for the batch. The outbox coalesces per
row, so a drag that settles several times before the network returns still sends each chapter
exactly once.

**The known limitation, stated rather than discovered later**: the merge for `annotations` and
`versions` is LAST WRITE WINS ON THE WHOLE ROW. Two devices flagging different lines in one
chapter while both offline will keep only the copy that syncs later. With one writer on one
device it never arises. It is written into `updateChapter` because the day it does arise it
will look like data loss rather than like a documented trade.

**Only one direct write remains** in the three stores: `deleteChapter`, a hard delete that the
UI does not call -- deletions go through `trashStore`. It stays online-only deliberately;
queueing a destructive op is a different risk from queueing a constructive one.
