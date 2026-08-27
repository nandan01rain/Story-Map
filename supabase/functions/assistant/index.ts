// StoryMap's assistant Edge Function.
//
// This exists so the Anthropic and Voyage keys live on a server the user cannot read. The
// PWA has deferred that since the beginning and its AI features still call api.anthropic.com
// from client JS; nothing in the mobile app should repeat it.
//
// Two routes:
//   POST /assistant/index          -- chunk and embed a chapter or document
//   POST /assistant/ask            -- retrieve, then ask Icarus or Daedalus
//   POST /assistant/extract-graph  -- read prose into the character knowledge graph
//
// Every request runs as the calling user: their Supabase JWT is forwarded to PostgREST, so
// row-level security decides what they can read. The function never uses the service role
// key, which means a bug here cannot leak one account's manuscript to another.
import { createClient } from 'npm:@supabase/supabase-js@2';

import { type Chunk, chunkText, hashChunk } from './chunk.ts';
import { AGENTS, type AgentName, FINDINGS_SCHEMA } from './agents.ts';
import { callModel } from './call-model.ts';
import { findModel } from './models.ts';
import { handleExtractGraph } from './extract-graph.ts';

const EMBEDDING_MODEL = 'voyage-3.5';
const EMBEDDING_URL = 'https://api.voyageai.com/v1/embeddings';
// Voyage caps a request by both count and total tokens; batching well under the limit keeps
// a single oversized chapter from failing the whole index pass.
const EMBED_BATCH = 64;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Not signed in.' }, 401);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) return json({ error: 'Not signed in.' }, 401);
  const userId = userData.user.id;

  const route = new URL(req.url).pathname.split('/').filter(Boolean).pop();

  try {
    if (route === 'index') return await handleIndex(req, supabase, userId);
    if (route === 'ask') return await handleAsk(req, supabase);
    if (route === 'extract-graph') return await handleExtractGraph(req, supabase, userId, json);
    return json({ error: `Unknown route: ${route}` }, 404);
  } catch (e) {
    console.error(e);
    return json({ error: e instanceof Error ? e.message : 'Unexpected error.' }, 500);
  }
});

// ---------------------------------------------------------------- indexing

async function handleIndex(req: Request, supabase: ReturnType<typeof createClient>, userId: string) {
  const { projectId, sourceType, sourceId, title, content } = await req.json();
  if (!projectId || !sourceType || !sourceId) {
    return json({ error: 'projectId, sourceType and sourceId are required.' }, 400);
  }

  const chunks = chunkText(content ?? '');

  // Everything currently stored for this source, so we can tell what actually changed.
  const { data: existing, error: existingError } = await supabase
    .from('content_chunks')
    .select('id, chunk_index, content_hash')
    .eq('source_type', sourceType)
    .eq('source_id', sourceId);
  if (existingError) return json({ error: existingError.message }, 500);

  const previous = new Map<number, { id: string; content_hash: string }>();
  for (const row of existing ?? []) previous.set(row.chunk_index, row);

  // A chapter edited in its third paragraph should cost one embedding, not forty. This is
  // the difference between indexing being background noise and being a bill.
  const changed: Chunk[] = chunks.filter(
    (chunk) => previous.get(chunk.index)?.content_hash !== hashChunk(chunk.content),
  );

  // Chunks past the end of the new text -- the source got shorter.
  const staleIndexes = [...previous.keys()].filter((index) => index >= chunks.length);
  if (staleIndexes.length > 0) {
    await supabase
      .from('content_chunks')
      .delete()
      .eq('source_type', sourceType)
      .eq('source_id', sourceId)
      .in('chunk_index', staleIndexes);
  }

  if (changed.length === 0) {
    return json({ indexed: 0, total: chunks.length, unchanged: true });
  }

  const embeddings = await embed(changed.map((c) => c.content));

  const rows = changed.map((chunk, i) => ({
    user_id: userId,
    project_id: projectId,
    source_type: sourceType,
    source_id: sourceId,
    source_title: title ?? '',
    chunk_index: chunk.index,
    content: chunk.content,
    content_hash: hashChunk(chunk.content),
    embedding: embeddings[i],
    updated_at: new Date().toISOString(),
  }));

  const { error: upsertError } = await supabase
    .from('content_chunks')
    .upsert(rows, { onConflict: 'source_type,source_id,chunk_index' });
  if (upsertError) return json({ error: upsertError.message }, 500);

  return json({ indexed: rows.length, total: chunks.length, unchanged: false });
}

async function embed(texts: string[]): Promise<number[][]> {
  const key = Deno.env.get('VOYAGE_API_KEY');
  if (!key) throw new Error('VOYAGE_API_KEY is not set on the function.');

  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += EMBED_BATCH) {
    const batch = texts.slice(i, i + EMBED_BATCH);
    const response = await fetch(EMBEDDING_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      // input_type matters: Voyage embeds documents and queries into the same space but
      // asymmetrically, and using the wrong one measurably degrades retrieval.
      body: JSON.stringify({ model: EMBEDDING_MODEL, input: batch, input_type: 'document' }),
    });
    if (!response.ok) throw new Error(`Embedding failed (${response.status}): ${await response.text()}`);
    const body = await response.json();
    for (const item of body.data) out.push(item.embedding);
  }
  return out;
}

