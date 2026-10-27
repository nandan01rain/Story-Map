-- The writing journal (2026-10-27). Safe to re-run. Paste into the Supabase SQL editor once.
--
-- ONE JOURNAL PER WRITER, NOT PER PROJECT. The journal is the writer's own notebook, open from the
-- landing page and from inside any project, and the same in all of them. Nothing in it belongs to
-- a project; what is needed in one is COPIED there (to that project's Pages), and the journal page
-- stays as it was. So a page carries no project_id, and setting a page aside is a column here
-- rather than a trip to the trash, which is filed per project.
--
-- A journal page is a free canvas: a date, a paper, and a list of ITEMS placed on it -- text
-- in the writer's hand, washi tape, stamps, stickers, pictures and cutouts of the project's own
-- material. Items are one jsonb array on the page rather than rows of their own: a page is
-- edited as a whole (drag, rotate, layer), saved as a whole, and never queried item by item, so
-- a table of items would buy joins and lose nothing. Coordinates are in page units -- a page is
-- 600 x 840 -- so the phone (one page, scaled to its width) and the web (a two-page spread) draw
-- the same page the same way.
--
-- Item shape (both apps draw it with the one renderer, journal/journal-kit.js; the phone inlines
-- that file into its WebView, so there is no second copy to keep in sync):
--   { id, kind, x, y, w, h, r (degrees), z, ...props }
--   text    { text, font: hand|print|serif|type|stamp, size, color, align }
--   tape    { pattern: solid|grid|stripe|dots|check, color }
--   stamp   { text, color, shape: box|circle|letters|date }
--   sticker { name }                                   -- one of the kit's drawn stickers
--   image   { path, bucket: journal-images|character-images, edge: torn|deckle|straight }
--   cutout  { source: note|scene|document|character, ref, title, text, paper }
--   A page with scan_path set is drawn as that picture, edge to edge, under its items.
--     A cutout keeps a COPY of what it shows, so a page written today still reads the same when
--     the scene it quotes is rewritten next month -- a journal records what was true that day.

create table if not exists public.journal_pages (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  day         date not null default current_date,
  title       text not null default '',
  paper       text not null default 'lined',
  -- A SCANNED page: the photograph of the writer's own notebook page, straightened and cropped
  -- and otherwise exactly as written -- mirrored lines stay mirrored, nothing is transcribed in
  -- its place. Items can still be laid on top. Null for a page made in the app.
  scan_path   text,
  items       jsonb not null default '[]'::jsonb,
  -- Order within the notebook; pages are ordered by day, then by this.
  "position"  numeric not null default 1000,
  -- Set aside rather than deleted: out of the notebook, on a shelf of its own, and back with a tap.
  set_aside_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists journal_pages_user_idx on public.journal_pages (user_id, day, "position");

alter table public.journal_pages enable row level security;

drop policy if exists "own journal pages" on public.journal_pages;
create policy "own journal pages" on public.journal_pages
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- The writer's own pictures for the journal: scans, photographs, stickers. Private, like the
-- character pictures, and by the same rule: the first folder of a path is the owner's id.
insert into storage.buckets (id, name, public)
values ('journal-images', 'journal-images', false)
on conflict (id) do nothing;

drop policy if exists "own journal images" on storage.objects;
create policy "own journal images" on storage.objects
  for all to authenticated
  using (bucket_id = 'journal-images' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'journal-images' and (storage.foldername(name))[1] = auth.uid()::text);

-- Not the journal's, but carried here so one paste does both: the trash's accepted types, restated
-- in full (this supersedes 20261011_trash_types.sql, which lets the trash hold storyboard notes).
alter table public.trash drop constraint if exists trash_type_check;
alter table public.trash
  add constraint trash_type_check
  check (type in ('chapter', 'scene', 'document', 'storyboard_event', 'graph_node', 'graph_edge'))
  not valid;

-- (For a database that ran an earlier copy of this file, when pages belonged to a project.)
alter table public.journal_pages add column if not exists scan_path text;
alter table public.journal_pages add column if not exists set_aside_at timestamptz;
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'journal_pages' and column_name = 'project_id') then
    alter table public.journal_pages alter column project_id drop not null;
  end if;
end $$;
drop index if exists public.journal_pages_project_idx;
