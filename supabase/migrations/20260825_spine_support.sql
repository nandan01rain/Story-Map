-- Spine support. NOT APPLIED — written for review.
--
-- Three things, none of them destructive and none of them changing existing behaviour:
--
--   1. project_settings.complexity — the visibility preset. project_settings is the right
--      home (project_id PK, no user_id, RLS joining projects.user_id); the graph payload
--      was the wrong one.
--
--   2. character_graph() returns each scene's requires / provides / deferredRequires. The
--      function is otherwise byte-for-byte 20260824_graph_pairs.sql: this file was produced
--      by patching that body in two places, not by retyping it. Without these the health
--      store below is useless from the graph, because a deferral it cannot see is a
--      deferral it will light up anyway.
--
--   3. health_marks — one store, two values. A defer and a dismissal are NOT the same act:
--      "not due yet" is time-bounded and expected to return, "deliberate" is permanent.
--      One table keyed by subject with a kind, so there is one list to maintain rather than
--      two that drift.
--
-- Deliberately NOT here: any home for a pair grouping. A grouping is not a row and so
-- cannot carry a mark, which is the same absence that makes subplots-as-groupings shaky at
-- the concurrency the demo pack shows. That is held pending the real-data statistics and
-- decided as one question, not patched around here.

alter table public.project_settings
  add column if not exists complexity text;

alter table public.chapters add column if not exists story_time numeric;
alter table public.scenes   add column if not exists story_time numeric;

comment on column public.chapters.story_time is
  'When this chapter happens on the story''s own timeline, in the writer''s own units. '
  'Null means "wherever the previous marked chapter put us" -- sparse by design.';
comment on column public.scenes.story_time is
  'As chapters.story_time, for a chapter that spans more than one moment.';

comment on column public.project_settings.complexity is
  'Visibility preset for the saga spine: standard | full. Null means standard.';

create table if not exists public.health_marks (
  project_id  uuid not null references public.projects(id) on delete cascade,
  subject     text not null,
  subject_kind text not null check (subject_kind in ('annotation', 'scene_requirement')),
  kind        text not null check (kind in ('deferred', 'deliberate')),
  note        text,
  created_at  timestamptz not null default now(),
  primary key (project_id, subject, kind)
);

comment on table public.health_marks is
  'Structural-signal marks. kind=deferred is "not due yet" and is expected to return; '
  'kind=deliberate is permanent. subject_kind has no grouping member on purpose.';

alter table public.health_marks enable row level security;

-- Same shape as every other per-project policy here: no user_id of its own, joined through
-- projects.user_id.
drop policy if exists health_marks_owner on public.health_marks;
create policy health_marks_owner on public.health_marks
  for all
  using (exists (select 1 from public.projects p
                 where p.id = health_marks.project_id and p.user_id = auth.uid()))
  with check (exists (select 1 from public.projects p
                      where p.id = health_marks.project_id and p.user_id = auth.uid()));

create index if not exists health_marks_project_idx on public.health_marks(project_id);

