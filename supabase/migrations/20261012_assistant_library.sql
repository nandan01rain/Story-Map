-- The assistants' library and proposal queue (2026-10-12). Safe to re-run.
--
-- Run AFTER 20260821_assistant_retrieval.sql (which creates content_chunks) -- this file
-- widens it. Paste into the Supabase SQL editor once, when the assistants are switched on.
--
-- 1. THE LIBRARY. content_chunks held chapters and documents only, so the assistants could
--    not find a drafted scene, a page, a storyboard note or a character. Every kind of thing
--    the writer keeps is now indexable. The kinds are the same words the app uses.
--
-- 2. THE PROPOSAL QUEUE. The assistants WRITE NOTHING. Every change they want -- an edit to a
--    document, a chapter or a scene; a new scene from a page; a storyboard note; a scene linked
--    to its chapter; a character's fields -- arrives here as a proposal, and the app applies it
--    only when the writer accepts, re-checking it against the text as it is by then. A
--    proposal is never deleted: accepted, rejected or gone stale, it stays as the record of
--    what was suggested and what the text was before.

alter table public.content_chunks drop constraint if exists content_chunks_source_type_check;
alter table public.content_chunks
  add constraint content_chunks_source_type_check
  check (source_type in ('chapter', 'document', 'scene', 'page', 'storyboard', 'character'));

create table if not exists public.assistant_proposals (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  project_id  uuid not null references public.projects (id) on delete cascade,
  agent       text not null check (agent in ('icarus', 'daedalus')),
  kind        text not null check (kind in (
                'edit_text',          -- find/replace in a document, chapter or scene
                'new_scene',          -- a scene (template text), optionally from a page
                'storyboard_note',    -- a note on a book's storyboard
                'link_scene_chapter', -- a scene became this chapter
                'character_fields'    -- a character's line and infobox values
              )),
  target_type text,
  target_id   uuid,
  summary     text not null default '',
  rationale   text not null default '',
  -- What to do, and (once applied) what it replaced.
  payload     jsonb not null default '{}'::jsonb,
  status      text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'stale')),
  created_at  timestamptz not null default now(),
  decided_at  timestamptz
);

create index if not exists assistant_proposals_queue_idx
  on public.assistant_proposals (project_id, status, created_at desc);

alter table public.assistant_proposals enable row level security;

drop policy if exists "own proposals" on public.assistant_proposals;
create policy "own proposals" on public.assistant_proposals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
