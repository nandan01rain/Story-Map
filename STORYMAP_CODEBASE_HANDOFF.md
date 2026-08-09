# StoryMap — Codebase Handoff for Incoming Claude Code Session

This document is written for a **coding agent**, not a human. It exists because
development is moving to a fresh conversation and the accumulated implementation
context (debugging history, architectural decisions, half-finished work) would
otherwise be lost. `CLAUDE.md` in this repo is the original project brief and is
now **stale in several places** — where it conflicts with this document or with
the actual code, this document and the code win. Do not re-derive decisions this
document already settles; do not blindly trust `CLAUDE.md`'s roadmap either.

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
  diagnostic overlay, currently `true`/enabled in the working tree, uncommitted
  and not meant to ship.** See §7 and §9 — this is the single most important
  "don't forget about this" item in the handoff.

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

### RLS policies **[UNVERIFIED / hosted-only]**
Every query in the client filters by `user_id`/`project_id` manually, which
strongly implies RLS is expected to enforce the same boundary server-side, but
**no policy definitions exist anywhere in this repo** to confirm what's
actually enforced versus merely assumed by client-side filtering. **Treat this
as a real security question to verify, not a settled fact** — if RLS is
missing or misconfigured on the live project, the manual `.eq('user_id', ...)`
filters are the *only* thing preventing cross-account data access.

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
| Mobile / responsive behavior | **COMPLETE for map/header/editor/reader; drawer and mark-toolbar explicitly deferred** [SESSION, heavily verified] | See §6 — multiple rounds of real fixes. The chapter drawer's fixed 440px width and the editor's mark-toolbar layout were **explicitly excluded** from the mobile work as a separate, more involved future stage — do not assume they're mobile-safe. |
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
- The round-4 map ghost-click fix (§6) is implemented and passed sandbox
  simulation, but the **real device test that surfaced the bug in the first
  place has not yet re-run against this fix**. Treat map touch interaction as
  "believed fixed, not confirmed" until that happens. [SESSION]
- `setPointerCapture` behavior on the actual failing device is still not
  100% understood — the working theory (native compatibility-click hit-tests
  ignore pointer capture on some touch engines) fits all observed telemetry
  but was never confirmed against engine source/spec for the specific
  device/browser in question. [SESSION, reasoned but not spec-confirmed]

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
  Not urgent at current content scale, worth flagging for later.

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

**Just completed** (implemented and passed sandbox/simulated testing, but see
caveat below): the round-4 map ghost-click fix — a 400ms suppression window
preventing a browser-synthesized ghost `click` on the act-cluster rect/label
from firing right after a touch-originated chapter-node tap already correctly
opened its chapter. This is currently **uncommitted** in the working tree
(confirmed via `git diff HEAD` — it's the only uncommitted change; everything
else, including the temporary debug overlay itself, is already committed as
of commit `7b2711e`).

**What remains unfinished / explicitly queued:**
1. **Real-device confirmation of the round-4 fix.** The user's last message in
   this session was reporting round-3 telemetry (halo hit-testing confirmed
   fixed, but outcome still wrongly resolving to the act popup) and asking for
   exactly the fix that was just implemented. The next step — the user
   re-testing on the real device with the same debug-overlay logging, and
   reporting whether "last target: halo" now correctly pairs with the correct
   chapter opening instead of the act popup — **has not happened yet**.
2. **Remove or disable the temporary debug overlay** (`DEBUG_TOUCH_OVERLAY`)
   once round 4 is confirmed. It is currently live and enabled.
3. **Commit the round-4 fix** (and disable/remove the overlay in the same or
   a follow-up commit) once confirmed — nothing from this round is in git yet.

**Next logical task**, in order: (a) get real-device confirmation of round 4,
(b) fix anything it reveals, (c) turn off/remove the debug overlay, (d) commit.
Beyond that immediate loop, no other task was explicitly queued by the user at
the time of this handoff — the mobile-responsiveness and map-touch work was
being driven reactively by real-device bug reports, not from a pre-set backlog.

