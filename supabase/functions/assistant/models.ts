// The model catalogue and the providers behind it.
//
// Agents are not defined by their model. Each one has its own tools, retrieval strategy,
// output contract and permissions (see agents.ts) -- the model is the engine, swappable
// without changing what the agent is or is allowed to do. That is the point of this file:
// let the writer pick whatever they want to pay for, per agent, without any of the agent's
// behaviour riding on that choice.
//
// KEEP IN SYNC with mobile/src/lib/assistantModels.ts. Deno and React Native cannot share
// a module, so the catalogue is duplicated; the app uses it to render the picker and the
// function uses it to route and validate. If they drift, the app offers a model the
// function will reject.

export type ProviderId = 'anthropic' | 'openrouter' | 'moonshot' | 'openai' | 'custom';

export type Provider = {
  id: ProviderId;
  label: string;
  // Anthropic has its own message shape; everything else here speaks the OpenAI chat
  // completions dialect, which is the de-facto standard for open-model hosts.
  dialect: 'anthropic' | 'openai';
  baseUrl: string;
  // Name of the Edge Function secret holding this provider's key.
  keyEnv: string;
};

export const PROVIDERS: Record<ProviderId, Provider> = {
  anthropic: {
    id: 'anthropic',
    label: 'Anthropic',
    dialect: 'anthropic',
    baseUrl: 'https://api.anthropic.com',
    keyEnv: 'ANTHROPIC_API_KEY',
  },
  // One key, many models -- the pragmatic choice for trying open models without opening an
  // account per vendor.
  openrouter: {
    id: 'openrouter',
    label: 'OpenRouter',
    dialect: 'openai',
    baseUrl: 'https://openrouter.ai/api/v1',
    keyEnv: 'OPENROUTER_API_KEY',
  },
  moonshot: {
    id: 'moonshot',
    label: 'Moonshot (Kimi)',
    dialect: 'openai',
    baseUrl: 'https://api.moonshot.ai/v1',
    keyEnv: 'MOONSHOT_API_KEY',
  },
  openai: {
    id: 'openai',
    label: 'OpenAI',
    dialect: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    keyEnv: 'OPENAI_API_KEY',
  },
  // Anything else OpenAI-compatible: a self-hosted vLLM, Ollama behind a tunnel, Together,
  // DeepInfra, Fireworks. Set ASSISTANT_CUSTOM_BASE_URL alongside the key.
  custom: {
    id: 'custom',
    label: 'Custom (OpenAI-compatible)',
    dialect: 'openai',
    baseUrl: '',
    keyEnv: 'CUSTOM_API_KEY',
  },
};

export type ModelOption = {
  id: string;
  label: string;
  provider: ProviderId;
  // Rough guide only, US dollars per million tokens, for showing relative cost in the
  // picker. Not used for billing and not kept current -- providers change prices.
  inputPerM: number;
  outputPerM: number;
  // Whether this model supports the extended-thinking parameters the Anthropic models take.
  thinking: boolean;
  note: string;
};

export const MODELS: ModelOption[] = [
  {
    id: 'claude-opus-5',
    label: 'Claude Opus 5',
    provider: 'anthropic',
    inputPerM: 5,
    outputPerM: 25,
    thinking: true,
    note: 'Strongest judgement. The default for Daedalus.',
  },
  {
    id: 'claude-sonnet-5',
    label: 'Claude Sonnet 5',
    provider: 'anthropic',
    inputPerM: 3,
    outputPerM: 15,
    thinking: true,
    note: 'Most of the capability at roughly half the cost.',
  },
  {
    id: 'claude-haiku-4-5',
    label: 'Claude Haiku 4.5',
    provider: 'anthropic',
    inputPerM: 1,
    outputPerM: 5,
    thinking: false,
    note: 'Fast and cheap. The default for Icarus.',
  },
  {
    id: 'moonshotai/kimi-k2.6',
    label: 'Kimi K2.6',
    provider: 'openrouter',
    inputPerM: 0.95,
    outputPerM: 4,
    thinking: false,
    note: 'Open weights. Competitive on validation work; weaker on craft judgement.',
  },
  {
    id: 'kimi-k2.6',
    label: 'Kimi K2.6 (direct)',
    provider: 'moonshot',
    inputPerM: 0.95,
    outputPerM: 4,
    thinking: false,
    note: 'Same model, billed by Moonshot rather than OpenRouter.',
  },
  {
    id: 'deepseek/deepseek-v3.2',
    label: 'DeepSeek V3.2',
    provider: 'openrouter',
    inputPerM: 0.3,
    outputPerM: 1.2,
    thinking: false,
    note: 'Open weights, very cheap. Best suited to Icarus.',
  },
  {
    id: 'qwen/qwen3-235b-a22b',
    label: 'Qwen3 235B',
    provider: 'openrouter',
    inputPerM: 0.2,
    outputPerM: 0.8,
    thinking: false,
    note: 'Open weights. Strong structured output for its price.',
  },
  {
    id: 'gpt-5',
    label: 'GPT-5',
    provider: 'openai',
    inputPerM: 1.25,
    outputPerM: 10,
    thinking: false,
    note: 'If you already hold an OpenAI key.',
  },
];

export function findModel(id: string): ModelOption | null {
  return MODELS.find((m) => m.id === id) ?? null;
}