create or replace function public.character_graph(p_project_id uuid)
returns jsonb
language sql
stable
as $$
  with character_nodes as (
    select
      n.id, n.label, n.node_type, n.properties, n.source, n.needs_review,
      (select count(*) from public.graph_edges e
        where e.edge_type = 'INTERACTS_WITH' and (e.from_node_id = n.id or e.to_node_id = n.id)
      ) as degree
    from public.graph_nodes n
    where n.project_id = p_project_id
      and n.node_type in ('character', 'faction', 'location')
  ),
  event_nodes as (
    select
      n.id, n.label, n.properties, n.needs_review,
      count(distinct e.from_node_id) as participants
    from public.graph_nodes n
    join public.graph_edges e
      on e.event_id = n.id and e.edge_type = 'PRESENT_AT'
    where n.project_id = p_project_id and n.node_type = 'event'
    group by n.id, n.label, n.properties, n.needs_review
  ),
  -- Every chapter, populated or not. The event id is carried here rather than looked up
  -- again per flag, which is what the previous version did once for every annotation.
  chapter_rows as (
    select
      c.id, c.title, c.book, c.act, c."order" as seq, c.status, c.story_time,
      length(coalesce(c.content, '')) as content_length,
      (
        select ev.id from public.graph_nodes ev
        where ev.project_id = p_project_id
          and ev.node_type = 'event'
          and ev.properties ->> 'chapter_id' = c.id::text
        limit 1
      ) as event_id
    from public.chapters c
    where c.project_id = p_project_id
  ),
  scene_rows as (
    select s.id, s.chapter_id, s."order" as seq, s.title, s.summary, s.pov, s.status,
           s.story_time, s.requires, s.provides, s.deferred_requires
    from public.scenes s
    where s.project_id = p_project_id
  ),
  -- Plants, reveals AND notes now. A note is not one end of a pair and never has a pairId,
  -- but it is a flag on a line of prose in exactly the same way, and it was the one kind of
  -- annotation with nowhere to appear.
  flag_rows as (
    select
      coalesce(nullif(a ->> 'id', ''), c.id::text || ':' || idx::text) as id,
      a ->> 'type' as flag_type,
      a ->> 'text' as text,
      -- An annotation re-locates itself by searching the prose for its own flagged
      -- substring, so one with no text cannot be positioned. It used to be dropped here by
      -- a WHERE clause, silently: the writer saw a note in the editor and nothing in the
      -- graph, with nothing anywhere saying why. It now comes back MARKED. The filter was
      -- never the problem; the silence was.
      (coalesce(a ->> 'text', '') = '') as unanchorable,
      coalesce(a ->> 'label', '') as label,
      -- Many-to-many. Legacy single-pair annotations are promoted to a one-element array
      -- here rather than anywhere else, so the client only ever sees the new shape.
      case
        when jsonb_typeof(a -> 'pairs') = 'array' then a -> 'pairs'
        when nullif(a ->> 'pairId', '') is not null
          then jsonb_build_array(jsonb_build_object(
            'id', a ->> 'pairId',
            'label', coalesce(nullif(a ->> 'pairLabel', ''), '')
          ))
        else '[]'::jsonb
      end as pairs,
      -- The mythic thread's name, e.g. "Sita-Zia". Only ever set on a note.
      nullif(a ->> 'thread', '') as thread,
      -- Which character's arc the parallel belongs to. A graph_nodes id, kept as text
      -- because an annotation is jsonb and has no foreign key to enforce it -- the renderer
      -- resolves it and silently ignores an id that no longer exists.
      nullif(a ->> 'characterId', '') as character_id,
      -- Optional. Nothing writes it yet, but a note about one scene rather than a whole
      -- chapter is the obvious next thing to want, and reading it now costs nothing.
      nullif(a ->> 'sceneId', '') as scene_id,
      c.id as chapter_id,
      c.title as chapter_title,
      c.seq,
      c.event_id
    from chapter_rows c
    join public.chapters raw on raw.id = c.id
    cross join lateral jsonb_array_elements(
      case jsonb_typeof(raw.annotations::jsonb)
        when 'array' then raw.annotations::jsonb
        else '[]'::jsonb
      end
    ) with ordinality as t(a, idx)
    where a ->> 'type' in ('plant', 'reveal', 'note')
  )
  select jsonb_build_object(
    'nodes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id, 'label', c.label, 'type', c.node_type, 'properties', c.properties,
        'source', c.source, 'needsReview', c.needs_review, 'degree', c.degree
      )) from character_nodes c
    ), '[]'::jsonb),
    'events', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', ev.id, 'label', ev.label, 'type', 'event', 'properties', ev.properties,
        'needsReview', ev.needs_review, 'participants', ev.participants,
        'seq', coalesce((ev.properties ->> 'order')::int, (ev.properties ->> 'act')::int, 0)
      ) order by coalesce((ev.properties ->> 'order')::int, 0)) from event_nodes ev
    ), '[]'::jsonb),
    'links', coalesce((
      select jsonb_agg(jsonb_build_object(
        'source', p.node_a, 'target', p.node_b, 'count', p.interaction_count,
        'type', p.dominant_type, 'valence', p.dominant_valence,
        'eventIds', p.event_ids, 'needsReview', p.needs_review
      )) from public.character_pair_edges p where p.project_id = p_project_id
    ), '[]'::jsonb),
    'interactions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', e.id,
        'from', e.from_node_id,
        'to', e.to_node_id,
        'type', e.properties ->> 'interaction_type',
        'valence', e.properties ->> 'valence',
        'description', e.properties ->> 'description',
        'eventId', e.event_id,
        'eventLabel', ev.label,
        'seq', coalesce((ev.properties ->> 'order')::int, -1),
        'needsReview', e.needs_review
      ) order by coalesce((ev.properties ->> 'order')::int, -1))
      from public.graph_edges e
      left join public.graph_nodes ev on ev.id = e.event_id and ev.node_type = 'event'
      where e.project_id = p_project_id and e.edge_type = 'INTERACTS_WITH'
    ), '[]'::jsonb),
    'presence', coalesce((
      select jsonb_agg(jsonb_build_object(
        'character', e.from_node_id,
        'event', e.event_id,
        'isPov', (ev.properties ->> 'pov_character_id') = e.from_node_id::text
      ))
      from public.graph_edges e
      join event_nodes ev on ev.id = e.event_id
      where e.project_id = p_project_id and e.edge_type = 'PRESENT_AT'
    ), '[]'::jsonb),
    'chapters', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id, 'title', c.title, 'book', c.book, 'act', c.act, 'seq', c.seq,
        'status', c.status, 'words', c.content_length, 'eventId', c.event_id,
        'storyTime', c.story_time
      ) order by c.book, c.seq) from chapter_rows c
    ), '[]'::jsonb),
    'scenes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id, 'chapterId', s.chapter_id, 'seq', s.seq, 'title', s.title,
        'summary', s.summary, 'pov', s.pov, 'status', s.status,
        'storyTime', s.story_time,
        'requires', coalesce(s.requires, '[]'::jsonb),
        'provides', coalesce(s.provides, '[]'::jsonb),
        'deferredRequires', coalesce(s.deferred_requires, '[]'::jsonb)
      ) order by s.chapter_id, s.seq) from scene_rows s
    ), '[]'::jsonb),
    'flags', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', f.id,
        'type', f.flag_type,
        'text', f.text,
        'unanchorable', f.unanchorable,
        'label', f.label,
        'pairs', f.pairs,
        'thread', f.thread,
        'characterId', f.character_id,
        'chapterId', f.chapter_id,
        'chapterTitle', f.chapter_title,
        'sceneId', f.scene_id,
        'eventId', f.event_id,
        'seq', f.seq
      ) order by f.seq, f.flag_type desc, f.id)
      from flag_rows f
    ), '[]'::jsonb)
  );
$$;
