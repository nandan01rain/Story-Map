# StoryMap — Context Brief

*Written 2026-08-21 to be pasted into a fresh chat as background. Self-contained:
assumes the reader knows nothing about the project. Facts first, assessment last and
clearly labelled as such.*

---

## 1. What StoryMap is

A personal writing tool for a five-book mythological saga called **"The Trail to
Kailash"**. StoryMap is the tool; the saga is the content it exists to help write.
Built by one person. Currently one user.

Original aesthetic brief: "papyrus, Pirates of the Caribbean, Avatar, Dune" —
Cinzel headers, parchment/leather palette, an embedded map background. This is a
deliberate design choice, not a placeholder theme.

**Core design principles, held throughout:**

- Every AI feature stays behind a toggle and is never required. Add / edit /
  organise / write must work fully with AI off.
- Flags, never hard limits. Word targets, continuity gaps and orphan plants are
  advisory. Nothing blocks the writer.
- Destructive actions get a confirmation and a trash entry, never a silent delete.

---

## 2. Architecture

Two codebases, one backend.

**PWA** — `index.html`, a single self-contained file (all CSS, JS, and a
base64-embedded map image inline), plus `manifest.json`, `service-worker.js`,
`supabase-config.js`. Originally built as a Claude.ai artifact, then migrated into
a real repo.

**Mobile** — `mobile/`, a from-scratch React Native / Expo rewrite. Not derived
from `index.html`; shares no UI code. Started 2026-08-16 after concluding a PWA is
still Chrome's engine underneath and that ceiling was unacceptable (reference point:
Kindle's custom-drawn reading surface, which a web page cannot replicate).

- Expo SDK 57, React Native 0.86, React Navigation (native-stack), Zustand,
  Reanimated 4, react-native-svg 15.
- Same Supabase project, same tables, no schema divergence. A chapter edited in one
  appears in the other.

**Backend** — Supabase (Postgres + Auth). Tables: `projects`, `chapters`, `scenes`,
`documents`, `sticky_notes`, `trash`, and (new, 2026-08-21) `content_chunks` with
pgvector. Account-level preferences live in Supabase Auth `user_metadata` rather
than new tables — `display_name`, `birthday`, `special_occasions`, `motion_enabled`,
`project_order`, `assistant_enabled`.

**Data model.** Book → Act → Chapter → Scene. Acts are inferred from integer `act`
values on chapters, not stored as entities; a book can have 1 act or 9. Chapters hold
the prose; scenes are metadata-only children (title, summary, POV, plants, notes).

---

## 3. Feature inventory

### 3.1 Shipped — PWA

- **Map view** — SVG trail, Book bands containing Act clusters containing Chapter
  nodes, drag-and-drop reordering with reassignment by drop position.
- **List view** — mobile-friendly accordion, independent of map view.
- **Chapter drawer** — position, status, scenes with POV and summary, word count vs
  book target, flag widgets, chapter notes.
- **Full-screen editor** — `contenteditable` with inline `<mark>` tags, debounced
  autosave, version history (last 10, restorable).
- **Plant / Reveal / Note flagging** — select text, flag it. Plants feed a scene's
  `provides`; Reveals feed `requires` and can hard-link to a specific Plant via a
  text-overlap-ranked candidate list; Notes can carry a free-text thread name.
- **Continuity check** — keyword-overlap matching across the saga. Two sections:
  unmet requirements (with a "not due yet" deferred state) and orphan plants.
- **Plant Ledger** — every plant, saga-ordered, paid or open.
- **Thread view** — per chapter, one level up and one level down.
- **Mythic Threads** — many-to-many motif tracking across books.
- **POV tracker** — free-text POV per scene, autocomplete, index with scene counts,
  full-screen browser per POV.
- **Documents library** — Master Bible, character bibles, references, timelines.
- **Sticky notes ("The Margin")** — quick unstructured capture.
- **Full-text search** across chapters, scenes, documents, notes.
- **Trash** — soft delete with restore.
- **Export / import** — full-state JSON.
- **Book-level word targets** — set per book, inherited by every chapter.
- **In-app Reader** — Kindle-style paginated, chrome-free, tap/swipe page turns,
  font/layout sheet, two bookmark systems, two-way sync with the editor.
- **Account settings**, **landing page** with bottom tab bar, **sign-in screen**
  with full-bleed art and a tap/swipe bottom-sheet form.
- **PWA packaging** — installable, service worker, fullscreen display mode.

### 3.2 Shipped — Mobile (verified on a real device)

- Auth with durable sessions (AppState-driven Supabase token refresh).
- Project CRUD including drag reordering — a gap filled mobile-first; the PWA has no
  project ordering at all.
- List view: Book → Act → Chapter, book-wide drag reorder, per-book "+" to create a
  chapter directly into a chosen act.
- Chapter drawer with a word count that glows blue/gold/red against the book target
  rather than printing raw numbers.
- Single always-editing chapter editor: native selection for flagging, autosave,
  version history.
