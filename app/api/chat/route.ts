// ============================================================
// Mart Studio — AI Chat API Route
// ============================================================

import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { SYSTEM_PROMPT, getStepInstruction } from '@/lib/prompts/system-prompt';

export const maxDuration = 60;

export async function POST(req: Request) {
  const { messages, currentStep, sessionData } = await req.json();

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

  const result = streamText({
    model: openai('gpt-4o'),
    system: fullSystemPrompt,
    messages: formattedMessages,
    temperature: 0.7,
    maxOutputTokens: 2000,
  });

  return result.toUIMessageStreamResponse();
}
