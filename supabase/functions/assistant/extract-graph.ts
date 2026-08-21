import { createClient } from 'npm:@supabase/supabase-js@2';

import { chunkText, hashChunk } from './chunk.ts';
import { callModel } from './call-model.ts';
import { findModel } from './models.ts';

// Graph extraction. Reads changed prose, returns who was present, who interacted with whom
// and how, and what anyone learned — then writes that into graph_nodes/graph_edges.
//
// Structured extraction, not judgement: this runs on the Icarus tier (Haiku 4.5 by default)
// and must never be pointed at the Daedalus tier. Extraction quality is bounded by whether
// the model can follow a schema, not by how well it reasons about craft.

const EXTRACTION_MODEL = 'claude-haiku-4-5';

// DEVIATION (spec §3.4): the spec suggests 0.6 as a starting threshold with a note that it
// is a guess. Kept at 0.6 for writing, but nothing below it is discarded — it is written
// with needs_review set, so a cautious model never silently loses a real interaction. The
// number only decides what the writer is asked to confirm.
const REVIEW_THRESHOLD = 0.6;

const EXTRACTION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['characters', 'interactions', 'facts'],
  properties: {
    characters: {
      type: 'array',
      description: 'Every character present in this passage.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'confidence'],
        properties: {
          name: { type: 'string', description: 'Canonical name from the roster if it matches one.' },
          matchedRosterName: {
            type: 'string',
            description: 'The roster entry this refers to, if any. Empty when genuinely new.',
          },
          confidence: { type: 'number' },
        },
      },
    },
    interactions: {
      type: 'array',
      description: 'Character-to-character interactions that actually occur on the page.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['from', 'to', 'interactionType', 'valence', 'confidence'],
        properties: {
          from: { type: 'string' },
          to: { type: 'string' },
          interactionType: {
            type: 'string',
            enum: ['confrontation', 'alliance', 'betrayal', 'mentorship', 'romantic', 'other'],
          },
          valence: { type: 'string', enum: ['positive', 'negative', 'ambiguous'] },
          confidence: { type: 'number' },
        },
      },
    },
    facts: {
      type: 'array',
      description: 'Things a character learns in this passage. Only what is actually learned here.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['description', 'knownBy', 'certainty', 'confidence'],
        properties: {
          description: { type: 'string' },
          knownBy: { type: 'array', items: { type: 'string' } },
          certainty: { type: 'string', enum: ['confirmed', 'suspected'] },
          confidence: { type: 'number' },
        },
      },
    },
  },
} as const;

const SYSTEM = `You extract a character-interaction graph from novel prose. You are not
writing, summarising or judging quality — you are reading one passage and reporting what
structurally happened in it.

Rules:

- Report only what the passage shows. A character mentioned in dialogue is not present; a
  character who acts, speaks or is described as being there is present.
- An interaction requires both characters to be present and something to pass between them —
  words, violence, a decision, a gesture. Two people in the same room who never engage are
  present, not interacting.
- Use the roster of known characters. If a name in the passage refers to someone on the
  roster under a nickname, title or epithet, report the roster's canonical name in
  matchedRosterName. Only leave it empty when the character is genuinely new to the saga.
- Facts are things a character LEARNS here, not things the reader learns and not things the
  character already knew. If nobody learns anything, return an empty list.
- Confidence reflects how clearly the passage supports the item. A stated fact is high; an
  inference from tone is low. Do not inflate it.
- Return nothing you cannot point at in the passage.`;

type ExtractionResult = {
  characters: { name: string; matchedRosterName?: string; confidence: number }[];
  interactions: {
    from: string;
    to: string;
    interactionType: string;
    valence: string;
    confidence: number;
  }[];
  facts: { description: string; knownBy: string[]; certainty: string; confidence: number }[];
};

