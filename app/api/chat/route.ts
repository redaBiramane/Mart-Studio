// ============================================================
// Mart Studio — AI Chat API Route
// ============================================================

import { streamText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createClient } from '@supabase/supabase-js';
import { SYSTEM_PROMPT, getStepInstruction } from '@/lib/prompts/system-prompt';

export const maxDuration = 60;

// Rate limiting best-effort (par instance chaude). Pour une limite distribuée
// robuste en prod, brancher Upstash Ratelimit.
const RL = new Map<string, number[]>();
const RL_MAX = 40;          // requêtes
const RL_WINDOW = 60_000;   // par minute
function rateLimited(key: string): boolean {
  const now = Date.now();
  const arr = (RL.get(key) || []).filter((t) => now - t < RL_WINDOW);
  arr.push(now);
  RL.set(key, arr);
  return arr.length > RL_MAX;
}

export async function POST(req: Request) {
  let body;
  try {
    body = await req.json();
  } catch {
    return new Response('Requête invalide.', { status: 400 });
  }
  const { messages, currentStep, sessionData, llmSettings, mode, adminQuestions } = body;

  // --- Authentification : obligatoire dès que Supabase est configuré ---
  // Empêche l'usage anonyme de la clé LLM serveur (abus / coûts).
  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supaAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (supaUrl && supaAnon) {
    const token = req.headers.get('authorization')?.replace('Bearer ', '').trim();
    if (!token) return new Response('Non authentifié.', { status: 401 });
    const supa = createClient(supaUrl, supaAnon, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: authData, error: authErr } = await supa.auth.getUser(token);
    if (authErr || !authData.user) return new Response('Session invalide.', { status: 401 });
    if (rateLimited(authData.user.id)) {
      return new Response('Trop de requêtes. Réessayez dans une minute.', { status: 429 });
    }
  }

  if (!Array.isArray(messages)) {
    return new Response('Requête invalide.', { status: 400 });
  }

  // Build the full system prompt with step-specific instructions
  const stepInstruction = getStepInstruction(currentStep || 1);

  // Mode guidé : une seule question à la fois
  const modeInstruction = mode === 'guided'
    ? `\n\n## MODE GUIDÉ (prioritaire)\nPose UNE SEULE question à la fois. Attends la réponse de l'utilisateur avant de poser la suivante. N'affiche JAMAIS toutes les questions de l'étape d'un coup. Quand tu as couvert toutes les questions de l'étape, produis les blocs json:extract et une courte synthèse. Reste bref et conversationnel.`
    : '';
  
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
      // Détail des attributs par entité pour que le modèle tienne compte des
      // éditions manuelles de l'utilisateur (ajouts/suppressions/renommages).
      const byEntity: Record<string, string[]> = {};
      const entityById: Record<string, string> = {};
      (sessionData.entities || []).forEach((e: { id: string; name: string }) => { entityById[e.id] = e.name; });
      // Plafond pour éviter des payloads énormes (modèles à plusieurs centaines de colonnes).
      const MAX_ATTRS = 1000;
      const allAttrs = sessionData.attributes as Array<{ name: string; type: string; entityId: string; isPrimaryKey?: boolean }>;
      allAttrs.slice(0, MAX_ATTRS).forEach((a) => {
        const ent = entityById[a.entityId] || a.entityId || '—';
        (byEntity[ent] = byEntity[ent] || []).push(`${a.name}${a.isPrimaryKey ? ' (PK)' : ''}:${a.type}`);
      });
      const attrLines = Object.entries(byEntity).map(([ent, cols]) => `  - ${ent} : ${cols.join(', ')}`).join('\n');
      const overflow = allAttrs.length > MAX_ATTRS ? `\n  … (${allAttrs.length - MAX_ATTRS} colonnes supplémentaires non listées)` : '';
      parts.push(`**Attributs actuels par entité** (source de vérité — respecte ces éditions, n'écrase pas) :\n${attrLines}${overflow}`);
    }
    if (sessionData.kpis?.length > 0) {
      parts.push(`**KPIs**: ${sessionData.kpis.map((k: { name: string }) => k.name).join(', ')}`);
    }

    if (parts.length > 0) {
      collectedContext = `\n\n## Données déjà collectées (état ACTUEL, tient compte des éditions manuelles)\n\n${parts.join('\n')}`;
    }
  }

  // Questions définies par l'administrateur pour cette étape (prioritaires).
  let adminQuestionsBlock = '';
  if (Array.isArray(adminQuestions) && adminQuestions.length > 0) {
    const list = adminQuestions
      .filter((q: unknown) => typeof q === 'string' && q.trim())
      .map((q: string) => `- ${q.trim()}`)
      .join('\n');
    if (list) {
      adminQuestionsBlock = `\n\n## Questions de cette étape (DÉFINIES PAR L'ADMINISTRATEUR — PRIORITAIRES)\nPose EXACTEMENT ces questions pour cette étape (tu peux les reformuler naturellement, mais couvre-les toutes et n'en ajoute pas d'autres) :\n${list}`;
    }
  }

  const fullSystemPrompt = `${SYSTEM_PROMPT}\n\n${stepInstruction}${modeInstruction}${collectedContext}${adminQuestionsBlock}`;

  // Convert incoming messages to the format expected by streamText.
  // On filtre les messages vides : Anthropic (Claude) rejette tout bloc de
  // texte vide ("text content blocks must be non-empty").
  const formattedMessages = messages
    .map((m: { role: string; content?: string; parts?: Array<{ type: string; text: string }> }) => ({
      role: m.role as 'user' | 'assistant' | 'system',
      content: m.content || (m.parts?.filter((p: { type: string }) => p.type === 'text').map((p: { text: string }) => p.text).join('') ?? ''),
    }))
    .filter((m: { content: string }) => typeof m.content === 'string' && m.content.trim().length > 0)
    // Limite de payload : on ne garde que l'historique récent, chaque message tronqué.
    .slice(-30)
    .map((m: { role: 'user' | 'assistant' | 'system'; content: string }) => ({
      role: m.role,
      content: m.content.length > 8000 ? m.content.slice(0, 8000) + '…' : m.content,
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
      // Défaut serveur : Claude (Anthropic)
      const anthropicProvider = createAnthropic({
        apiKey: process.env.ANTHROPIC_API_KEY || '',
      });
      modelInstance = anthropicProvider(llmSettings?.model || 'claude-opus-4-8');
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
