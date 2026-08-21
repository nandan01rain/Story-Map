import { supabase } from './supabase';

// Reading and correcting the character graph. The correction layer (spec §4) is the reason
// this is not just a fetch: an extracted edge the writer fixes must survive every later
// extraction pass, which is what `manual_override` means.

export type GraphNode = {
  id: string;
  label: string;
  type: 'character' | 'event' | 'location' | 'faction' | 'fact';
  properties: Record<string, unknown>;
  source: 'extracted' | 'manual' | 'manual_override';
  needsReview: boolean;
  degree: number;
};

export type GraphLink = {
  source: string;
  target: string;
  count: number;
  type: string | null;
  valence: string | null;
  eventIds: string[];
  needsReview: boolean;
};

export type GraphEvent = {
  id: string;
  label: string;
  properties: Record<string, unknown>;
  participants: number;
  /** Chapter order, so a progression reads as a sequence. */
  seq: number;
};

/** Character -> event. The progression layer: where someone actually is in the story. */
export type GraphPresence = { character: string; event: string; isPov: boolean };

/** One interaction, not the aggregate -- what the expanded view reads from. */
export type GraphInteraction = {
  id: string;
  from: string;
  to: string;
  type: string | null;
  valence: string | null;
  description: string | null;
  eventId: string | null;
  eventLabel: string | null;
  seq: number;
  needsReview: boolean;
};

export type GraphData = {
  nodes: GraphNode[];
  links: GraphLink[];
  events: GraphEvent[];
  presence: GraphPresence[];
  interactions: GraphInteraction[];
};

export async function fetchCharacterGraph(
  projectId: string,
): Promise<{ data: GraphData | null; error: string | null }> {
  const { data, error } = await supabase.rpc('character_graph', { p_project_id: projectId });
  if (error) return { data: null, error: error.message };
  const graph = (data ?? {
    nodes: [],
    links: [],
    events: [],
    presence: [],
    interactions: [],
  }) as GraphData;
  return { data: graph, error: null };
}

export function reviewCounts(graph: GraphData): { nodes: number; links: number } {
  return {
    nodes: graph.nodes.filter((n) => n.needsReview).length,
    links: graph.links.filter((l) => l.needsReview).length,
  };
}

// Everything awaiting confirmation, for the review queue. Deliberately reads the raw edges
// rather than the aggregated pair view -- a correction applies to one interaction at one
// event, not to a relationship in general.
export type PendingEdge = {
  id: string;
  edge_type: string;
  properties: Record<string, unknown>;
  confidence: number | null;
  from: { id: string; label: string } | null;
  to: { id: string; label: string } | null;
  event: { id: string; label: string } | null;
};

export async function fetchPendingEdges(
  projectId: string,
): Promise<{ edges: PendingEdge[]; error: string | null }> {
  const { data, error } = await supabase
    .from('graph_edges')
    .select(
      'id, edge_type, properties, confidence, ' +
        'from:from_node_id(id,label), to:to_node_id(id,label), event:event_id(id,label)',
    )
    .eq('project_id', projectId)
    .eq('needs_review', true)
    .order('confidence', { ascending: true })
    .limit(200);
  if (error) return { edges: [], error: error.message };
  return { edges: (data ?? []) as unknown as PendingEdge[], error: null };
}

export async function fetchPendingCharacters(
  projectId: string,
): Promise<{ nodes: GraphNode[]; error: string | null }> {
  const { data, error } = await supabase
    .from('graph_nodes')
    .select('id, label, properties, source, confidence, needs_review')
    .eq('project_id', projectId)
    .eq('node_type', 'character')
    .eq('needs_review', true)
    .order('label');
  if (error) return { nodes: [], error: error.message };
  return {
    nodes: (data ?? []).map((n) => ({
      id: n.id,
      label: n.label,
      type: 'character' as const,
      properties: n.properties ?? {},
      source: n.source,
      needsReview: n.needs_review,
      degree: 0,
    })),
    error: null,
  };
}

// Accepting is not the same as editing: it clears the review flag but leaves the row as
// extracted, so a later pass over unchanged prose can still refresh it.
export async function acceptEdge(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('graph_edges').update({ needs_review: false }).eq('id', id);
  return { error: error?.message ?? null };
}

export async function acceptNode(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('graph_nodes').update({ needs_review: false }).eq('id', id);
  return { error: error?.message ?? null };
}

// Correcting marks the row manual_override, which extraction is required to respect.
export async function correctEdge(
  id: string,
  properties: Record<string, unknown>,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('graph_edges')
    .update({ properties, source: 'manual_override', needs_review: false, updated_at: new Date().toISOString() })
    .eq('id', id);
  return { error: error?.message ?? null };
}

// Merging is the fix for the failure that compounds: two nodes for one character. Every edge
// on the duplicate is repointed at the survivor, the duplicate's name becomes an alias so
// extraction resolves it correctly next time, and only then is the duplicate removed.
export async function mergeCharacters(
  survivorId: string,
  duplicateId: string,
): Promise<{ error: string | null }> {
  const { data: survivor, error: readError } = await supabase
    .from('graph_nodes')
    .select('label, properties')
    .eq('id', survivorId)
    .single();
  if (readError) return { error: readError.message };

  const { data: duplicate } = await supabase
    .from('graph_nodes')
    .select('label, properties')
    .eq('id', duplicateId)
    .single();
  if (!duplicate) return { error: 'That character no longer exists.' };

  const aliases: string[] = Array.from(
    new Set([
      ...((survivor.properties?.aliases as string[]) ?? []),
      ...((duplicate.properties?.aliases as string[]) ?? []),
      duplicate.label,
    ]),
  ).filter((a) => a.toLowerCase() !== survivor.label.toLowerCase());

  const { error: aliasError } = await supabase
    .from('graph_nodes')
    .update({
      properties: { ...(survivor.properties ?? {}), aliases },
      source: 'manual_override',
      updated_at: new Date().toISOString(),
    })
    .eq('id', survivorId);
  if (aliasError) return { error: aliasError.message };

  // Repoint both ends. A duplicate can appear on either side of an edge.
  await supabase.from('graph_edges').update({ from_node_id: survivorId }).eq('from_node_id', duplicateId);
  await supabase.from('graph_edges').update({ to_node_id: survivorId }).eq('to_node_id', duplicateId);

  const { error: deleteError } = await supabase.from('graph_nodes').delete().eq('id', duplicateId);
  return { error: deleteError?.message ?? null };
}