- **From-scratch Reader** — real page-level pagination via off-screen text
  measurement; chrome-hidden fullscreen and chrome-visible three-page carousel;
  slide-in table of contents; font/layout controls; local moving and pinned
  bookmarks; long-press-and-drag word selection with per-word hit rectangles.
- Reader **highlights** — marker toggle in the selection popup, hollow when
  unhighlighted and solid when highlighted, stored as annotations located by
  substring so every occurrence tints.
- Two-way **Editor ↔ Reader jumps** landing on the exact selected text.
- Sticky notes with real table CRUD.
- **Documents library** (mobile had none before).
- **Google Drive import** — browse or search Drive, multi-select, import as
  documents. Written but cannot connect until a Google Cloud OAuth client exists and
  Google is enabled in the Supabase Auth dashboard.
- Full-text search.
- **Living sign-in scene** — layered artwork ported from the PWA: bobbing ships,
  gliding birds, twinkling city lights, flickering lanterns, drifting water bands
  masked to the shoreline. Switches day / sunrise-sunset / night on real time, with a
  manual override in Settings.
- Landing page with Home / Projects / + / Explore / Profile tab bar, in the same
  three time modes.
- Settings: day/night/auto theme toggle, scene picker, app-scoped brightness,
  assistant toggle.
- Hamburger drawer and Reader TOC as finger-tracked edge-swipe panels, no button.

### 3.3 Built but switched off — the assistants

Complete and committed; nothing deployed, no API key bought, nothing billed. A
deliberate pause, not an unfinished build.

- `content_chunks` table with pgvector, HNSW index, RLS, and a `SECURITY INVOKER`
  similarity-search function. **Migration already run** against the live project and
  verified.
- Edge Function (`supabase/functions/assistant/`) with `index` and `ask` routes. The
  API keys live here, never in client code.
- Paragraph-boundary chunking with overlap and content hashing, so editing one
  paragraph re-embeds one chunk rather than a chapter.
- **Icarus** — validation agent. Haiku 4.5. Adjudicates candidates that deterministic
  checks have already found. Must quote evidence; forbidden from proposing prose.
- **Daedalus** — craft agent. Opus 5, adaptive thinking, `effort: high`, plus a
  project digest (every chapter's book/act/position/title/status and the canon
  document list) and the web search tool. Answers judgement questions — whether a
  mythological parallel fits, why, how far the resemblance should run and where it
  should stop; structure; technique; grounded comparison to published work.
- Account-level toggle in `user_metadata`, off by default. Indexing is gated on the
  same toggle, because embedding is itself a paid call.
- Chat panel with per-question agent choice (not auto-routed — Daedalus costs several
  times more per answer).

**Remaining before it runs:** buy an Anthropic key, decide the embedding provider,
`supabase secrets set`, `supabase functions deploy assistant --use-api`.

### 3.4 Scoped but unwritten

- Map view on mobile.
- Continuity checker, POV tracker, Mythic Threads, Plant Ledger, Trash on mobile.
- Icarus's deterministic SQL half — the checks that should run before any model call.
- Proposal / review queue so canon-document edits arrive as a diff to accept rather
  than a silent write.
- MCP server (would let Claude reach into StoryMap, and is the only path that runs on
  a Claude subscription rather than an API key).
- Day/night palette for the writing app itself.
- Rich-text editor with real position tracking — annotations currently relocate by
  searching for their substring and silently stop rendering if the prose changes
  enough to break the match.
- Images and attachments (needs Supabase Storage plus an attachment model).
- Cross-project search ("Explore" tab is a styled placeholder).
- Real per-book cover art.
- OAuth sign-in, password-reset landing page.
- AI-assisted plant/reveal matching (currently pure keyword overlap).

### 3.5 Known weaknesses

- The PWA's AI features call `api.anthropic.com` directly from client JS with no key.
  They have never worked. The Edge Function is the fix.
- `saveData()` in the PWA upserts every row of every populated table on each save.
- Annotations break silently when surrounding prose is edited past the match.
- Google Drive import is inert pending account configuration.
- Mobile: chapter/scene delete is a hard delete; the PWA soft-deletes to trash.
- No collaboration of any kind.

---

## 4. The competitive picture

### Novelcrafter — the incumbent

