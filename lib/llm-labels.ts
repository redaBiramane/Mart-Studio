// Libellés lisibles pour les modèles / fournisseurs LLM (partagé Workshop + liste).

const MODEL_NAMES: Record<string, string> = {
  'gpt-4o': 'GPT-4o', 'gpt-4o-mini': 'GPT-4o Mini', 'gpt-4-turbo': 'GPT-4 Turbo',
  'claude-opus-4-8': 'Claude Opus 4.8', 'claude-sonnet-4-6': 'Claude Sonnet 4.6',
  'claude-haiku-4-5': 'Claude Haiku 4.5', 'claude-fable-5': 'Claude Fable 5',
  'gemini-1.5-flash': 'Gemini 1.5 Flash', 'gemini-1.5-pro': 'Gemini 1.5 Pro',
  'gemini-2.0-flash': 'Gemini 2.0 Flash', 'gemini-2.5-flash': 'Gemini 2.5 Flash', 'gemini-2.5-pro': 'Gemini 2.5 Pro',
};

const PROVIDER_NAMES: Record<string, string> = {
  openai: 'OpenAI', anthropic: 'Claude', google: 'Gemini', custom: 'Modèle personnalisé',
};

export function llmLabel(provider?: string, model?: string): string {
  if (model && MODEL_NAMES[model]) return MODEL_NAMES[model];
  if (model) return model;
  return provider ? (PROVIDER_NAMES[provider] || provider) : 'IA';
}

// Emoji/pastille fournisseur (jamais de robot générique)
export function llmEmoji(provider?: string): string {
  switch (provider) {
    case 'anthropic': return '🧠';
    case 'google': return '✦';
    case 'openai': return '◎';
    case 'custom': return '⚙️';
    default: return '✦';
  }
}

// Tarifs indicatifs par modèle (USD / million de tokens) : [entrée, sortie]
const RATES: Record<string, [number, number]> = {
  'gemini-2.0-flash': [0.10, 0.40], 'gemini-2.5-flash': [0.10, 0.40], 'gemini-1.5-flash': [0.075, 0.30],
  'gemini-1.5-pro': [1.25, 5], 'gemini-2.5-pro': [1.25, 10],
  'claude-opus-4-8': [15, 75], 'claude-sonnet-4-6': [3, 15], 'claude-haiku-4-5': [0.8, 4],
  'gpt-4o': [2.5, 10], 'gpt-4o-mini': [0.15, 0.6],
};

export function estimateCostUsd(model: string | undefined, input: number, output: number): number {
  const [ri, ro] = RATES[model || 'gemini-2.0-flash'] || [0.10, 0.40];
  return (input / 1e6) * ri + (output / 1e6) * ro;
}

export function fmtTokens(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace('.0', '') + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1).replace('.0', '') + 'k';
  return String(n);
}
