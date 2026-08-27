-- Pages: stage-one raw capture. NOT APPLIED -- written for review.
--
-- This extends sticky_notes rather than creating a table. sticky_notes is already
-- project-scoped and already holds exactly the thing being generalised: text the writer
-- deposited without deciding what it was. A page IS a sticky note that got long. Nothing
-- here renames the table, because renaming it would break two shipped apps for no gain.
--
-- Two facts about the live table this file has to cope with, neither of which the anon key
-- can read (see the report accompanying this migration):
--
--   * content's declared type. Column probes confirm content exists and is a string type,
--     not jsonb -- but text vs varchar(n) is invisible over PostgREST. A drafted scene runs
--     thousands of words, so a length cap would silently truncate the single most valuable
--     thing this build exists to protect. Rather than ask, statement 1 below settles it:
--     text -> text is a no-op, varchar(n) -> text is binary-coercible and rewrites nothing.
--     Running it is cheaper than knowing.
--
--   * whether user_id is still NOT NULL after the multi-project migration. This file does
--     NOT relax it. Every insert path in both apps already sets user_id from the session,
--     and the pages surface does the same, so the constraint cannot be reached whichever
--     way it is declared. Dropping a NOT NULL on a live ownership column to sidestep a
--     question that never fires is the wrong trade.
--
-- Nothing here deletes, consumes or moves a row. Promotion copies; status is a marker.

-- 1. Long-form text, unconditionally. See the note above.
alter table public.sticky_notes
  alter column content type text;

alter table public.sticky_notes
  alter column content set default '';

-- 2. The page columns. All nullable or defaulted, so every existing sticky note is already
--    a valid page the moment this runs -- untyped, raw, never promoted.
alter table public.sticky_notes
  add column if not exists type        text,
  add column if not exists status      text not null default 'raw',
  add column if not exists updated_at  timestamptz not null default now(),
  add column if not exists versions    jsonb not null default '[]'::jsonb,
  add column if not exists became_type text,
  add column if not exists became_id   uuid,
  add column if not exists became_at   timestamptz;

comment on column public.sticky_notes.type is
  'prose | note | reference | canon | filler, or null. Null is the EXPECTED case, not a '
  'defect: nothing may block on it and the writer is never prompted for it. It is applied '
  'after the fact if at all, and acts as an override on later inference rather than as an '
  'input, so typed and untyped pages follow the same code path. Deliberately unconstrained '
  '-- a CHECK here would turn a hint into a gate the first time a sixth word is wanted.';

comment on column public.sticky_notes.status is
  'raw | reviewed. A marker, never a location. Hiding reviewed pages from the default list '
  'is a filter; the row is untouched and still returned by search.';

comment on column public.sticky_notes.versions is
  'Prior text, newest first: [{"savedAt": timestamptz, "content": text}]. Same shape as '
  'chapters.versions. Losing an earlier draft is the same failure as losing a page, so the '
  'editor pushes here before it overwrites content. Text is cheap.';

comment on column public.sticky_notes.became_type is
  'What this page was promoted into (chapter | scene | document), or null. The page itself '
  'is never deleted or consumed by promotion -- it is copied, and this records where to.';

-- 3. Search. The pile is only safe to deposit into if a page can be found in three seconds;
--    without this the notebook is a landfill. Four tables, one query, one ranking.
--
--    Generated rather than trigger-maintained: to_tsvector with a literal regconfig is
--    immutable, so Postgres keeps these correct with no application code to forget to call.
alter table public.sticky_notes add column if not exists search tsvector
  generated always as (to_tsvector('english', coalesce(content, ''))) stored;

alter table public.chapters add column if not exists search tsvector
  generated always as (
    to_tsvector('english', coalesce(title, '') || ' ' || coalesce(content, '') || ' ' || coalesce(notes, ''))
  ) stored;

alter table public.scenes add column if not exists search tsvector
  generated always as (
    to_tsvector('english', coalesce(title, '') || ' ' || coalesce(summary, '') || ' ' || coalesce(notes, ''))
  ) stored;

