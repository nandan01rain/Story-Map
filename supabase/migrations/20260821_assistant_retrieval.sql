-- Retrieval layer for the in-app assistants (Icarus and Daedalus).
--
-- Run this once, in the Supabase dashboard's SQL Editor, against the StoryMap project.
-- It is written to be safe to re-run: every statement is guarded.
--
-- Why a separate table rather than columns on `chapters`/`documents`: one chapter becomes
-- many chunks, so it is a one-to-many relationship, and a chunk has to be able to point
-- back at whichever kind of source it came from.

create extension if not exists vector;

-- 1024 dimensions matches Voyage's voyage-3 family, which is the embedding provider this
-- is built against -- Anthropic has no embeddings API, so retrieval needs a second vendor.
-- The dimension is baked into the column type, so switching providers later means a new
-- column and a re-index, not an in-place change. That is the main reason to decide the
-- provider now rather than later.
create table if not exists public.content_chunks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,

  -- Which row this chunk came from. Deliberately not a foreign key: chapters and documents
  -- are different tables, and a chunk has to reference either. Deletions are handled by
  -- re-indexing the source, not by the database.
  source_type text not null check (source_type in ('chapter', 'document')),
  source_id uuid not null,
  source_title text not null default '',

  chunk_index int not null,
  content text not null,

  -- Hash of the chunk's own text. Re-indexing a chapter after a small edit should only pay
  -- to embed the chunks that actually changed, and this is what makes that comparison
  -- cheap.
  content_hash text not null,

  embedding vector(1024),
  updated_at timestamptz not null default now(),

  unique (source_type, source_id, chunk_index)
);

create index if not exists content_chunks_project_idx
  on public.content_chunks (project_id, source_type);

create index if not exists content_chunks_source_idx
  on public.content_chunks (source_type, source_id);

-- HNSW rather than IVFFlat: IVFFlat needs to be built against existing data to pick its
-- lists, and it degrades badly when the table is empty at creation time -- which it is,
-- here. HNSW builds incrementally and needs no training pass.
create index if not exists content_chunks_embedding_idx
  on public.content_chunks
  using hnsw (embedding vector_cosine_ops);

alter table public.content_chunks enable row level security;

drop policy if exists "own chunks" on public.content_chunks;
create policy "own chunks" on public.content_chunks
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Similarity search, called from the Edge Function.
--
-- SECURITY INVOKER (the default) on purpose: it runs as the calling user, so the RLS policy
-- above still applies and one account can never retrieve another's prose, even if the
-- project id were wrong or forged. A SECURITY DEFINER function here would bypass exactly
-- the protection that matters most for this table.
create or replace function public.match_content_chunks(
  p_project_id uuid,
  p_query_embedding vector(1024),
  p_match_count int default 15,
  p_source_type text default null
)
returns table (
  id uuid,
  source_type text,
  source_id uuid,
  source_title text,
  chunk_index int,
  content text,
  similarity float
)
language sql
stable
as $$
  select
    c.id,
    c.source_type,
    c.source_id,
    c.source_title,
    c.chunk_index,
    c.content,
    -- pgvector's <=> is cosine DISTANCE (0 = identical). Similarity is the complement,
    -- which is what reads naturally at the call site.
    1 - (c.embedding <=> p_query_embedding) as similarity
  from public.content_chunks c
  where c.project_id = p_project_id
    and c.embedding is not null
    and (p_source_type is null or c.source_type = p_source_type)
  order by c.embedding <=> p_query_embedding
  limit greatest(1, least(p_match_count, 50));
$$;

-- Lets the app show "indexed 412 of 480 chunks" and decide whether a first-time index is
-- still needed, without pulling every row down to count them.
create or replace function public.content_chunk_status(p_project_id uuid)
returns table (total bigint, embedded bigint)
language sql
stable
as $$
  select
    count(*) as total,
    count(embedding) as embedded
  from public.content_chunks
  where project_id = p_project_id;
$$;
