-- Characters: the storyboard's cast becomes the project's character list. NOT APPLIED --
-- paste into the Supabase SQL editor once. Needs 20261011b_storyboard_wall.sql first.
--
-- `storyboard_cast` keeps its name (renaming a table every client reads is a breakage for no
-- gain) but is now the project's CHARACTERS: each gains a short description (the flashcard), a
-- picture, and the character bible it is written up in. Notes gain the list of characters
-- involved in their scene -- separate from cast_id, which stays "whose colour the note wears".

alter table public.storyboard_cast
  add column if not exists description text not null default '',
  add column if not exists image_path  text,
  add column if not exists document_id uuid references public.documents (id) on delete set null,
  -- The character page's infobox values, keyed by character_fields.id: { "<field id>": "value" }.
  add column if not exists fields      jsonb not null default '{}';

-- The infobox's rows, defined once per PROJECT and shown on every character -- "Full name",
-- "Alias", "Age", whatever the saga needs. Adding one adds it everywhere; each character fills in
-- its own value. Order is `position`. Removing a field leaves stale keys in `fields`, which the
-- app ignores.
create table if not exists public.character_fields (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  project_id  uuid not null references public.projects (id) on delete cascade,
  name        text not null default '',
  "position"  numeric not null default 1000,
  created_at  timestamptz not null default now()
);

create index if not exists character_fields_project_idx on public.character_fields (project_id, "position");

alter table public.character_fields enable row level security;

drop policy if exists "own character fields" on public.character_fields;
create policy "own character fields" on public.character_fields
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.storyboard_events
  add column if not exists character_ids uuid[] not null default '{}';

-- Pictures. A PRIVATE bucket: these are the writer's own art for an unpublished book, so the app
-- shows them through short-lived signed links rather than public URLs. Each user writes only
-- under a folder named for their own id -- `<user id>/<character id>.<ext>`.
insert into storage.buckets (id, name, public)
values ('character-images', 'character-images', false)
on conflict (id) do nothing;

drop policy if exists "own character images" on storage.objects;
create policy "own character images" on storage.objects
  for all to authenticated
  using (bucket_id = 'character-images' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'character-images' and (storage.foldername(name))[1] = auth.uid()::text);
