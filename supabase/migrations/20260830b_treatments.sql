-- Stage Two: the treatment layer. NOT APPLIED -- written for review.
--
-- A treatment is a prose description of ONE scene: everything that happens in it, at
-- plot-summary granularity, with the dialogue unwritten. It is the missing middle. Pages are
-- undated deposits with no position; chapters are finished prose. Roughly twenty scenes for
-- Book One exist today only in chat transcripts, patch documents and the Working Bible,
-- because the database has had nowhere to put a finished description of an unwritten scene.
--
-- WHAT THIS LAYER IS NOT, and must not become: it has no relationship to Book -> Act ->
-- Chapter -> Scene. No chapter_id, no book, no act. Nothing here touches `scenes`,
-- `chapters`, spine-layout.mjs or the braid. Treatments are ordered SAGA-WIDE because scenes
-- are written first and grouped into chapters later -- pacing is a higher-level problem
-- solved after the material exists, and wiring these into the hierarchy now would force that
-- decision at exactly the moment the writer cannot yet make it.

create table if not exists public.treatments (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  project_id  uuid not null references public.projects (id) on delete cascade,

  -- A short handle. Nullable on purpose: naming a thing is a decision, and this layer exists
  -- because decisions at capture time are what stopped the last three features being used.
  -- The list falls back to the first line of the live version, exactly as the pages stack
  -- already titles itself.
  title       text,

  -- Saga-wide ordinal, SPARSE. Inserted in multiples of 1000 so that moving one treatment
  -- writes one row rather than renumbering the list. That is not premature optimisation: the
  -- entire point of this layer is that the order churns constantly while the material is
  -- still loose, and a scheme that rewrites fifty rows per drag would be felt immediately.
  --
  -- numeric rather than int so a treatment can always be dropped between two neighbours
  -- without a renumbering pass, however tight the gap has become.
  "position"  numeric not null default 1000,

  -- Where its words went. Same semantics as sticky_notes: promotion COPIES, the treatment
  -- stays exactly as written, and this records the destination only.
  became_type text,
  became_id   uuid,
  became_at   timestamptz,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Versions are their own table rather than a jsonb column like chapters.versions.
--
-- The reason is recall, not tidiness. Recall has to return ONE specific version, rank it
-- among everything else, and label it live or stale. A jsonb array cannot be indexed per
-- element, so the jsonb design answers "this treatment matches your query" and leaves the
-- writer opening it and reading ten versions to find which one matched -- which is the exact
-- complaint this layer exists to answer. A row per version is what makes a version
-- addressable.
create table if not exists public.treatment_versions (
  id            uuid primary key default gen_random_uuid(),
  treatment_id  uuid not null references public.treatments (id) on delete cascade,
  user_id       uuid not null references auth.users (id) on delete cascade,
  project_id    uuid not null references public.projects (id) on delete cascade,

  content       text not null default '',

  -- live | stale. MULTIPLE LIVE VERSIONS ARE A LEGITIMATE RESTING STATE, not an error to be
  -- resolved. Two live versions mean the writer is holding two readings of a scene open on
  -- purpose. Nothing may ask them to reduce to one, and nothing may count them.
  --
  -- Deliberately unconstrained, same reasoning as sticky_notes.type: a CHECK turns a marker
  -- into a gate the first time a third word is wanted.
  status        text not null default 'live',

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  -- Generated rather than trigger-maintained, same as every other search column here: with a
  -- literal regconfig to_tsvector is immutable, so there is no application code to forget.
  search        tsvector generated always as (to_tsvector('english', coalesce(content, ''))) stored
);

comment on column public.treatment_versions.status is
  'live | stale. A marker, never a location. Marking a version stale filters it out of the '
  'default view and does nothing else: the row stays, stays searchable, and stays '
  'retrievable. Several live versions at once is a real state and not a conflict.';

comment on table public.treatments is
  'A prose description of one scene, at plot-summary granularity, dialogue unwritten. Sits '
  'between pages (undated, unplaced) and chapters (finished prose). Ordered saga-wide and '
  'deliberately NOT attached to Book/Act/Chapter -- scenes get written before anyone knows '
  'which chapter they belong to.';

create index if not exists treatments_project_position_idx
  on public.treatments (project_id, "position");

create index if not exists treatment_versions_treatment_idx
  on public.treatment_versions (treatment_id, created_at desc);

create index if not exists treatment_versions_search_idx
  on public.treatment_versions using gin (search);

-- RLS, matching sticky_notes exactly: auth.uid() = user_id for ALL, on both qual and check.
-- User-scoped rather than project-scoped, which is the shape the whole app already uses --
-- project separation is a client-side convention here and not a database boundary (§4).
alter table public.treatments enable row level security;
alter table public.treatment_versions enable row level security;

drop policy if exists "own treatments" on public.treatments;
create policy "own treatments" on public.treatments
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own treatment versions" on public.treatment_versions;
create policy "own treatment versions" on public.treatment_versions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------------------
-- search_everything(), now five branches.
--
-- The return type gains `status`, so this DROPs first: create-or-replace cannot change a
-- function's return type. Additive for every existing caller -- both apps select the columns
-- they know by name and ignore the rest -- and necessary here, because a stale version
-- surfacing unlabelled above its replacement is the single failure most likely to make this
-- surface feel untrustworthy the first time it is used.
--
-- The trap from §23.4, still live: ORDER BY after UNION ALL resolves against the FIRST
-- branch's output column names, which is why branch one is aliased and the ordering is by
-- ordinal position. Adding a branch does not change that, but renumbering the columns would.
drop function if exists public.search_everything(uuid, text);

create or replace function public.search_everything(p_project_id uuid, p_query text)
returns table (
  kind       text,
  id         uuid,
  parent_id  uuid,
  title      text,
  snippet    text,
  rank       real,
  at         timestamptz,
  status     text
)
language sql
stable
security invoker
set search_path = public
as $fn$
  with q as (select websearch_to_tsquery('english', p_query) as ts),
  owns as (
    select 1 from public.projects p
     where p.id = p_project_id and p.user_id = auth.uid()
  )
  select 'page'::text as kind, n.id as id, null::uuid as parent_id,
         nullif(trim(split_part(regexp_replace(coalesce(n.content, ''), '^\s+', ''), E'\n', 1)), '') as title,
         ts_headline('english', coalesce(n.content, ''), q.ts,
                     'MaxFragments=2,MinWords=8,MaxWords=22,StartSel=<mark>,StopSel=</mark>') as snippet,
         ts_rank(n.search, q.ts) as rank,
         coalesce(n.updated_at, n.created_at) as at,
         null::text as status
    from public.sticky_notes n, q
   where n.project_id = p_project_id and n.search @@ q.ts and exists (select 1 from owns)

  union all
  select 'chapter', c.id, null::uuid, c.title,
         ts_headline('english', coalesce(c.content, ''), q.ts,
                     'MaxFragments=2,MinWords=8,MaxWords=22,StartSel=<mark>,StopSel=</mark>'),
         ts_rank(c.search, q.ts), c.updated_at, null::text
    from public.chapters c, q
   where c.project_id = p_project_id and c.search @@ q.ts and exists (select 1 from owns)

  union all
  select 'scene', s.id, s.chapter_id, s.title,
         ts_headline('english', coalesce(s.summary, ''), q.ts,
                     'MaxFragments=2,MinWords=8,MaxWords=22,StartSel=<mark>,StopSel=</mark>'),
         ts_rank(s.search, q.ts), s.updated_at, null::text
    from public.scenes s, q
   where s.project_id = p_project_id and s.search @@ q.ts and exists (select 1 from owns)

  union all
  select 'document', d.id, null::uuid, d.title,
         ts_headline('english', coalesce(d.content, ''), q.ts,
                     'MaxFragments=2,MinWords=8,MaxWords=22,StartSel=<mark>,StopSel=</mark>'),
         ts_rank(d.search, q.ts), d.updated_at, null::text
    from public.documents d, q
   where d.project_id = p_project_id and d.search @@ q.ts and exists (select 1 from owns)

  -- Treatment versions. `id` is the VERSION and `parent_id` is the treatment, because a hit
  -- has to be openable at the version that actually matched -- that addressability is the
  -- whole reason versions are rows. Title falls back to the version's own first line the way
  -- the list does.
  union all
  select 'treatment', v.id, v.treatment_id,
         coalesce(nullif(trim(t.title), ''),
                  nullif(trim(split_part(regexp_replace(coalesce(v.content, ''), '^\s+', ''), E'\n', 1)), '')),
         ts_headline('english', coalesce(v.content, ''), q.ts,
                     'MaxFragments=2,MinWords=8,MaxWords=22,StartSel=<mark>,StopSel=</mark>'),
         ts_rank(v.search, q.ts), coalesce(v.updated_at, v.created_at), v.status
    from public.treatment_versions v
    join public.treatments t on t.id = v.treatment_id, q
   where v.project_id = p_project_id and v.search @@ q.ts and exists (select 1 from owns)

  order by 6 desc, 7 desc nulls last   -- rank, then recency. Positions, per the note above.
  limit 200;
$fn$;

comment on function public.search_everything(uuid, text) is
  'Full-text search across pages, chapters, scenes, documents and treatment versions in one '
  'project the caller owns, ranked. `status` is non-null only for treatment versions and '
  'carries live/stale, which MUST be displayed: a stale version shown unlabelled above its '
  'replacement is worse than not finding it at all.';
