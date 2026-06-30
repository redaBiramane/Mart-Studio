// ============================================================
// Mart Studio — AI Chat API Route
// ============================================================

import { streamText } from 'ai';
import { openai, createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createAnthropic } from '@ai-sdk/anthropic';
import { SYSTEM_PROMPT, getStepInstruction } from '@/lib/prompts/system-prompt';

export const maxDuration = 60;

export async function POST(req: Request) {
  const { messages, currentStep, sessionData, llmSettings } = await req.json();

  // Build the full system prompt with step-specific instructions
  const stepInstruction = getStepInstruction(currentStep || 1);
  
  // Build context from collected session data
  let collectedContext = '';
  if (sessionData) {
    const parts: string[] = [];
    
    if (sessionData.productName) {
      parts.push(`**Data Product**: ${sessionData.productName}`);
    }
    if (sessionData.contextSummary) {
      parts.push(`**Résumé du contexte**: ${sessionData.contextSummary}`);
    }
    if (sessionData.entities?.length > 0) {
      parts.push(`**Entités identifiées**: ${sessionData.entities.map((e: { name: string }) => e.name).join(', ')}`);
    }
    if (sessionData.granularity) {
      parts.push(`**Granularité**: ${sessionData.granularity.observationUnit || sessionData.granularity.description}`);
    }
    if (sessionData.relations?.length > 0) {
      parts.push(`**Relations**: ${sessionData.relations.map((r: { sourceEntityName: string; targetEntityName: string; type: string }) => `${r.sourceEntityName} → ${r.targetEntityName} (${r.type})`).join(', ')}`);
    }
    if (sessionData.attributes?.length > 0) {
      parts.push(`**Attributs déjà définis**: ${sessionData.attributes.length} (n'extrais que les colonnes manquantes pour éviter les doublons)`);
    }
    if (sessionData.kpis?.length > 0) {
      parts.push(`**KPIs**: ${sessionData.kpis.map((k: { name: string }) => k.name).join(', ')}`);
    }

    if (parts.length > 0) {
      collectedContext = `\n\n## Données déjà collectées\n\n${parts.join('\n')}`;
    }
  }

  const fullSystemPrompt = `${SYSTEM_PROMPT}\n\n${stepInstruction}${collectedContext}`;

  // Convert incoming messages to the format expected by streamText
  const formattedMessages = messages.map((m: { role: string; content?: string; parts?: Array<{ type: string; text: string }> }) => ({
    role: m.role as 'user' | 'assistant' | 'system',
    content: m.content || (m.parts?.filter((p: { type: string }) => p.type === 'text').map((p: { text: string }) => p.text).join('') ?? ''),
  }));

  let modelInstance;

  if (llmSettings && llmSettings.apiKey) {
    if (llmSettings.provider === 'google') {
      const googleProvider = createGoogleGenerativeAI({
        apiKey: llmSettings.apiKey,
      });
      modelInstance = googleProvider(llmSettings.model || 'gemini-1.5-flash');
    } else if (llmSettings.provider === 'anthropic') {
      const anthropicProvider = createAnthropic({
        apiKey: llmSettings.apiKey,
      });
      modelInstance = anthropicProvider(llmSettings.model || 'claude-opus-4-8');
    } else if (llmSettings.provider === 'custom') {
      const customOpenAIProvider = createOpenAI({
        apiKey: llmSettings.apiKey || '',
        baseURL: llmSettings.customBaseUrl || undefined,
      });
      modelInstance = customOpenAIProvider(llmSettings.model || 'custom-model');
    } else {
      const openaiProvider = createOpenAI({
        apiKey: llmSettings.apiKey,
      });
      modelInstance = openaiProvider(llmSettings.model || 'gpt-4o');
    }
  } else {
    // Server fallback
    if (llmSettings?.provider === 'google') {
      const googleProvider = createGoogleGenerativeAI({
        apiKey: process.env.GEMINI_API_KEY || '',
      });
      modelInstance = googleProvider(llmSettings.model || 'gemini-1.5-flash');
    } else if (llmSettings?.provider === 'anthropic') {
      const anthropicProvider = createAnthropic({
        apiKey: process.env.ANTHROPIC_API_KEY || '',
      });
      modelInstance = anthropicProvider(llmSettings.model || 'claude-opus-4-8');
    } else if (llmSettings?.provider === 'custom') {
      const customOpenAIProvider = createOpenAI({
        apiKey: process.env.OPENAI_API_KEY || '',
        baseURL: llmSettings.customBaseUrl || undefined,
      });
      modelInstance = customOpenAIProvider(llmSettings.model || 'custom-model');
    } else {
      // Default to OpenAI server configuration
      modelInstance = openai(llmSettings?.model || 'gpt-4o');
    }
  }

  // Les modèles Claude récents (Opus 4.8/4.7, Fable 5) REJETTENT le paramètre
  // temperature (erreur 400). On ne l'envoie donc pas pour le provider Anthropic.
  const isAnthropic = llmSettings?.provider === 'anthropic';

  const result = streamText({
    model: modelInstance,
    system: fullSystemPrompt,
    messages: formattedMessages,
    ...(isAnthropic ? {} : { temperature: 0.4 }),
    maxOutputTokens: 6000,
    onError: ({ error }) => {
      console.error('[chat] streamText error:', error);
    },
  });

  return result.toUIMessageStreamResponse({
    onError: (error) => {
      const msg = error instanceof Error ? error.message : String(error);
      return `Erreur du fournisseur LLM : ${msg}`;
    },
  });
}
