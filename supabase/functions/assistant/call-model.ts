import Anthropic from 'npm:@anthropic-ai/sdk@0.71.0';

import { PROVIDERS, type ModelOption } from './models.ts';

// One call site for every provider, so the rest of the function never knows or cares which
// one is selected. Two dialects cover the field: Anthropic's own, and the OpenAI chat
// completions shape that every open-model host has standardised on.

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
  /** When set, the reply must validate against this JSON Schema. */
  schema?: unknown;
};

export type ModelReply = {
  text: string;
  inputTokens: number;
  outputTokens: number;
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
  // between questions in a session. Passages and the question come after it, because they
  // change every time and would invalidate everything behind them.
  const system: Anthropic.TextBlockParam[] = [
    { type: 'text', text: req.system },
    ...req.stableContext.map((text) => ({ type: 'text' as const, text })),
  ];
  system[system.length - 1].cache_control = { type: 'ephemeral' };

  const stream = client.messages.stream({
    model: req.model.id,
    max_tokens: req.maxTokens,
    system,
    // Only the models that support it, and only when the agent wants it.
    ...(req.thinking && req.model.thinking
      ? { thinking: { type: 'adaptive' as const, display: 'summarized' as const } }
      : {}),
    ...(req.effort ? { output_config: { effort: req.effort } } : {}),
    ...(req.schema
      ? { output_config: { format: { type: 'json_schema' as const, schema: req.schema } } }
      : {}),
    ...(req.webSearch
      ? { tools: [{ type: 'web_search_20260209' as const, name: 'web_search', max_uses: 4 }] }
      : {}),
    messages: req.messages,
  });

  const final = await stream.finalMessage();
  return {
    text: final.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n'),
    inputTokens: final.usage.input_tokens,
    outputTokens: final.usage.output_tokens,
  };
}

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
  // anyway, so keeping it first still earns the discount where one exists.
  const systemContent = [req.system, ...req.stableContext].join('\n\n');

  const body: Record<string, unknown> = {
    model: req.model.id,
    max_tokens: req.maxTokens,
    messages: [{ role: 'system', content: systemContent }, ...req.messages],
  };

  // Not every open-model host implements strict schema enforcement. Asking for JSON object
  // mode is the widely-supported floor; the prompt also states the shape, so a host that
  // ignores this still tends to comply.
  if (req.schema) body.response_format = { type: 'json_object' };

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`${provider.label} error ${response.status}: ${await response.text()}`);
  }

  const json = await response.json();
  return {
    text: json.choices?.[0]?.message?.content ?? '',
    inputTokens: json.usage?.prompt_tokens ?? 0,
    outputTokens: json.usage?.completion_tokens ?? 0,
  };
}
