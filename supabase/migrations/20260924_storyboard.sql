-- Storyboard: a book's chain of events, and the threads strung through them. NOT APPLIED --
-- written for review, paste into the Supabase SQL editor once.
--
-- A storyboard is the plot of ONE BOOK laid out as beats before (or beside) the prose: "the
-- caravan reaches the pass", "she learns the seal is forged". Events sit in one chain, in the
-- order the book tells them. Threads -- a subplot, a character's arc, a mystery -- are strung
-- through whichever events carry them, so the writer can see where a thread goes quiet, where
-- two cross, and where one is dropped.
--
-- WHAT THIS IS NOT:
--   * not scenes. Scenes are children of a chapter and describe prose that exists. An event
--     may precede any chapter, span several, or never become one. `chapter_id` is an optional
--     pointer to where it landed, nothing more, and `on delete set null` keeps the event when
--     the chapter goes.
--   * not treatments. Treatments are saga-wide and deliberately unplaced; a storyboard is a
--     book's shape, so every row carries its book.
--   * not the braid's subplots. Those are derived from plant/reveal flags in finished prose.
--     A storyboard thread is a plan, declared by hand, and may never be flagged anywhere.
--
-- Book is the same integer chapters carry (0 = Book One). Books are not stored anywhere else,
-- and this does not start storing them.

create table if not exists public.storyboard_events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  project_id  uuid not null references public.projects (id) on delete cascade,
  book        int  not null default 0,
  -- Sparse and numeric for the same reason as treatments.position: a drag writes one row.
  "position"  numeric not null default 1000,
  title       text not null default '',
  summary     text not null default '',
  chapter_id  uuid references public.chapters (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.storyboard_threads (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  project_id  uuid not null references public.projects (id) on delete cascade,
  book        int  not null default 0,
  name        text not null default '',
  -- A hex swatch. Unconstrained: the palette is the client's business.
  color       text not null default '#c69a3a',
  -- Order of the lanes on screen, left to right.
  "position"  numeric not null default 1000,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Which events a thread passes through. Many-to-many: an event can carry several threads,
-- which is exactly where they cross. The thread's own order is the events' order -- there is
-- no second ordering to keep in step.
--
-- Its own `id` rather than a composite key so backup/restore can upsert it on `id` like every
-- other table.
create table if not exists public.storyboard_links (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  project_id  uuid not null references public.projects (id) on delete cascade,
  thread_id   uuid not null references public.storyboard_threads (id) on delete cascade,
  event_id    uuid not null references public.storyboard_events (id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (thread_id, event_id)
);

create index if not exists storyboard_events_book_idx on public.storyboard_events (project_id, book, "position");
create index if not exists storyboard_threads_book_idx on public.storyboard_threads (project_id, book, "position");
create index if not exists storyboard_links_project_idx on public.storyboard_links (project_id);

alter table public.storyboard_events  enable row level security;
alter table public.storyboard_threads enable row level security;
alter table public.storyboard_links   enable row level security;

drop policy if exists "own storyboard events" on public.storyboard_events;
create policy "own storyboard events" on public.storyboard_events
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own storyboard threads" on public.storyboard_threads;
create policy "own storyboard threads" on public.storyboard_threads
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own storyboard links" on public.storyboard_links;
create policy "own storyboard links" on public.storyboard_links
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

comment on table public.storyboard_events is
  'One beat in a book''s plot, ordered within the book by position. Optionally points at the '
  'chapter it became; never required to.';
comment on table public.storyboard_threads is
  'A subplot, arc or mystery declared for one book, strung through events by storyboard_links.';

-- ---------------------------------------------------------------------------------------
-- Search reaches the storyboard. Same pattern as every other searchable table: a generated
-- tsvector (no trigger to forget) and a GIN index, then search_everything() re-created with a
-- sixth branch. The function body is 20260830b's verbatim apart from that branch; its return
-- type is unchanged, so every existing caller is unaffected.

alter table public.storyboard_events
  add column if not exists search tsvector
  generated always as (to_tsvector('english', coalesce(title, '') || ' ' || coalesce(summary, ''))) stored;

create index if not exists storyboard_events_search_idx on public.storyboard_events using gin (search);

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

  -- Storyboard events (20260924). Opened on the storyboard at that event, which finds its own
  -- book -- so nothing but the id has to travel.
  union all
  select 'storyboard', e.id, null::uuid, nullif(trim(e.title), ''),
         ts_headline('english', coalesce(nullif(e.summary, ''), e.title), q.ts,
                     'MaxFragments=2,MinWords=8,MaxWords=22,StartSel=<mark>,StopSel=</mark>'),
         ts_rank(e.search, q.ts), e.updated_at, null::text
    from public.storyboard_events e, q
   where e.project_id = p_project_id and e.search @@ q.ts and exists (select 1 from owns)

  order by 6 desc, 7 desc nulls last   -- rank, then recency. Positions, per the note above.
  limit 200;
$fn$;

comment on function public.search_everything(uuid, text) is
  'Full-text search across pages, chapters, scenes, documents, treatment versions and '
  'storyboard events in one project the caller owns, ranked. `status` is non-null only for '
  'treatment versions and carries live/stale, which MUST be displayed.';