Sources: [novelcrafter.com](https://www.novelcrafter.com/),
[pricing breakdown](https://checkthat.ai/brands/novelcrafter/pricing),
[BYOK review](https://www.toolworthy.ai/tool/novelcrafter),
[fiction tools compared](https://blog.mylifenote.ai/the-11-best-ai-tools-for-writing-fiction-in-2026/).

- **220,000+ authors** per their own site. Discord and YouTube communities.
- **Codex** — wiki-style story bible: characters, locations, items, factions, lore,
  with aliases, relations between entries, progressions over time, and automatic
  mention-tracking across a manuscript and across a series.
- **Planning** — grid and timeline views, explicitly framed as finding plot holes and
  inconsistencies early.
- **Workshop / Chat** — brainstorming, writing and review with a customisable
  prompting system.
- **Collaboration** — invite editors, proofreaders, writing groups.
- **Bring-your-own-key AI** — OpenAI, Anthropic, Google, Meta, Mistral, OpenRouter,
  or local models via Ollama.
- **Pricing** — $4 Scribe / $8 Hobbyist / $14 Artisan / $20 Specialist per month, AI
  usage billed separately by the provider. Annual billing saves ~2 months. 21-day
  trial with free models through OpenRouter.
- Browser-based. No native mobile app.
- Positioned by reviewers as optimising for **structure and continuity**, against
  Sudowrite which optimises for prose generation.

Note: the BYOK model designed for Icarus and Daedalus, including per-agent provider
choice, is **not** a differentiator — it is the incumbent's existing billing model.

### Where StoryMap differs

| Capability | StoryMap | Novelcrafter |
|---|---|---|
| Story bible | Documents library, free text | Codex with aliases, relations, progressions, auto mention-tracking |
| Continuity model | **Directed dependency graph** — scenes declare requires/provides, plants link to reveals, requirements can be deferred | Mention-tracking plus AI review over a wiki |
| Series scale | Five books first-class, cross-book motif threads | Series sharing on the Codex |
| Mobile | **Native app** with real paginated reader and editor | Browser only |
| AI assistance | Two specialised agents, built, never run | Workshop/chat shipping for years |
| Provider choice | BYOK planned | BYOK across six providers plus local |
| Collaboration | None | Editors, proofreaders, groups |
| Spatial view | Map — the saga as a journey | Grid and timeline |
| Users | 1 | 220,000+ |

---

## 5. Assessment

*This section is judgement, not fact. Treat accordingly.*

### The question that matters

*"I am one person with a Claude Pro subscription. If I can build a similar product
for myself in a week, why would anyone use such a product on a retention basis?"*

The premise is half true, and the half that is true cuts against StoryMap as a
business rather than against the incumbent.

**It was not a week.** The state export in the repo is dated 5 August; mobile started
16 August; it is 21 August and Map view still does not exist on mobile, the assistants
have never run, and Drive import cannot connect. Several bugs in a single recent
session took three or four attempts each against a real device — a CSS blend mode that
silently rendered entire layers invisible, a drag-list library that stacked every row
on top of the first, a session that expired unnoticed and forced a re-login on every
launch. None of that appears in a demo. All of it appears in a product.

What exists is a **personal tool with tolerated gaps** — tolerable because there is
one user who knows where they are.

### What actually creates retention here — none of it is features

1. **Data gravity.** Once five books live somewhere, leaving costs a migration nobody
   wants to run. Strongest force in the category; accrues to whoever arrived first.
2. **Trust.** Losing a manuscript is catastrophic and unrecoverable. Writers pay for
   the belief the tool will still exist in two years — which a solo project cannot
   credibly promise.
3. **The maintenance treadmill.** Build cost collapsed; maintenance cost did not.
   Expo SDK, React Native, Reanimated, react-native-svg, Supabase, pgvector, model IDs
   and their pricing are all moving targets, and recent sessions burned real time on
   library-level breakage unrelated to the product idea.
4. **Community.** 220,000 authors is a support network and a prompt library, not a
   feature list.

### The one genuinely defensible edge — and it is not the AI

**Provable continuity rather than guessed continuity.** Novelcrafter's Codex tracks
mentions. StoryMap models dependencies: a scene declares what it requires and
provides, a plant links to the reveal that pays it, a requirement can be deferred
rather than silenced. That is a build system's dependency graph applied to narrative,
and it means a whole class of continuity error is findable **deterministically, with
no model call and no token cost** — this reveal claims a plant never sown; this
requirement is never met; this thread is dropped after Book Two.

Every competitor answers continuity by asking a language model and hoping. A tool that
*proves* it is different in kind, not degree — and cheap enough to give away, which is
a real wedge.

Secondary edges: **mobile-native long-form** (the incumbent is browser-only, and
writers who draft and reread on a phone are underserved) and **series-scale by
default** (most tools are novel-shaped with series bolted on).

### Verdict

- **As a personal tool: continue without hesitation.** It fits the workflow exactly,
  the data is owned outright, there is no subscription, and it is most of the way
  there. Competitors are close to irrelevant to this use, and it needs no market
  justification.
- **As a business, as currently scoped: no.** "AI writing assistant with a story
  bible" is a solved, occupied category with an entrenched incumbent at $4/month and
  a BYOK model that would be copied rather than beaten. Retention would depend on data
  gravity that does not exist, trust that cannot yet be promised, and maintenance
  carried alone. The question answers itself: if the build is cheap, the build is not
  the moat.
- **The narrow path, if one is wanted:** not a writing suite but a **continuity engine
  for long series** — deterministic, provable, mobile-first, plausibly free or
  open-source, plausibly a companion to existing tools rather than a replacement. The
  value sits in the data model, not the interface, which is the part that is not a
  fortnight's work to copy.

### Recommended next step

Spend a week inside Novelcrafter's 21-day trial before building the assistants
further. Not to abandon StoryMap — nothing built is wasted either way — but to learn
precisely where it fails, and design against a known baseline rather than an imagined
one. It may also simply do the job for $8/month, which is worth knowing before writing
another line.
