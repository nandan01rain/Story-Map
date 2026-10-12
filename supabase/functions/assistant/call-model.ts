import Anthropic from 'npm:@anthropic-ai/sdk@0.71.0';

import { PROVIDERS, type ModelOption } from './models.ts';
import type { ToolSpec } from './tools.ts';

// One call site for every provider, so the rest of the function never knows or cares which
// one is selected. Two dialects cover the field: Anthropic's own, and the OpenAI chat
// completions shape that every open-model host has standardised on.
//
// Both run the same TOOL LOOP (2026-10-12): ask, run whatever tools the model calls, hand the
// results back, repeat until it answers. Before this the agents' tools were declared and never
// offered, so neither assistant could read a document, run a check or propose anything -- they
// saw only the passages retrieval happened to pick.

export type ToolRunner = (name: string, input: unknown) => Promise<{ text: string; isError: boolean }>;

export type ModelRequest = {
  model: ModelOption;
  system: string;
  /** Stable context cached where the provider supports it: digest, open chapter. */
  stableContext: string[];
  messages: { role: 'user' | 'assistant'; content: string }[];
  maxTokens: number;
  effort?: 'low' | 'medium' | 'high' | 'xhigh' | 'max';
  thinking: boolean;
  webSearch: boolean;
  /** When set, the final reply must validate against this JSON Schema. */
  schema?: unknown;
  tools: ToolSpec[];
  runTool: ToolRunner;
  /** Rounds of tool calls before the model must answer with what it has. */
  maxSteps: number;
};

export type ModelReply = {
  text: string;
  inputTokens: number;
  outputTokens: number;
  /** The tools called, in order, so the app can show what the answer rests on. */
  toolCalls: string[];
};

export async function callModel(req: ModelRequest): Promise<ModelReply> {
  const provider = PROVIDERS[req.model.provider];
  const key = Deno.env.get(provider.keyEnv);
  if (!key) {
    throw new Error(
      `${provider.label} is selected but ${provider.keyEnv} is not set on the function. ` +
        `Add it with: supabase secrets set ${provider.keyEnv}=…`,
    );
  }
  return provider.dialect === 'anthropic'
    ? callAnthropic(req, key)
    : callOpenAICompatible(req, key, provider.id);
}

async function callAnthropic(req: ModelRequest, apiKey: string): Promise<ModelReply> {
  const client = new Anthropic({ apiKey });

  // Stable-first ordering with the cache breakpoint after the parts that do not change
  // between questions in a session. Tools render before the system prompt and are fixed per
  // agent, so they sit inside the cached prefix too.
  const system: Anthropic.TextBlockParam[] = [
    { type: 'text', text: req.system },
    ...req.stableContext.map((text) => ({ type: 'text' as const, text })),
  ];
  system[system.length - 1].cache_control = { type: 'ephemeral' };

  // eager_input_streaming: a proposed edit can carry a long passage, and this streams it as it
  // is written. The server then no longer validates tool inputs, so runTool and every tool
  // validate their own (an object, and each field checked before use).
  const tools = [
    ...req.tools.map((t) => ({ ...t, eager_input_streaming: true })),
    ...(req.webSearch ? [{ type: 'web_search_20260209', name: 'web_search', max_uses: 4 }] : []),
  ] as unknown as Anthropic.ToolUnion[];

  // ONE output_config. Effort and the schema were two spreads of the same key, so whichever
  // came second silently replaced the first.
  const outputConfig: Record<string, unknown> = {};
  if (req.effort) outputConfig.effort = req.effort;
  if (req.schema) outputConfig.format = { type: 'json_schema', schema: req.schema };

  const messages: Anthropic.MessageParam[] = req.messages.map((m) => ({ role: m.role, content: m.content }));
  const toolCalls: string[] = [];
  let inputTokens = 0, outputTokens = 0, jsonRetries = 0;
  let last: Anthropic.Message | null = null;

  for (let step = 0; step < req.maxSteps; step++) {
    const stream = client.messages.stream({
      model: req.model.id,
      max_tokens: req.maxTokens,
      system,
      ...(tools.length ? { tools } : {}),
      ...(req.thinking && req.model.thinking ? { thinking: { type: 'adaptive', display: 'summarized' } } : {}),
      ...(Object.keys(outputConfig).length ? { output_config: outputConfig } : {}),
      messages,
    } as unknown as Anthropic.MessageStreamParams);

    let message: Anthropic.Message;
    try {
      message = await stream.finalMessage();
      jsonRetries = 0;
    } catch (err) {
      // Only an unparseable streamed tool input is retried; API errors go to the caller.
      if (err instanceof Anthropic.APIError || jsonRetries++ >= 2) throw err;
      continue;
    }
    inputTokens += message.usage.input_tokens;
    outputTokens += message.usage.output_tokens;
    last = message;

    if (message.stop_reason === 'refusal') {
      return { text: 'The model declined to answer this.', inputTokens, outputTokens, toolCalls };
    }
    // A server tool (web search) paused a long turn: send it back as it is to continue.
    if (message.stop_reason === 'pause_turn') {
      messages.push({ role: 'assistant', content: message.content });
      continue;
    }
    const uses = message.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
    if (message.stop_reason !== 'tool_use' || uses.length === 0) break;

    // The whole assistant turn goes back unchanged (thinking blocks included), then every
    // result in ONE user message.
    messages.push({ role: 'assistant', content: message.content });
    const results = await Promise.all(uses.map(async (u): Promise<Anthropic.ToolResultBlockParam> => {
      toolCalls.push(u.name);
      const r = await req.runTool(u.name, u.input);
      return { type: 'tool_result', tool_use_id: u.id, content: r.text, ...(r.isError ? { is_error: true } : {}) };
    }));
    // The last round says so, in the same message as the results: the tools stay defined (a
    // history with tool calls in it must keep them), and the model answers with what it has.
    const lastRound = step === req.maxSteps - 2;
    messages.push({ role: 'user', content: lastRound ? [...results, { type: 'text', text: BUDGET_NOTE }] : results });
  }

  const text = (last?.content ?? [])
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n');
  return { text, inputTokens, outputTokens, toolCalls };
}

