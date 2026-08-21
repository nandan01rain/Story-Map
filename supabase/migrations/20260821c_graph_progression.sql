-- Character web, second pass: events become first-class in the graph.
--
-- Run in the SQL Editor like the others. Safe to re-run.
--
-- The first version answered only "who knows whom". A character's arc — which events they
-- actually pass through, and which of those they share with other people — was in the
-- schema (PRESENT_AT edges onto event nodes) but never returned to the client, so the web
-- could not draw it. This replaces character_graph so one call returns both layers:
-- relationships between characters, and each character's progression through events.
--
-- Two link sets rather than one flattened set, because the view needs to light one and dim
-- the other on demand. Merging them would force the renderer to re-derive which is which
-- on every frame.

create or replace function public.character_graph(p_project_id uuid)
returns jsonb
language sql
stable
as $$
  with character_nodes as (
    select
      n.id,
      n.label,
      n.node_type,
      n.properties,
      n.source,
      n.needs_review,
      (select count(*) from public.graph_edges e
        where e.edge_type = 'INTERACTS_WITH' and (e.from_node_id = n.id or e.to_node_id = n.id)
      ) as degree
    from public.graph_nodes n
    where n.project_id = p_project_id
      and n.node_type in ('character', 'faction', 'location')
  ),
  -- Only events somebody is actually present at. An event node with no one in it is a
  -- chapter nobody has been placed in yet, and drawing it would scatter unreachable dots
  -- across the graph.
  event_nodes as (
    select
      n.id,
      n.label,
      n.properties,
      n.needs_review,
      count(distinct e.from_node_id) as participants
    from public.graph_nodes n
    join public.graph_edges e
      on e.event_id = n.id and e.edge_type = 'PRESENT_AT'
    where n.project_id = p_project_id and n.node_type = 'event'
    group by n.id, n.label, n.properties, n.needs_review
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
        'id', ev.id,
        'label', ev.label,
        'type', 'event',
        'properties', ev.properties,
        'needsReview', ev.needs_review,
        'participants', ev.participants,
        -- Chapter order, so a progression reads as a sequence rather than a cloud. Falls
        -- back to the act when an event has no order recorded.
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
    -- Who appears in what. Directed character -> event, and the flag says whether they are
    -- the viewpoint for it, which is what turns this into the POV filter as well.
    'presence', coalesce((
      select jsonb_agg(jsonb_build_object(
        'character', e.from_node_id,
        'event', e.event_id,
        'isPov', (ev.properties ->> 'pov_character_id') = e.from_node_id::text
      ))
      from public.graph_edges e
      join event_nodes ev on ev.id = e.event_id
      where e.project_id = p_project_id and e.edge_type = 'PRESENT_AT'
    ), '[]'::jsonb)
  );
$$;
