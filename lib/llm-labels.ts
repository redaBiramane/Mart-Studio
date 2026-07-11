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

// Emoji cerveau/fournisseur pour la puce
export function llmEmoji(provider?: string): string {
  switch (provider) {
    case 'anthropic': return '🧠';
    case 'google': return '✦';
    case 'openai': return '◎';
    default: return '🤖';
  }
}