const BUDGET_NOTE = 'That was your last round of tool calls. Answer now from what you have found, and say what you could not check.';

type OpenAIMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: { id: string; type: 'function'; function: { name: string; arguments: string } }[];
  tool_call_id?: string;
};

async function callOpenAICompatible(
  req: ModelRequest,
  apiKey: string,
  providerId: string,
): Promise<ModelReply> {
  const provider = PROVIDERS[req.model.provider];
  const baseUrl =
    providerId === 'custom' ? Deno.env.get('ASSISTANT_CUSTOM_BASE_URL') ?? '' : provider.baseUrl;
  if (!baseUrl) throw new Error('ASSISTANT_CUSTOM_BASE_URL is not set on the function.');

  // The OpenAI dialect has no separate system field with cache control, so the stable
  // context is folded into one leading system message. Providers that cache do it by prefix
  // anyway, so keeping it first still earns the discount where one exists. Hosts vary on
  // combining tools with a JSON response format, so with tools the shape is stated instead.
  const schemaNote = req.schema
    ? `\n\nYour final reply must be a single JSON object matching this schema:\n${JSON.stringify(req.schema)}`
    : '';
  const messages: OpenAIMessage[] = [
    { role: 'system', content: [req.system, ...req.stableContext].join('\n\n') + schemaNote },
    ...req.messages,
  ];
  const tools = req.tools.map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.input_schema } }));
  const toolCalls: string[] = [];
  let inputTokens = 0, outputTokens = 0, text = '';

  for (let step = 0; step < req.maxSteps; step++) {
    const body: Record<string, unknown> = { model: req.model.id, max_tokens: req.maxTokens, messages };
    if (tools.length) body.tools = tools;
    else if (req.schema) body.response_format = { type: 'json_object' };

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`${provider.label} error ${response.status}: ${await response.text()}`);

    const json = await response.json();
    inputTokens += json.usage?.prompt_tokens ?? 0;
    outputTokens += json.usage?.completion_tokens ?? 0;
    const message: OpenAIMessage = json.choices?.[0]?.message ?? { role: 'assistant', content: '' };
    const calls = message.tool_calls ?? [];
    text = message.content ?? '';
    if (!calls.length) break;

    messages.push({ role: 'assistant', content: message.content ?? null, tool_calls: calls });
    for (const call of calls) {
      toolCalls.push(call.function.name);
      let input: unknown;
      try { input = JSON.parse(call.function.arguments || '{}'); } catch { input = null; }
      const r = input === null
        ? { text: 'The arguments were not valid JSON. Call again with a JSON object.', isError: true }
        : await req.runTool(call.function.name, input);
      messages.push({ role: 'tool', tool_call_id: call.id, content: r.isError ? `ERROR: ${r.text}` : r.text });
    }
    if (step === req.maxSteps - 2) messages.push({ role: 'user', content: BUDGET_NOTE });
  }
  return { text, inputTokens, outputTokens, toolCalls };
}
