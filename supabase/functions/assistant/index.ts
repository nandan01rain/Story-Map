// StoryMap's assistant Edge Function.
//
// This exists so the Anthropic and Voyage keys live on a server the user cannot read. The
// PWA has deferred that since the beginning and its AI features still call api.anthropic.com
// from client JS; nothing in the mobile app should repeat it.
//
// Two routes:
//   POST /assistant/index  -- chunk and embed a chapter or document
//   POST /assistant/ask    -- retrieve, then ask Icarus or Daedalus
//
// Every request runs as the calling user: their Supabase JWT is forwarded to PostgREST, so
// row-level security decides what they can read. The function never uses the service role
// key, which means a bug here cannot leak one account's manuscript to another.
import Anthropic from 'npm:@anthropic-ai/sdk@0.71.0';
import { createClient } from 'npm:@supabase/supabase-js@2';

import { type Chunk, chunkText, hashChunk } from './chunk.ts';
import { AGENTS, type AgentName } from './agents.ts';

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
  const { projectId, agent, question, history, currentChapter } = await req.json();
  const name: AgentName = agent === 'daedalus' ? 'daedalus' : 'icarus';
  const config = AGENTS[name];

  if (!projectId || !question) return json({ error: 'projectId and question are required.' }, 400);

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
        `[${i + 1}] ${m.source_type === 'chapter' ? 'Chapter' : 'Document'}: ${m.source_title}\n${m.content}`,
    )
    .join('\n\n---\n\n');

  const digest = config.useDigest ? await buildDigest(supabase, projectId) : '';

  const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') });

  // Stable-first ordering, with the cache breakpoint after the parts that do not change
  // between questions in a session. The passages and the question come after it, because
  // they change every time and would invalidate everything behind them.
  const system: Anthropic.TextBlockParam[] = [
    { type: 'text', text: config.system },
    ...(digest ? [{ type: 'text' as const, text: `Project overview:\n\n${digest}` }] : []),
    ...(currentChapter
      ? [{ type: 'text' as const, text: `The chapter open in the editor:\n\n${currentChapter}` }]
      : []),
  ];
  system[system.length - 1].cache_control = { type: 'ephemeral' };

  const userContent = passages
    ? `Relevant material from the project:\n\n${passages}\n\n---\n\n${question}`
    : `${question}\n\n(No indexed material matched this question.)`;

  const stream = anthropic.messages.stream({
    model: config.model,
    max_tokens: config.maxTokens,
    system,
    ...(config.thinking ? { thinking: { type: 'adaptive' as const, display: 'summarized' as const } } : {}),
    ...(config.effort ? { output_config: { effort: config.effort } } : {}),
    ...(config.webSearch
      ? { tools: [{ type: 'web_search_20260209' as const, name: 'web_search', max_uses: 4 }] }
      : {}),
    messages: [...(Array.isArray(history) ? history : []), { role: 'user', content: userContent }],
  });

  const final = await stream.finalMessage();
  const text = final.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('\n');

  return json({
    agent: name,
    text,
    // Returned so the app can show what the answer was actually based on -- an assistant
    // that cites its sources is one the writer can check.
    sources: (matches ?? []).map((m: { source_type: string; source_id: string; source_title: string }) => ({
      type: m.source_type,
      id: m.source_id,
      title: m.source_title,
    })),
    usage: final.usage,
  });
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
