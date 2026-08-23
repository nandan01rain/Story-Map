-- Character web, seventh pass: many-to-many plant/reveal mapping.
--
-- Run in the SQL Editor like the others. Safe to re-run. Function replacement only, no
-- schema change: none of this is new data. Chapters and scenes are already tables, notes are
-- already annotations, and the graph's job is to join them, not to hold a second copy that
-- drifts.
--
-- **This file supersedes 20260822_graph_flags.sql, 20260822b_graph_structure.sql and
-- 20260823_graph_threads.sql entirely.** If none of the four has been run, run only this one.
--
-- A setup and its payoff are not a pair. Several plants can converge on one reveal, one
-- plant can spawn several reveals, and -- the part the previous shape could not express at
-- all -- a single flag can belong to more than one such grouping, because a line of prose
-- can be doing two jobs at once.
--
-- So a flag carries `pairs`: an array of {id, label}, each naming a setup/payoff grouping it
-- takes part in. The old single `pairId`/`pairLabel` is still read and promoted to a
-- one-element array, so nothing written before this keeps working without a rewrite.
--
-- A mythic thread is not a new kind of thing: it is a NOTE the writer has marked as a
-- parallel to some known mythological arc or setting. So it carries two extra fields and
-- nothing else changes -- `thread` names the parallel, `characterId` says whose arc it
-- belongs to. A note without them is an ordinary note; the subset with them is browsable
-- per character, which is the whole point.
--
-- `pairLabel` and `thread` used to be coalesced into one column, which was fine while only
-- one of them could ever be set and is wrong now that a note can carry a thread while a
-- plant carries a pair label. They are separate fields here.
--
-- Why chapters are returned even though the graph already has "events": they are not the
-- same thing. An event is a moment characters are present at, written by extraction or by
-- hand, and a chapter with nobody placed in it has none. A chapter is structure — it exists
-- whether or not anyone has been placed in it, it owns the prose, and it is what an
-- annotation actually hangs off. Collapsing the two would mean a flag in an unpopulated
-- chapter has nowhere to attach, which is exactly the case that was floating before.

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
      c.id, c.title, c.book, c.act, c."order" as seq, c.status,
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
    select s.id, s.chapter_id, s."order" as seq, s.title, s.summary, s.pov, s.status
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
    'chapters', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id, 'title', c.title, 'book', c.book, 'act', c.act, 'seq', c.seq,
        'status', c.status, 'words', c.content_length, 'eventId', c.event_id
      ) order by c.book, c.seq) from chapter_rows c
    ), '[]'::jsonb),
    'scenes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id, 'chapterId', s.chapter_id, 'seq', s.seq, 'title', s.title,
        'summary', s.summary, 'pov', s.pov, 'status', s.status
      ) order by s.chapter_id, s.seq) from scene_rows s
    ), '[]'::jsonb),
    'flags', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', f.id,
        'type', f.flag_type,
        'text', f.text,
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