alter table public.documents add column if not exists search tsvector
  generated always as (
    to_tsvector('english', coalesce(title, '') || ' ' || coalesce(content, ''))
  ) stored;

create index if not exists sticky_notes_search_idx on public.sticky_notes using gin (search);
create index if not exists chapters_search_idx     on public.chapters     using gin (search);
create index if not exists scenes_search_idx       on public.scenes       using gin (search);
create index if not exists documents_search_idx    on public.documents    using gin (search);

-- Pages are read newest-first and filtered by project on every open.
create index if not exists sticky_notes_project_created_idx
  on public.sticky_notes (project_id, created_at desc);

-- 4. One search across all four. security invoker on purpose: RLS applies as the caller, so
--    this function can see exactly what the caller could have selected by hand. It is a
--    convenience, not a privilege.
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
  with q as (select websearch_to_tsquery('english', p_query) as ts)
  select 'page'::text, n.id, null::uuid,
         -- A page has no title field. Its first non-empty line is its de facto title, here
         -- and in the list, so search and the stack agree about what a page is called.
         nullif(trim(split_part(regexp_replace(coalesce(n.content, ''), '^\s+', ''), E'\n', 1)), ''),
         ts_headline('english', coalesce(n.content, ''), q.ts,
                     'MaxFragments=2,MinWords=8,MaxWords=22,StartSel=<mark>,StopSel=</mark>'),
         ts_rank(n.search, q.ts),
         coalesce(n.updated_at, n.created_at)
    from public.sticky_notes n, q
   where n.project_id = p_project_id and n.search @@ q.ts

  union all
  select 'chapter', c.id, null::uuid, c.title,
         ts_headline('english', coalesce(c.content, ''), q.ts,
                     'MaxFragments=2,MinWords=8,MaxWords=22,StartSel=<mark>,StopSel=</mark>'),
         ts_rank(c.search, q.ts), c.updated_at
    from public.chapters c, q
   where c.project_id = p_project_id and c.search @@ q.ts

  union all
  select 'scene', s.id, s.chapter_id, s.title,
         ts_headline('english', coalesce(s.summary, ''), q.ts,
                     'MaxFragments=2,MinWords=8,MaxWords=22,StartSel=<mark>,StopSel=</mark>'),
         ts_rank(s.search, q.ts), s.updated_at
    from public.scenes s, q
   where s.project_id = p_project_id and s.search @@ q.ts

  union all
  select 'document', d.id, null::uuid, d.title,
         ts_headline('english', coalesce(d.content, ''), q.ts,
                     'MaxFragments=2,MinWords=8,MaxWords=22,StartSel=<mark>,StopSel=</mark>'),
         ts_rank(d.search, q.ts), d.updated_at
    from public.documents d, q
   where d.project_id = p_project_id and d.search @@ q.ts

  order by rank desc, at desc nulls last
  limit 200;
$fn$;

comment on function public.search_everything(uuid, text) is
  'Full-text search across pages, chapters, scenes and documents in one project, ranked. '
  'websearch_to_tsquery so the writer can type the way he types into a search box -- bare '
  'words, "quoted phrases", or -excluded -- and get [] rather than an exception when the '
  'query is nonsense, which is what a search box wants.';

-- 5. RLS. The handoff doc lists sticky_notes policies as UNVERIFIED -- no policy definition
--    for it exists anywhere in this repo, and the anon key cannot read pg_policy. Anon
--    selects do come back empty rather than erroring, which is consistent with RLS being on
--    and correct, and equally consistent with a table anon was simply never granted.
--
--    So this block only reports. Enabling RLS here would be the one statement in this file
--    that changes who can read existing rows, and that is not a thing to do blind inside a
--    migration about note-taking.
do $$
begin
  if not exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relname = 'sticky_notes' and c.relrowsecurity
  ) then
    raise notice 'sticky_notes has RLS DISABLED -- not enabling it here. Verify and enable by hand.';
  else
    raise notice 'sticky_notes has RLS enabled. New columns inherit the existing policies.';
  end if;
end $$;