async function embedQuery(text: string): Promise<number[]> {
  const key = Deno.env.get('VOYAGE_API_KEY');
  if (!key) throw new Error('VOYAGE_API_KEY is not set on the function.');
  const response = await fetch(EMBEDDING_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: EMBEDDING_MODEL, input: [text], input_type: 'query' }),
  });
  if (!response.ok) throw new Error(`Embedding failed (${response.status}): ${await response.text()}`);
  const body = await response.json();
  return body.data[0].embedding;
}

// ---------------------------------------------------------------- asking

async function handleAsk(req: Request, supabase: ReturnType<typeof createClient>) {
  const { projectId, agent, question, history, currentChapter, model: requestedModel } =
    await req.json();
  // Validated against the roster rather than trusted, same reasoning as the model lookup
  // below: an unknown name falls back to the read-only agent, never to one that can write.
  const name: AgentName = agent === 'daedalus' ? 'daedalus' : 'icarus';
  const config = AGENTS[name];

  if (!projectId || !question) return json({ error: 'projectId and question are required.' }, 400);

  // The writer's choice wins; the agent's default is only a fallback. Validated against the
  // catalogue rather than trusted, so a stale app build cannot ask for a model that no
  // longer exists or route a key to the wrong host.
  const model = findModel(requestedModel) ?? findModel(config.defaultModel);
  if (!model) return json({ error: `Unknown model: ${requestedModel}` }, 400);

  const queryEmbedding = await embedQuery(question);
  const { data: matches, error: matchError } = await supabase.rpc('match_content_chunks', {
    p_project_id: projectId,
    p_query_embedding: queryEmbedding,
    p_match_count: config.matchCount,
  });
  if (matchError) return json({ error: matchError.message }, 500);

  const passages = (matches ?? [])
    .map(
      (m: { source_title: string; source_type: string; content: string }, i: number) =>
        `[${i + 1}] ${m.source_type === 'chapter' ? 'Chapter' : 'Document'}: ${m.source_title}
${m.content}`,
    )
    // Backticks, not quotes: a single-quoted literal cannot span raw newlines, and this one
    // did -- so the function has never parsed, which nothing caught because it has never
    // been deployed. Kept as a multi-line literal rather than an escaped one-liner so the
    // shape of what lands between two passages stays visible in the source.
    .join(`

---

`);

  const stableContext: string[] = [];
  if (config.useDigest) {
    const digest = await buildDigest(supabase, projectId);
    if (digest) stableContext.push(`Project overview:

${digest}`);
  }
  if (currentChapter) stableContext.push(`The chapter open in the editor:

${currentChapter}`);
  if (stableContext.length === 0) stableContext.push('No additional project context was supplied.');

  const userContent = passages
    ? `Relevant material from the project:

${passages}

---

${question}`
    : `${question}

(No indexed material matched this question.)`;

  try {
    const reply = await callModel({
      model,
      system: config.system,
      stableContext,
      messages: [...(Array.isArray(history) ? history : []), { role: 'user', content: userContent }],
      maxTokens: config.maxTokens,
      effort: config.effort,
      thinking: config.preferThinking,
      // Web search is a per-agent capability, not a per-model one, and only the Anthropic
      // dialect exposes it as a server tool here.
      webSearch: config.tools.includes('web_search') && model.provider === 'anthropic',
      schema: config.contract === 'findings' ? FINDINGS_SCHEMA : undefined,
    });

    return json({
      agent: name,
      contract: config.contract,
      model: model.id,
      text: reply.text,
      sources: (matches ?? []).map(
        (m: { source_type: string; source_id: string; source_title: string }) => ({
          type: m.source_type,
          id: m.source_id,
          title: m.source_title,
        }),
      ),
      usage: { input_tokens: reply.inputTokens, output_tokens: reply.outputTokens },
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'The model call failed.' }, 502);
  }
}

// Daedalus reasons about the shape of the saga, and top-N passage retrieval cannot show
// shape -- it shows fragments. This assembles the outline: every chapter's position, title
// and status, plus the canon documents' titles. Cheap, and it is what lets the model answer
// "what structure should this adopt" instead of only "what does this passage say".
async function buildDigest(supabase: ReturnType<typeof createClient>, projectId: string): Promise<string> {
  const [{ data: chapters }, { data: documents }] = await Promise.all([
    supabase
      .from('chapters')
      .select('book, act, "order", title, status')
      .eq('project_id', projectId)
      .order('book')
      .order('act')
      .order('order'),
    supabase.from('documents').select('title, type').eq('project_id', projectId),
  ]);

  const lines: string[] = [];
  let currentBook: number | null = null;
  let currentAct: number | null = null;
  for (const ch of chapters ?? []) {
    if (ch.book !== currentBook) {
      lines.push(`\nBook ${ch.book + 1}`);
      currentBook = ch.book;
      currentAct = null;
    }
    if (ch.act !== currentAct) {
      lines.push(`  Act ${ch.act}`);
      currentAct = ch.act;
    }
    lines.push(`    - ${ch.title || 'Untitled'}${ch.status ? ` (${ch.status})` : ''}`);
  }

  if (documents && documents.length > 0) {
    lines.push('\nCanon documents:');
    for (const doc of documents) lines.push(`  - ${doc.title} [${doc.type}]`);
  }

  return lines.join('\n').trim();
}