export async function renameCharacter(id: string, label: string): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('graph_nodes')
    .update({ label, source: 'manual_override', needs_review: false, updated_at: new Date().toISOString() })
    .eq('id', id);
  return { error: error?.message ?? null };
}

// Manual authoring (spec §4.1). Deliberately independent of the extraction pipeline: the
// graph must be usable and correctable by hand whether or not anyone is paying for a model,
// and saga-level relationships that never occur in one identifiable scene have no event to
// hang off anyway.
export async function createCharacter(
  projectId: string,
  userId: string,
  label: string,
  aliases: string[] = [],
): Promise<{ id: string | null; error: string | null }> {
  const name = label.trim();
  if (!name) return { id: null, error: 'A character needs a name.' };

  const { data, error } = await supabase
    .from('graph_nodes')
    .insert({
      user_id: userId,
      project_id: projectId,
      node_type: 'character',
      label: name,
      properties: { aliases, pov_eligible: false, factions: [] },
      source: 'manual',
      needs_review: false,
    })
    .select('id')
    .single();

  if (error) {
    // The unique index on (project, lower(label)) is what stops a duplicate; say so plainly
    // rather than surfacing a constraint name.
    const duplicate = error.code === '23505';
    return { id: null, error: duplicate ? `"${name}" already exists in this project.` : error.message };
  }
  return { id: data.id, error: null };
}

export async function createInteraction(params: {
  projectId: string;
  userId: string;
  fromId: string;
  toId: string;
  interactionType: string;
  valence: string;
  eventId?: string | null;
}): Promise<{ error: string | null }> {
  if (params.fromId === params.toId) return { error: 'A character cannot interact with themselves.' };

  const { error } = await supabase.from('graph_edges').insert({
    user_id: params.userId,
    project_id: params.projectId,
    from_node_id: params.fromId,
    to_node_id: params.toId,
    edge_type: 'INTERACTS_WITH',
    event_id: params.eventId ?? null,
    properties: { interaction_type: params.interactionType, valence: params.valence },
    source: 'manual',
    needs_review: false,
  });

  if (error) {
    return {
      error:
        error.code === '23505'
          ? 'That relationship is already recorded for this moment.'
          : error.message,
    };
  }
  return { error: null };
}

// Soft delete into the existing trash table (spec §4.3) rather than a second mechanism.
// The whole row goes into the payload, so a restore has everything it needs.
async function trash(
  projectId: string,
  userId: string,
  type: 'graph_node' | 'graph_edge',
  payload: unknown,
): Promise<void> {
  await supabase.from('trash').insert({
    user_id: userId,
    project_id: projectId,
    type,
    payload,
    deleted_at: new Date().toISOString(),
  });
}

export async function deleteCharacter(
  projectId: string,
  userId: string,
  id: string,
): Promise<{ error: string | null }> {
  const { data: node } = await supabase.from('graph_nodes').select('*').eq('id', id).single();
  if (!node) return { error: 'That character no longer exists.' };

  // Its edges go too -- the FK cascades them -- so they are trashed alongside, otherwise a
  // restore would bring back a character with no relationships.
  const { data: edges } = await supabase
    .from('graph_edges')
    .select('*')
    .or(`from_node_id.eq.${id},to_node_id.eq.${id}`);

  await trash(projectId, userId, 'graph_node', { node, edges: edges ?? [] });
  const { error } = await supabase.from('graph_nodes').delete().eq('id', id);
  return { error: error?.message ?? null };
}

export async function deleteEdge(
  projectId: string,
  userId: string,
  id: string,
): Promise<{ error: string | null }> {
  const { data: edge } = await supabase.from('graph_edges').select('*').eq('id', id).single();
  if (edge) await trash(projectId, userId, 'graph_edge', { edge });
  const { error } = await supabase.from('graph_edges').delete().eq('id', id);
  return { error: error?.message ?? null };
}

// Extraction. Gated on the assistant toggle by the caller, not here -- this module does not
// know about billing, and the store that owns that flag does.
export async function extractGraphForChapter(params: {
  projectId: string;
  chapterId: string;
  title: string;
  content: string;
  book: number;
  act: number;
  force?: boolean;
}): Promise<{ extracted: number; flagged: number; error: string | null }> {
  const { data, error } = await supabase.functions.invoke('assistant/extract-graph', { body: params });
  if (error) return { extracted: 0, flagged: 0, error: error.message };
  if (data && typeof data === 'object' && 'error' in data) {
    return { extracted: 0, flagged: 0, error: String((data as { error: unknown }).error) };
  }
  const result = data as { extracted?: number; flagged?: number };
  return { extracted: result?.extracted ?? 0, flagged: result?.flagged ?? 0, error: null };
}
