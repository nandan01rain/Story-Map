// Mirror of supabase/functions/assistant/models.ts, minus the provider secrets.
//
// Deno and React Native cannot share a module, so the catalogue is duplicated: the app uses
// it to render the picker, the function uses it to route and validate. KEEP THEM IN SYNC --
// if they drift, the app offers a model the function will reject.
//
// The model is deliberately not what defines an agent. Icarus and Daedalus differ in their
// tools, permissions, output contract and retrieval strategy; swapping the engine changes
// cost and quality, not identity or capability.
export type ProviderId = 'anthropic' | 'openrouter' | 'moonshot' | 'openai' | 'custom';

export const PROVIDER_LABELS: Record<ProviderId, string> = {
  anthropic: 'Anthropic',
  openrouter: 'OpenRouter',
  moonshot: 'Moonshot (Kimi)',
  openai: 'OpenAI',
  custom: 'Custom',
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

// Rough per-question cost at the sizes this app actually sends (~17k in, ~800 out), shown
// in the picker so the choice is informed rather than a name in a list.
export function estimateCostPerQuestion(model: ModelOption): string {
  const dollars = (17_000 / 1_000_000) * model.inputPerM + (800 / 1_000_000) * model.outputPerM;
  return dollars < 0.01 ? '<1c' : `~${Math.round(dollars * 100)}c`;
}
