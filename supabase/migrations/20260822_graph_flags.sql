-- Character web, fourth pass: plants and reveals become part of the graph.
--
-- Run in the SQL Editor like the others. Safe to re-run. No schema change — this is a
-- function replacement only, which is the point of the approach below.
--
-- Plants and reveals are NOT stored in graph_nodes. They live where they already live: in
-- `chapters.annotations`, the same jsonb array the editor writes when a writer selects a
-- line and flags it. Copying them into the graph would create a second source of truth that
-- drifts the moment anyone edits a flag, and would need a sync path nobody would remember
-- to run. Reading them here instead means flagging a line in the editor puts it on the web
-- immediately, and un-flagging it takes it off.
--
-- What the graph adds is the join the annotations cannot do for themselves: each flag is
-- attached to the event node for its chapter, so a plant sits in the graph beside the moment
-- it was sown rather than floating free.

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
  -- Every plant and reveal in the project's prose, each carrying the chapter it sits in and
  -- the event node for that chapter where one exists. `highlight` and `note` annotations are
  -- excluded deliberately: a highlight is a reading mark, and a note is not one end of
  -- anything.
  flag_rows as (
    select
      -- Annotations written by the editor carry their own id. The fallback keys off the
      -- chapter and the array position so a flag from some older writer still gets a stable
      -- handle rather than a null the renderer would collapse together.
      coalesce(nullif(a ->> 'id', ''), c.id::text || ':' || idx::text) as id,
      a ->> 'type' as flag_type,
      a ->> 'text' as text,
      coalesce(a ->> 'label', '') as label,
      -- What ties the two ends together. Null for a flag nobody has paired yet, which is a
      -- normal state and not an error.
      nullif(a ->> 'pairId', '') as pair_id,
      coalesce(nullif(a ->> 'pairLabel', ''), nullif(a ->> 'thread', '')) as pair_label,
      c.id as chapter_id,
      c.title as chapter_title,
      c."order" as seq,
      (
        select ev.id from public.graph_nodes ev
        where ev.project_id = p_project_id
          and ev.node_type = 'event'
          and ev.properties ->> 'chapter_id' = c.id::text
        limit 1
      ) as event_id
    from public.chapters c
    -- Cast rather than assumed: the chapters table predates this repo's migrations and was
    -- created in the dashboard, so whether the column is json or jsonb is not written down
    -- anywhere here. The cast is a no-op for jsonb and makes json work too. The typeof guard
    -- is for the other shape that turns up in practice -- a row where annotations is null or
    -- an object rather than an array, which would otherwise error the whole query out.
    cross join lateral jsonb_array_elements(
      case jsonb_typeof(c.annotations::jsonb)
        when 'array' then c.annotations::jsonb
        else '[]'::jsonb
      end
    ) with ordinality as t(a, idx)
    where c.project_id = p_project_id
      and a ->> 'type' in ('plant', 'reveal')
      and coalesce(a ->> 'text', '') <> ''
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
    -- Ordered by chapter so a plant always precedes the reveal that pays it, and the two
    -- ends of a pair read in the order the reader meets them.
    'flags', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', f.id,
        'type', f.flag_type,
        'text', f.text,
        'label', f.label,
        'pairId', f.pair_id,
        'pairLabel', f.pair_label,
        'chapterId', f.chapter_id,
        'chapterTitle', f.chapter_title,
        'eventId', f.event_id,
        'seq', f.seq
      ) order by f.seq, f.flag_type desc, f.id)
      from flag_rows f
    ), '[]'::jsonb)
  );
$$;
