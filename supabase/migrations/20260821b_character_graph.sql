-- Character knowledge graph — property graph over two tables.
--
-- Run in the Supabase dashboard's SQL Editor, same as the retrieval migration. Safe to
-- re-run; every statement is guarded.
--
-- A property graph in Postgres rather than a second database technology: at saga scale
-- (dozens of characters, hundreds of events, low thousands of edges) recursive CTEs are
-- more than adequate, and a second datastore would be pure operational cost.

create table if not exists public.graph_nodes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,

  node_type text not null check (node_type in ('character', 'event', 'location', 'faction', 'fact')),
  label text not null,
  properties jsonb not null default '{}'::jsonb,

  -- 'extracted' was written by the pipeline; 'manual' was authored by hand;
  -- 'manual_override' was extracted then corrected, and re-extraction must never clobber it.
  source text not null default 'extracted' check (source in ('extracted', 'manual', 'manual_override')),
  confidence real,
  needs_review boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- DEVIATION (spec §9.1, alias handling): aliases live in the character node's own
-- properties as a string array rather than in a separate table. At this scale a join table
-- buys nothing, and keeping aliases beside the label means the extraction roster is a single
-- cheap query. This unique index is what makes an alias authoritative: one canonical
-- character per (project, lowercased label), so a second extraction of "Zia" cannot quietly
-- create a twin of the existing one.
create unique index if not exists graph_nodes_character_label_idx
  on public.graph_nodes (project_id, lower(label))
  where node_type = 'character';

-- One event node per scene (or per chapter where a scene is not identified), so repeated
-- extraction of the same passage updates rather than accumulates.
create unique index if not exists graph_nodes_event_scope_idx
  on public.graph_nodes (project_id, (properties ->> 'chapter_id'), (properties ->> 'scene_id'))
  where node_type = 'event';

create index if not exists graph_nodes_type_idx on public.graph_nodes (project_id, node_type);
create index if not exists graph_nodes_props_idx on public.graph_nodes using gin (properties);
create index if not exists graph_nodes_review_idx
  on public.graph_nodes (project_id) where needs_review;

create table if not exists public.graph_edges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,

  from_node_id uuid not null references public.graph_nodes (id) on delete cascade,
  to_node_id uuid not null references public.graph_nodes (id) on delete cascade,
  edge_type text not null check (
    edge_type in ('PRESENT_AT', 'INTERACTS_WITH', 'KNOWS_ABOUT', 'CAUSES', 'MEMBER_OF')
  ),

  -- The event this edge is scoped to. Null for saga-level edges such as an ongoing
  -- MEMBER_OF, which are not anchored to a single moment.
  event_id uuid references public.graph_nodes (id) on delete cascade,

  properties jsonb not null default '{}'::jsonb,
  confidence real,
  needs_review boolean not null default false,
  source text not null default 'extracted' check (source in ('extracted', 'manual', 'manual_override')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The natural key from §3.4: re-extracting a paragraph updates the same row rather than
-- inserting a duplicate. Two partial indexes because Postgres treats NULLs as distinct in a
-- unique constraint, so a single index would let unlimited duplicate saga-level edges
-- through -- exactly the rows most likely to be re-extracted.
create unique index if not exists graph_edges_scoped_key_idx
  on public.graph_edges (from_node_id, to_node_id, edge_type, event_id)
  where event_id is not null;

create unique index if not exists graph_edges_unscoped_key_idx
  on public.graph_edges (from_node_id, to_node_id, edge_type)
  where event_id is null;

create index if not exists graph_edges_from_idx on public.graph_edges (from_node_id);
create index if not exists graph_edges_to_idx on public.graph_edges (to_node_id);
create index if not exists graph_edges_event_idx on public.graph_edges (event_id);
create index if not exists graph_edges_project_idx on public.graph_edges (project_id, edge_type);
create index if not exists graph_edges_props_idx on public.graph_edges using gin (properties);
create index if not exists graph_edges_review_idx
  on public.graph_edges (project_id) where needs_review;

alter table public.graph_nodes enable row level security;
alter table public.graph_edges enable row level security;

drop policy if exists "own graph nodes" on public.graph_nodes;
create policy "own graph nodes" on public.graph_nodes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own graph edges" on public.graph_edges;
create policy "own graph edges" on public.graph_edges
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- DEVIATION (spec §9.2, edge aggregation): resolved by doing both. Storage keeps one edge
-- per event, which is the fidelity the graph is for -- "who met whom, where" -- while the
-- visualization reads this view, which collapses a character pair into a single visual edge
-- carrying the interaction count, the event list, and the dominant interaction type. Neither
-- fidelity nor legibility is traded away, and no decision has to be revisited once the
-- graph gets dense.
create or replace view public.character_pair_edges as
with pairs as (
  select
    e.project_id,
    -- Undirected: A-meets-B and B-meets-A are the same relationship, so the pair is
    -- normalised by id order before grouping.
    least(e.from_node_id, e.to_node_id) as node_a,
    greatest(e.from_node_id, e.to_node_id) as node_b,
    e.event_id,
    e.properties ->> 'interaction_type' as interaction_type,
    e.properties ->> 'valence' as valence,
    e.needs_review
  from public.graph_edges e
  where e.edge_type = 'INTERACTS_WITH'
)
select
  project_id,
  node_a,
  node_b,
  count(*)::int as interaction_count,
  array_remove(array_agg(distinct event_id), null) as event_ids,
  mode() within group (order by interaction_type) as dominant_type,
  mode() within group (order by valence) as dominant_valence,
  bool_or(needs_review) as needs_review
from pairs
group by project_id, node_a, node_b;

-- Everything the visualization needs in one round trip. Returned as jsonb because the
-- client hands it straight to the graph renderer.
create or replace function public.character_graph(p_project_id uuid)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'nodes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', n.id,
        'label', n.label,
        'type', n.node_type,
        'properties', n.properties,
        'source', n.source,
        'needsReview', n.needs_review,
        -- Degree drives node size in the renderer; computing it here avoids the client
        -- walking every edge to size every node.
        'degree', (
          select count(*) from public.graph_edges e
          where e.from_node_id = n.id or e.to_node_id = n.id
        )
      ))
      from public.graph_nodes n
      where n.project_id = p_project_id
        and n.node_type in ('character', 'faction', 'location')
    ), '[]'::jsonb),
    'links', coalesce((
      select jsonb_agg(jsonb_build_object(
        'source', p.node_a,
        'target', p.node_b,
        'count', p.interaction_count,
        'type', p.dominant_type,
        'valence', p.dominant_valence,
        'eventIds', p.event_ids,
        'needsReview', p.needs_review
      ))
      from public.character_pair_edges p
      where p.project_id = p_project_id
    ), '[]'::jsonb),
    'events', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', n.id,
        'label', n.label,
        'properties', n.properties
      ))
      from public.graph_nodes n
      where n.project_id = p_project_id and n.node_type = 'event'
    ), '[]'::jsonb)
  );
$$;

-- Everything a character touched, for the one-hop isolate and the POV filter (spec §7.2).
create or replace function public.character_footprint(p_character_id uuid)
returns table (
  event_id uuid,
  event_label text,
  event_properties jsonb,
  is_pov boolean
)
language sql
stable
as $$
  select
    ev.id,
    ev.label,
    ev.properties,
    (ev.properties ->> 'pov_character_id') = p_character_id::text
  from public.graph_nodes ev
  join public.graph_edges e
    on e.event_id = ev.id
   and (e.from_node_id = p_character_id or e.to_node_id = p_character_id)
  where ev.node_type = 'event'
  group by ev.id, ev.label, ev.properties;
$$;