export async function handleExtractGraph(
  req: Request,
  supabase: ReturnType<typeof createClient>,
  userId: string,
  json: (body: unknown, status?: number) => Response,
): Promise<Response> {
  const { projectId, chapterId, sceneId, title, content, book, act, povCharacter, force } =
    await req.json();
  if (!projectId || !chapterId) {
    return json({ error: 'projectId and chapterId are required.' }, 400);
  }

  const model = findModel(EXTRACTION_MODEL);
  if (!model) return json({ error: 'Extraction model is not in the catalogue.' }, 500);

  // Only changed paragraphs are re-read, reusing the same chunker and hash the retrieval
  // pipeline uses so a normal editing session costs almost nothing.
  const chunks = chunkText(content ?? '');
  if (chunks.length === 0) return json({ extracted: 0, skipped: 0, unchanged: true });

  const { data: eventRow } = await supabase
    .from('graph_nodes')
    .select('id, properties')
    .eq('project_id', projectId)
    .eq('node_type', 'event')
    .eq('properties->>chapter_id', chapterId)
    .maybeSingle();

  const seenHashes: string[] = eventRow?.properties?.chunk_hashes ?? [];
  const currentHashes = chunks.map((c) => hashChunk(c.content));
  const changed = force
    ? chunks
    : chunks.filter((c, i) => !seenHashes.includes(currentHashes[i]));

  if (changed.length === 0) return json({ extracted: 0, skipped: 0, unchanged: true });

  // The roster, with aliases, so the model resolves nicknames instead of inventing twins.
  const { data: roster } = await supabase
    .from('graph_nodes')
    .select('id, label, properties')
    .eq('project_id', projectId)
    .eq('node_type', 'character');

  const rosterText =
    (roster ?? [])
      .map((c) => {
        const aliases: string[] = c.properties?.aliases ?? [];
        return aliases.length > 0 ? `${c.label} (also: ${aliases.join(', ')})` : c.label;
      })
      .join('\n') || '(no characters recorded yet)';

  // One event node per chapter/scene, created before the edges that hang off it.
  const eventId = await upsertEvent(supabase, userId, projectId, {
    chapterId,
    sceneId,
    title,
    book,
    act,
    chunkHashes: currentHashes,
    existingId: eventRow?.id,
  });

  const byName = new Map<string, string>();
  for (const c of roster ?? []) {
    byName.set(c.label.toLowerCase(), c.id);
    for (const alias of (c.properties?.aliases ?? []) as string[]) {
      byName.set(alias.toLowerCase(), c.id);
    }
  }

  let extracted = 0;
  let flagged = 0;

  for (const chunk of changed) {
    // A window of context so pronouns and "he said" resolve to someone.
    const index = chunks.findIndex((c) => c.index === chunk.index);
    const window = [chunks[index - 1]?.content, chunk.content, chunks[index + 1]?.content]
      .filter(Boolean)
      .join('\n\n');

    const reply = await callModel({
      model,
      system: SYSTEM,
      stableContext: [
        `Known characters in this saga:\n${rosterText}`,
        `This passage is from Book ${(book ?? 0) + 1}, Act ${act ?? 1}, "${title ?? 'Untitled'}".` +
          (povCharacter ? ` The viewpoint character is ${povCharacter}.` : ''),
      ],
      messages: [
        {
          role: 'user',
          content:
            `Extract the interaction graph for the MIDDLE passage below. The passages either ` +
            `side are context only — do not report what happens in them.\n\n---\n\n${window}`,
        },
      ],
      maxTokens: 2000,
      thinking: false,
      webSearch: false,
      schema: EXTRACTION_SCHEMA,
    });

    let result: ExtractionResult;
    try {
      result = JSON.parse(reply.text);
    } catch {
      continue; // A malformed reply loses one paragraph, not the pass.
    }

    // Characters first: an interaction cannot be written before both ends exist.
    for (const character of result.characters ?? []) {
      const canonical = (character.matchedRosterName || character.name || '').trim();
      if (!canonical) continue;
      if (byName.has(canonical.toLowerCase())) continue;

      const id = await upsertCharacter(supabase, userId, projectId, canonical, character.confidence);
      if (id) {
        byName.set(canonical.toLowerCase(), id);
        // DEVIATION (spec §9.1): a first-seen name is always flagged for review, whatever its
        // confidence. A new character is the one extraction error that compounds -- every
        // later passage attaches to the twin -- so it is worth one confirmation each.
        flagged += 1;
      }
    }

    for (const character of result.characters ?? []) {
      const id = byName.get((character.matchedRosterName || character.name || '').toLowerCase());
      if (!id) continue;
      await upsertEdge(supabase, userId, projectId, {
        from: id,
        to: eventId,
        edgeType: 'PRESENT_AT',
        eventId,
        properties: {},
        confidence: character.confidence,
      });
      extracted += 1;
    }

    for (const interaction of result.interactions ?? []) {
      const from = byName.get(interaction.from?.toLowerCase() ?? '');
      const to = byName.get(interaction.to?.toLowerCase() ?? '');
      if (!from || !to || from === to) continue;
      await upsertEdge(supabase, userId, projectId, {
        from,
        to,
        edgeType: 'INTERACTS_WITH',
        eventId,
        properties: {
          interaction_type: interaction.interactionType,
          valence: interaction.valence,
        },
        confidence: interaction.confidence,
      });
      extracted += 1;
      if ((interaction.confidence ?? 0) < REVIEW_THRESHOLD) flagged += 1;
    }

    for (const fact of result.facts ?? []) {
      if (!fact.description) continue;
      const factId = await upsertFact(supabase, userId, projectId, fact.description, eventId, fact.confidence);
      if (!factId) continue;
      for (const knower of fact.knownBy ?? []) {
        const id = byName.get(knower.toLowerCase());
        if (!id) continue;
        await upsertEdge(supabase, userId, projectId, {
          from: id,
          to: factId,
          edgeType: 'KNOWS_ABOUT',
          eventId,
          properties: { learned_at_event_id: eventId, certainty: fact.certainty },
          confidence: fact.confidence,
        });
        extracted += 1;
      }
    }
  }

  return json({ extracted, flagged, passages: changed.length, unchanged: false });
}

