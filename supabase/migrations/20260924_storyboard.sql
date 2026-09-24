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