**Do not** assume the mobile-responsiveness or map-touch-interaction work is
"done" in a general sense — treat both as "extensively iterated on this
session, last round unconfirmed" rather than closed.

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
- Before touching the map's touch/pointer logic: re-read §6's five-round
  history in full. Each round looked like a complete fix until real-device
  testing found the next layer. Assume there could be a round 5.
- Before touching `saveData()`/`loadData()`: know that errors are currently
  silent, and that "looks saved in the UI" is not the same as "actually
  persisted" — verify against the actual Supabase table if in doubt, not just
  the in-memory state or a mock.
- Before touching the editor: re-read §3.5. The `contenteditable` + caret-math
  + plain-text-only constraints are load-bearing, not accidental complexity.
- Before touching anything mobile-specific: check whether the existing fix is
  scoped by breakpoint/pointer-type/coarse-pointer media query, and preserve
  that scoping in any change — don't let a mobile fix leak into desktop.
- Before importing `story-map-export-2026-08-05.json` (or trusting it as a
  content backup): check its `chapters[].id` format against the current
  UUID-based schema first.

**Must not assume:**
- That the AI features work — they don't, outside the original sandbox (§5/§7).
- That RLS is correctly configured — unverified (§4/§7).
- That the app is deployed anywhere reachable right now — unverified (§7).
- That `CLAUDE.md` reflects current reality on: storage layer (it doesn't —
  Supabase has been live for a while), multi-project (it's done, not
  deferred), or the editor's implementation (it's `contenteditable`, not
  textarea+overlay).

**Should be tested on a real device before being called done:**
- The round-4 ghost-click fix (§6/§9) — this is the immediate next step.
- Any future change to map touch/drag/tap logic, full stop — this session's
  history shows sandbox/simulated testing repeatedly missed real-device-only
  failure modes (halo hit-testing, ghost clicks) that only surfaced from
  actual hardware. Simulated `PointerEvent`s dispatched via JS are not
  "trusted" events and do not reproduce a real browser's native
  touch-to-mouse-compatibility-event cascade — don't treat a clean simulated
  test as proof of real-device correctness for anything touch-related.
- Any change to the mobile header/editor-header collapse behavior, especially
  re-checking desktop is untouched (screenshot comparison, not just a
  behavioral test, since the first hamburger-menu attempt broke desktop
  *visual order* without breaking any specific behavior a quick test would catch).

**Particularly fragile architectural areas, ranked:**
1. Map SVG pointer/touch interaction (§6) — most-patched, least "done."
2. The `contenteditable` editor's caret-preservation + inline-annotation
   rendering (§3.5) — correct today, easy to break by a well-intentioned refactor.
3. `saveData()`/`loadData()` error handling — silent failures are the default;
   any new feature built on top of these inherits that silence unless it
   explicitly adds its own error surfacing.
4. Anything touching both mobile and desktop styling/behavior in the same
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
| Map touch-interaction bug history and fixes (rounds 1–3) | **ESTABLISHED IN THIS SESSION**, each round's fix independently verified via direct testing at the time |
| Round-4 ghost-click fix | **ESTABLISHED IN THIS SESSION, sandbox-verified only** — real-device confirmation is the explicit next step, not yet done |
| Editor architecture (`contenteditable`, caret math) | **VERIFIED FROM CURRENT CODE** — the *reasoning/history* behind choosing this architecture is not in this session's visible history (it likely predates it), only the resulting code and its inline comments are verified |
| UUID migration having happened | **VERIFIED FROM CURRENT CODE** (consistent `crypto.randomUUID()` usage, `nextId` scoped to annotations only) — the migration *process/history* itself is not in this session's visible history |
| Multi-project support being complete (vs. `CLAUDE.md`'s "deferred") | **VERIFIED FROM CURRENT CODE** |
| Deployment target (Vercel) | **UNVERIFIED** — stated in conversation, no config file confirms it |
| Origin of the stray `git` file | **UNVERIFIED** — actively investigated in a prior session, inconclusive |
| Mobile-responsiveness fixes (viewport meta, touch targets, hamburger menus, input zoom) | **ESTABLISHED IN THIS SESSION**, each verified via direct browser testing (including a real desktop-vs-mobile screenshot comparison to catch a regression) at the time |
| Reader page-break fix | **ESTABLISHED IN THIS SESSION**, verified via direct rendering test at the time |
