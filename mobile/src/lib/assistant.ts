import { supabase } from './supabase';

// Client for the assistant Edge Function (supabase/functions/assistant). Nothing here
// holds an API key -- the function does, which is the entire reason it exists.
export type AgentName = 'icarus' | 'daedalus';

export type AssistantSource = { type: 'chapter' | 'document'; id: string; title: string };

export type AssistantReply = {
  agent: AgentName;
  text: string;
  sources: AssistantSource[];
  usage?: { input_tokens: number; output_tokens: number };
};

export type ChatTurn = { role: 'user' | 'assistant'; content: string };

async function callFunction<T>(
  route: string,
  body: Record<string, unknown>,
): Promise<{ data: T | null; error: string | null }> {
  const { data, error } = await supabase.functions.invoke(`assistant/${route}`, { body });
  if (error) {
    // supabase-js reports a non-2xx as a generic FunctionsHttpError, so the function's own
    // message -- which is the one that actually says what went wrong -- is only in the
    // response body. Without this the user sees "Edge Function returned a non-2xx status
    // code" for a missing API key, which tells them nothing.
    const detail = await readFunctionError(error);
    if (looksUndeployed(error, detail)) return { data: null, error: NOT_DEPLOYED };
    return { data: null, error: detail ?? error.message };
  }
  if (data && typeof data === 'object' && 'error' in data) {
    return { data: null, error: String((data as { error: unknown }).error) };
  }
  return { data: data as T, error: null };
}

// The state this app will sit in until the keys are paid for and the function is deployed:
// the route simply does not exist. Left raw that reads as a network failure, which looks
// like a bug rather than a step not taken yet.
const NOT_DEPLOYED =
  'The assistant is not set up on the server yet. See supabase/README.md — it needs the ' +
  'Edge Function deployed and an API key set before it can answer anything.';

function looksUndeployed(error: unknown, detail: string | null): boolean {
  const status = (error as { context?: { status?: number } })?.context?.status;
  if (status === 404) return true;
  const name = (error as { name?: string })?.name ?? '';
  // supabase-js raises FunctionsFetchError when it cannot reach the function at all.
  return name === 'FunctionsFetchError' && !detail;
}

async function readFunctionError(error: unknown): Promise<string | null> {
  const context = (error as { context?: unknown })?.context;
  if (!context || typeof (context as Response).json !== 'function') return null;
  try {
    const body = await (context as Response).json();
    return typeof body?.error === 'string' ? body.error : null;
  } catch {
    return null;
  }
}

export async function indexSource(params: {
  projectId: string;
  sourceType: 'chapter' | 'document';
  sourceId: string;
  title: string;
  content: string;
}): Promise<{ indexed: number; total: number; error: string | null }> {
  const { data, error } = await callFunction<{ indexed: number; total: number }>('index', params);
  if (error || !data) return { indexed: 0, total: 0, error };
  return { indexed: data.indexed, total: data.total, error: null };
}

export async function askAssistant(params: {
  projectId: string;
  agent: AgentName;
  question: string;
  history: ChatTurn[];
  currentChapter?: string;
}): Promise<{ reply: AssistantReply | null; error: string | null }> {
  const { data, error } = await callFunction<AssistantReply>('ask', params);
  return { reply: data, error };
}

// How much of the project is embedded, so the app can say "indexing 40 of 480" rather than
// leaving the user watching a spinner with no idea whether it is nearly done.
export async function indexStatus(projectId: string): Promise<{ total: number; embedded: number }> {
  const { data, error } = await supabase.rpc('content_chunk_status', { p_project_id: projectId });
  if (error || !data || data.length === 0) return { total: 0, embedded: 0 };
  return { total: Number(data[0].total), embedded: Number(data[0].embedded) };
}
