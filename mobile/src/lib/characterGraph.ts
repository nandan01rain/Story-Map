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

export type GraphEvent = { id: string; label: string; properties: Record<string, unknown> };

export type GraphData = { nodes: GraphNode[]; links: GraphLink[]; events: GraphEvent[] };

export async function fetchCharacterGraph(
  projectId: string,
): Promise<{ data: GraphData | null; error: string | null }> {
  const { data, error } = await supabase.rpc('character_graph', { p_project_id: projectId });
  if (error) return { data: null, error: error.message };
  const graph = (data ?? { nodes: [], links: [], events: [] }) as GraphData;
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
