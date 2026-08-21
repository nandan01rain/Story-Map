-- Character web, third pass: return the individual interactions, not only the aggregate.
--
-- Run in the SQL Editor. Safe to re-run.
--
-- character_pair_edges collapses a character pair into one visual edge, which is right for
-- drawing and useless for reading: the count survives, the account of what actually happened
-- does not. The graph now needs both — the aggregate to draw a line whose weight means
-- something, and the individual rows so tapping one can explain itself.

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
    -- One row per interaction, ordered so a pair's history reads chronologically: the
    -- enduring relationship first, then the moments, in chapter order.
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
    ), '[]'::jsonb)
  );
$$;
