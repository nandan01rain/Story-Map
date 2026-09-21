-- Progressions: what a document says AS OF a point in the saga. NOT APPLIED -- written for
-- review, paste into the Supabase SQL editor once.
--
-- A character bible says who someone is. Across six books, who they are changes -- a title
-- gained, a limp from Book Two on, a lie they no longer believe. One document cannot hold
-- both "before" and "after" without the reader guessing which applies where. A progression
-- is one entry on a document, anchored to the chapter from which it holds: "from chapter X,
-- this is true." Read in reading order, a document plus its progressions is the entry as it
-- stands at any chapter.
--
-- Anchored to a CHAPTER, not a story time: the writer thinks "from the moment she takes the
-- throne", and that moment is a chapter. Chronology (story_time) is a different axis and is
-- deliberately not involved. on delete set null: a deleted chapter leaves the note, undated,
-- rather than taking the fact with it.
--
-- This is also the shape Novelcrafter's progressions take, and the shape mention-detection
-- would consume when the assistants wake: for a scene at chapter N, the document's base text
-- plus every progression anchored at or before N. Nothing here depends on that happening.

create table if not exists public.document_progressions (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  project_id       uuid not null references public.projects (id) on delete cascade,
  document_id      uuid not null references public.documents (id) on delete cascade,
  from_chapter_id  uuid references public.chapters (id) on delete set null,
  note             text not null default '',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists document_progressions_document_idx
  on public.document_progressions (document_id);

alter table public.document_progressions enable row level security;

drop policy if exists "own document progressions" on public.document_progressions;
create policy "own document progressions" on public.document_progressions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
