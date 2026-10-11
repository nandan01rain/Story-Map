-- The storyboard wall: where each note is pinned, whose colour it wears, and the scene it
-- summarises. NOT APPLIED -- paste into the Supabase SQL editor once. Needs
-- 20260924_storyboard.sql (and treatments, 20260830b) to have run first.
--
-- 1. POSITION. The wall was a picture of the order; it is now a board the writer arranges by
--    hand (drag a note anywhere). x/y are board coordinates. NULL means "never moved", and the
--    client lays such notes out in book order -- so existing events need nothing done to them.
--    The book's ORDER is still `position`; where a note hangs and when it happens are separate.
--
-- 2. CAST. A small per-project list of prominent characters, each with a colour, so a note can
--    wear the colour of whose beat it is -- the sticky-note-per-character board. Its own table,
--    not the braid's graph_nodes: that graph is populated by extraction and may be empty, and
--    this is a choice of a handful of colours, made on the wall.
--
-- 3. SCENE. A note may summarise a scene sketch (`treatments`). Tapping the note opens the full
--    scene; when that sketch later becomes a chapter, the note's chapter_id follows it.
--    on delete set null throughout: losing a sketch or a character never loses the note.

alter table public.storyboard_events
  add column if not exists x numeric,
  add column if not exists y numeric,
  add column if not exists treatment_id uuid references public.treatments (id) on delete set null;

create table if not exists public.storyboard_cast (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  project_id  uuid not null references public.projects (id) on delete cascade,
  name        text not null default '',
  color       text not null default '#fbe7a1',
  "position"  numeric not null default 1000,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.storyboard_events
  add column if not exists cast_id uuid references public.storyboard_cast (id) on delete set null;

create index if not exists storyboard_cast_project_idx on public.storyboard_cast (project_id, "position");
create index if not exists storyboard_events_treatment_idx on public.storyboard_events (treatment_id);

alter table public.storyboard_cast enable row level security;

drop policy if exists "own storyboard cast" on public.storyboard_cast;
create policy "own storyboard cast" on public.storyboard_cast
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