async function upsertEvent(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  projectId: string,
  e: {
    chapterId: string;
    sceneId?: string;
    title?: string;
    book?: number;
    act?: number;
    chunkHashes: string[];
    existingId?: string;
  },
): Promise<string> {
  const properties = {
    chapter_id: e.chapterId,
    scene_id: e.sceneId ?? null,
    book: e.book ?? null,
    act: e.act ?? null,
    chunk_hashes: e.chunkHashes,
  };

  if (e.existingId) {
    await supabase
      .from('graph_nodes')
      .update({ label: e.title ?? 'Untitled', properties, updated_at: new Date().toISOString() })
      .eq('id', e.existingId);
    return e.existingId;
  }

  const { data } = await supabase
    .from('graph_nodes')
    .insert({
      user_id: userId,
      project_id: projectId,
      node_type: 'event',
      label: e.title ?? 'Untitled',
      properties,
      source: 'extracted',
    })
    .select('id')
    .single();
  return data!.id;
}

async function upsertCharacter(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  projectId: string,
  label: string,
  confidence: number,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('graph_nodes')
    .insert({
      user_id: userId,
      project_id: projectId,
      node_type: 'character',
      label,
      properties: { aliases: [], pov_eligible: false, factions: [] },
      source: 'extracted',
      confidence,
      needs_review: true,
    })
    .select('id')
    .single();

  // A unique-violation means another passage in the same pass created it first; that is a
  // race, not a failure.
  if (error) {
    const { data: existing } = await supabase
      .from('graph_nodes')
      .select('id')
      .eq('project_id', projectId)
      .eq('node_type', 'character')
      .ilike('label', label)
      .maybeSingle();
    return existing?.id ?? null;
  }
  return data.id;
}

async function upsertFact(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  projectId: string,
  description: string,
  eventId: string,
  confidence: number,
): Promise<string | null> {
  const { data } = await supabase
    .from('graph_nodes')
    .insert({
      user_id: userId,
      project_id: projectId,
      node_type: 'fact',
      label: description.slice(0, 120),
      properties: { description, canonical_reveal_ref: null, first_seen_event_id: eventId },
      source: 'extracted',
      confidence,
      needs_review: confidence < REVIEW_THRESHOLD,
    })
    .select('id')
    .single();
  return data?.id ?? null;
}

async function upsertEdge(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  projectId: string,
  e: {
    from: string;
    to: string;
    edgeType: string;
    eventId: string | null;
    properties: Record<string, unknown>;
    confidence: number;
  },
) {
  // A human correction outranks anything re-extraction produces (spec §3.4). Checked rather
  // than relying on upsert, because the conflict target would otherwise overwrite it.
  const { data: existing } = await supabase
    .from('graph_edges')
    .select('id, source')
    .eq('from_node_id', e.from)
    .eq('to_node_id', e.to)
    .eq('edge_type', e.edgeType)
    .eq('event_id', e.eventId)
    .maybeSingle();

  if (existing?.source === 'manual_override') {
    console.log(`Kept manual override on ${e.edgeType} ${e.from}->${e.to}`);
    return;
  }

  const row = {
    user_id: userId,
    project_id: projectId,
    from_node_id: e.from,
    to_node_id: e.to,
    edge_type: e.edgeType,
    event_id: e.eventId,
    properties: e.properties,
    confidence: e.confidence,
    needs_review: (e.confidence ?? 0) < REVIEW_THRESHOLD,
    source: 'extracted',
    updated_at: new Date().toISOString(),
  };

  if (existing) {
    await supabase.from('graph_edges').update(row).eq('id', existing.id);
  } else {
    await supabase.from('graph_edges').insert(row);
  }
}
