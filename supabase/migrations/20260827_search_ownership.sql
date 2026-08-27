-- search_everything(): make the function safe on its own terms. NOT APPLIED -- for review.
--
-- BELT-AND-BRACES, NOT A FIX. Read that first, so this file is not mistaken for a patch to a
-- live hole. There was no hole.
--
-- The concern that produced it was real, though. search_everything() takes a project id from
-- the caller and is security invoker, so the only thing stopping someone passing a project id
-- that is not theirs is whatever RLS the four underlying tables happen to have -- and when the
-- function shipped, none of chapters, scenes or documents had ever been read. If any had been
-- missing RLS, the function would have been a way to read another account's prose by guessing
-- a uuid: a narrower door than a bare select, but a door, and one 20260826_pages.sql opened.
--
-- They were then read. All five of chapters, scenes, documents, projects and sticky_notes have
-- RLS enabled with one policy each, so the exposure never existed. Handoff §4 and §23.3.
--
-- What IS true, and is the more useful finding: sticky_notes' policy is `auth.uid() = user_id`
-- for ALL, on both qual and with_check -- user-scoped, NOT project-scoped. Project separation
-- across this whole app is a client-side .eq('project_id', ...) convention with no database
-- boundary behind it. Harmless at one writer and one account. It is the assumption to revisit
-- before anything is ever shared.
--
-- So this file is still worth running: one ownership test, evaluated once, gating all four
-- branches. It makes the function correct BY CONSTRUCTION rather than correct given four policy
-- definitions nobody has read and nobody will remember to re-check. A search function should
-- not be the most privileged path into the data, and after this it is the least.
--
-- Everything else about the function is byte-for-byte 20260826_pages.sql. This file was made
-- by adding the `owns` CTE and one `where exists` per branch, not by retyping the body.

create or replace function public.search_everything(p_project_id uuid, p_query text)
returns table (
  kind       text,
  id         uuid,
  parent_id  uuid,
  title      text,
  snippet    text,
  rank       real,
  at         timestamptz
)
language sql
stable
security invoker
set search_path = public
as $fn$
  with q as (select websearch_to_tsquery('english', p_query) as ts),
  -- Not a join: a join would have to be repeated correctly in four places and would silently
  -- stop protecting anything the first time a fifth branch was added without it. One CTE that
  -- is empty when the project is not yours, and every branch is gated on it being non-empty.
  owns as (
    select 1 from public.projects p
     where p.id = p_project_id and p.user_id = auth.uid()
  )
  -- The first branch's aliases name the whole union's output columns, and the ORDER BY at the
  -- bottom can see nothing else -- not the RETURNS TABLE names, which do not reach that far.
  -- Hence the aliases here and the ordinal positions there.
  select 'page'::text as kind, n.id as id, null::uuid as parent_id,
         -- A page has no title field. Its first non-empty line is its de facto title, here
         -- and in the list, so search and the stack agree about what a page is called.
         nullif(trim(split_part(regexp_replace(coalesce(n.content, ''), '^\s+', ''), E'\n', 1)), '') as title,
         ts_headline('english', coalesce(n.content, ''), q.ts,
                     'MaxFragments=2,MinWords=8,MaxWords=22,StartSel=<mark>,StopSel=</mark>') as snippet,
         ts_rank(n.search, q.ts) as rank,
         coalesce(n.updated_at, n.created_at) as at
    from public.sticky_notes n, q
   where n.project_id = p_project_id and n.search @@ q.ts and exists (select 1 from owns)

  union all
  select 'chapter', c.id, null::uuid, c.title,
         ts_headline('english', coalesce(c.content, ''), q.ts,
                     'MaxFragments=2,MinWords=8,MaxWords=22,StartSel=<mark>,StopSel=</mark>'),
         ts_rank(c.search, q.ts), c.updated_at
    from public.chapters c, q
   where c.project_id = p_project_id and c.search @@ q.ts and exists (select 1 from owns)

  union all
  select 'scene', s.id, s.chapter_id, s.title,
         ts_headline('english', coalesce(s.summary, ''), q.ts,
                     'MaxFragments=2,MinWords=8,MaxWords=22,StartSel=<mark>,StopSel=</mark>'),
         ts_rank(s.search, q.ts), s.updated_at
    from public.scenes s, q
   where s.project_id = p_project_id and s.search @@ q.ts and exists (select 1 from owns)

  union all
  select 'document', d.id, null::uuid, d.title,
         ts_headline('english', coalesce(d.content, ''), q.ts,
                     'MaxFragments=2,MinWords=8,MaxWords=22,StartSel=<mark>,StopSel=</mark>'),
         ts_rank(d.search, q.ts), d.updated_at
    from public.documents d, q
   where d.project_id = p_project_id and d.search @@ q.ts and exists (select 1 from owns)

  order by 6 desc, 7 desc nulls last   -- rank, then recency. Positions, per the note above.
  limit 200;
$fn$;

comment on function public.search_everything(uuid, text) is
  'Full-text search across pages, chapters, scenes and documents in ONE project the caller '
  'owns, ranked. Ownership is checked in the function rather than left to the four tables'' '
  'RLS, so it holds regardless of how those are configured. websearch_to_tsquery so the '
  'writer can type the way he types into a search box -- bare words, "quoted phrases", or '
  '-excluded -- and get [] rather than an exception when the query is nonsense.';
