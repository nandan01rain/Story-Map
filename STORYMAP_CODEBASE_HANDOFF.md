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
