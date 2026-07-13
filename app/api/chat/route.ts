// ============================================================
// Mart Studio — AI Chat API Route
// ============================================================

import { streamText, type ModelMessage } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createClient } from '@supabase/supabase-js';
import { SYSTEM_PROMPT, getStepInstruction } from '@/lib/prompts/system-prompt';
import { captureServerError } from '@/lib/sentry-server';

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
  const { messages, currentStep, sessionData, llmSettings, mode, adminQuestions, stepKey, totalSteps } = body;

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
  const stepInstruction = getStepInstruction(currentStep || 1, { key: typeof stepKey === 'string' ? stepKey : undefined, total: typeof totalSteps === 'number' ? totalSteps : undefined });

  // Mode guidé : une seule question à la fois
  const modeInstruction = mode === 'guided'
    ? `\n\n## MODE GUIDÉ (prioritaire)\nPose UNE SEULE question à la fois. Attends la réponse de l'utilisateur avant de poser la suivante. N'affiche JAMAIS toutes les questions de l'étape d'un coup. Quand tu as couvert toutes les questions de l'étape, produis les blocs json:extract et une courte synthèse. Reste bref et conversationnel.`
    : mode === 'expert'
    ? `\n\n## MODE EXPERT / AUTONOME (prioritaire)\nL'utilisateur possède DÉJÀ des éléments (script SQL/SAS, DDL, description, MCD/ERD, fichiers/images). Ne présente PAS la liste des questions de l'étape. À la place :\n1. Invite-le une seule fois à te donner TOUT ce qu'il a (colle son script/DDL, sa description, ou importe un fichier/une image).\n2. Dès qu'il fournit quelque chose, EXTRAIS le MAXIMUM immédiatement — tous les types pertinents à la fois (context, entity, relation, attribute, kpi, rule, source…), pas seulement ceux de l'étape courante.\n3. Ensuite, pose UNIQUEMENT des questions CIBLÉES sur les éléments réellement MANQUANTS ou ambigus (ex. « il manque la clé primaire de X », « quelle cardinalité entre Y et Z ? »). N'énumère pas les questions standard de l'étape.\nReste concis et efficace ; laisse un maximum de liberté à l'utilisateur.`
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
  // On préserve les images (parts de type "file" media image) sous forme de
  // contenu multimodal, pour que Marty (vision) lise les captures de MCD/ERD.
  // On filtre les messages vides : Anthropic (Claude) rejette tout bloc vide.
  type InPart = { type: string; text?: string; url?: string; mediaType?: string };
  type OutContent = string | Array<{ type: 'text'; text: string } | { type: 'image'; image: string }>;
  const trunc = (t: string) => (t.length > 8000 ? t.slice(0, 8000) + '…' : t);
  const formattedMessages = messages
    .map((m: { role: string; content?: string; parts?: InPart[] }) => {
      const parts = m.parts || [];
      const text = m.content || parts.filter((p) => p.type === 'text').map((p) => p.text || '').join('');
      const images = parts.filter((p) => p.type === 'file' && (p.mediaType || '').startsWith('image/') && p.url).slice(0, 4);
      let content: OutContent;
      if (images.length) {
        const arr: Array<{ type: 'text'; text: string } | { type: 'image'; image: string }> = [];
        if (text.trim()) arr.push({ type: 'text', text: trunc(text) });
        images.forEach((p) => arr.push({ type: 'image', image: p.url as string }));
        content = arr;
      } else {
        content = trunc(text);
      }
      return { role: m.role as 'user' | 'assistant' | 'system', content };
    })
    .filter((m) => (Array.isArray(m.content) ? m.content.length > 0 : m.content.trim().length > 0))
    // Limite de payload : on ne garde que l'historique récent.
    .slice(-30) as ModelMessage[];

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
    if (llmSettings?.provider === 'anthropic') {
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
    } else if (llmSettings?.provider === 'openai') {
      const openaiProvider = createOpenAI({
        apiKey: process.env.OPENAI_API_KEY || '',
      });
      modelInstance = openaiProvider(llmSettings.model || 'gpt-4o');
    } else if (llmSettings?.provider === 'google') {
      // L'utilisateur a choisi explicitement Gemini (clé plateforme GEMINI_API_KEY).
      const googleProvider = createGoogleGenerativeAI({
        apiKey: process.env.GEMINI_API_KEY || '',
      });
      modelInstance = googleProvider(llmSettings.model || 'gemini-2.0-flash');
    } else {
      // Défaut serveur : Claude Opus (clé plateforme ANTHROPIC_API_KEY).
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
      captureServerError(error, { where: 'chat.streamText', provider: llmSettings?.provider, model: llmSettings?.model });
    },
  });

  return result.toUIMessageStreamResponse({
    // Remonte la consommation de tokens au client (affichée par Data Product).
    messageMetadata: ({ part }) => {
      if (part.type === 'finish') {
        const u = (part as { totalUsage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number } }).totalUsage;
        if (u) {
          const input = u.inputTokens ?? 0, output = u.outputTokens ?? 0;
          return { usage: { input, output, total: u.totalTokens ?? input + output } };
        }
      }
      return undefined;
    },
    onError: (error) => {
      captureServerError(error, { where: 'chat.stream' });
      const msg = error instanceof Error ? error.message : String(error);
      const low = msg.toLowerCase();
      const usingPlatformKey = !llmSettings?.apiKey; // clé plateforme partagée (offre gratuite)
      // 429 / quota = limite d'utilisation atteinte (souvent le quota GRATUIT partagé).
      const isQuota = low.includes('429') || low.includes('quota') || low.includes('rate limit')
        || low.includes('rate-limit') || low.includes('resource_exhausted') || low.includes('resource exhausted') || low.includes('too many requests');
      // 503 / overloaded = fournisseur momentanément surchargé (pas ta faute, transitoire).
      const isOverload = low.includes('overloaded') || low.includes('503') || low.includes('service unavailable') || low.includes('unavailable');
      // Clé refusée par le fournisseur (révoquée, faute de frappe, mauvais provider).
      // Cas fréquent : une ancienne clé personnelle est restée dans « Configuration LLM »
      // et prend le pas sur la clé de la plateforme.
      const isBadKey = low.includes('invalid x-api-key') || low.includes('invalid api key')
        || low.includes('incorrect api key') || low.includes('authentication_error')
        || low.includes('api key not valid') || low.includes('401') || low.includes('unauthorized');
      if (isBadKey) {
        return usingPlatformKey
          ? 'BADKEY::La clé IA de la plateforme est invalide ou expirée. Contactez l’administrateur (la clé serveur doit être renouvelée).'
          : 'BADKEY::Votre clé API personnelle est invalide ou a été révoquée. Ouvrez « Configuration LLM » et VIDEZ le champ « Clé API » pour repasser sur la clé de la plateforme (Claude Opus, incluse) — ou saisissez une clé valide.';
      }
      if (isQuota) {
        return usingPlatformKey
          ? 'QUOTA::La clé IA de la plateforme (partagée entre les utilisateurs) a atteint sa limite du moment. Réessayez dans un instant, ou ajoutez votre propre clé API dans « Configuration LLM » pour un accès dédié.'
          : 'QUOTA::Votre clé API a atteint sa limite d’utilisation. Vérifiez vos quotas/crédits chez le fournisseur.';
      }
      if (isOverload) {
        return 'OVERLOAD::Le service IA est momentanément surchargé côté fournisseur. Patientez quelques instants et réessayez — ce n’est pas une limite de votre côté.';
      }
      return `Erreur du fournisseur LLM : ${msg}`;
    },
  });
}
