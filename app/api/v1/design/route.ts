// ============================================================
// Mart Studio — API publique v1 : POST /api/v1/design
// ------------------------------------------------------------
// « Data Architect en tant que service » : reçoit une description
// métier, appelle le LLM (Claude Opus par défaut) et renvoie un
// modèle conceptuel complet + livrables (SQL, DBML, dbt, dictionnaire).
//
// Authentification : clé d'API dédiée (≠ compte utilisateur) fournie via
//   Authorization: Bearer <clé>   ou   x-api-key: <clé>
// Les clés autorisées sont listées (séparées par des virgules) dans la
// variable d'environnement serveur MARTY_API_KEYS.
//
// À encadrer : quotas (limite best-effort par instance ici) + audit
// (journalisé dans activity_logs via la clé service Supabase).
// ============================================================

import { generateText } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createClient } from '@supabase/supabase-js';
import { createHash, timingSafeEqual } from 'node:crypto';
import { normalizeModel, buildDeliverables, buildQualityReport, buildWorkshopSession } from '@/lib/generators';
import { estimateCostUsd } from '@/lib/llm-labels';
import type { WorkshopSession } from '@/lib/types';
import { captureServerError } from '@/lib/sentry-server';

export const maxDuration = 120;
export const runtime = 'nodejs';

// Les tarifs des fournisseurs sont en dollars : taux indicatif pour afficher un
// ordre de grandeur en euros à l'utilisateur (sensibilisation au coût).
const USD_TO_EUR = 0.92;

// ---- Limitation de débit (best-effort, par instance chaude) ----
// Pour un quota distribué robuste, brancher Upstash Ratelimit / KV.
const RL = new Map<string, number[]>();
const RL_MAX = 12;          // requêtes de génération
const RL_WINDOW = 60_000;   // par minute et par clé
function rateLimited(key: string): boolean {
  const now = Date.now();
  const arr = (RL.get(key) || []).filter((t) => now - t < RL_WINDOW);
  arr.push(now);
  RL.set(key, arr);
  return arr.length > RL_MAX;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

// Comparaison à temps constant (évite les attaques temporelles sur la clé).
function safeEqual(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}

// Vérifie un jeton de session Supabase (compte Marty) et renvoie l'identité réelle.
// Même mécanisme que /api/chat : l'utilisateur se connecte avec le compte qu'il a déjà.
async function verifyMartyAccount(token: string): Promise<{ id: string; email: string; banned: boolean } | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return null;
  try {
    const supa = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await supa.auth.getUser(token);
    if (error || !data.user) return null;

    // Un compte banni ne doit plus pouvoir consommer l'IA.
    let banned = false;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (serviceKey) {
      const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
      const { data: profile } = await admin.from('profiles').select('role').eq('id', data.user.id).single();
      banned = profile?.role === 'banned';
    }
    return { id: data.user.id, email: data.user.email || data.user.id, banned };
  } catch {
    return null;
  }
}

// Extrait le premier objet JSON d'un texte (tolère un éventuel ```json … ```).
function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) throw new Error('Aucun JSON trouvé dans la réponse du modèle.');
  return JSON.parse(raw.slice(start, end + 1));
}

const DESIGN_SYSTEM = `Tu es Marty, Senior Data Architect / Data Modeler dans un grand groupe bancaire (Crédit Agricole).
À partir d'une description métier, tu conçois un MODÈLE CONCEPTUEL DE DONNÉES complet et exploitable.

Tu réponds STRICTEMENT par un objet JSON valide (aucun texte, aucune explication, aucun bloc markdown), au format EXACT suivant :
{
  "product": { "name": "...", "businessProblem": "...", "objective": "...", "domain": "..." },
  "entities": [ { "name": "Client", "definition": "...", "type": "transactional|reference|event|aggregate" } ],
  "attributes": [ { "entityName": "Client", "name": "nom", "type": "VARCHAR(120)", "description": "...", "isPK": false, "isFK": false, "required": true, "sensitive": false } ],
  "relations": [ { "source": "Compte", "target": "Client", "cardinality": "1:1|1:N|N:1|N:N", "required": true, "description": "..." } ],
  "kpis": [ { "name": "...", "formula": "...", "description": "..." } ],
  "rules": [ { "name": "...", "type": "validation|calculation|constraint|temporal|exception", "description": "..." } ]
}

Règles de conception (impératives) :
- Chaque entité a une clé primaire technique et stable (isPK: true, type BIGINT, nom "<entite>_id" en snake_case).
- N'émets PAS de colonnes de clé étrangère : les FK sont générées à partir des "relations".
- Toute relation "plusieurs-à-plusieurs" est déclarée en cardinality "N:N" (la table d'association est générée automatiquement).
- Noms de colonnes en snake_case, uniques par entité, sans abréviation obscure.
- Types SQL/Snowflake cohérents avec la donnée (VARCHAR(n), DECIMAL(p,s), DATE, TIMESTAMP, BOOLEAN, BIGINT…).
- Marque sensitive: true pour toute donnée personnelle/sensible (nom, email, téléphone, IBAN, identifiant client…).
- Descriptions métier en français, concises.
- Déduis des attributs métier raisonnables pour chaque entité ; reste fidèle au domaine décrit, n'invente pas d'entités hors sujet.
- Ne renvoie QUE le JSON.`;

export async function POST(req: Request): Promise<Response> {
  // --- Authentification par clé d'API ---
  const configured = (process.env.MARTY_API_KEYS || '')
    .split(',').map((s) => s.trim()).filter(Boolean);
  const provided = (
    req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ||
    req.headers.get('x-api-key') ||
    ''
  ).trim();
  if (!provided) {
    return json({ error: 'Authentification requise : connectez-vous avec votre compte Marty, ou fournissez une clé d\'API.' }, 401);
  }

  // Deux identités possibles :
  //  - clé d'API « marty_… » (CLI, scripts, intégrations machine) ;
  //  - jeton de session Supabase (extension VSCode / compte Marty) → identité réelle.
  let identity: string;   // clé de limitation de débit
  let auditLabel: string; // ce qui apparaît dans le journal
  let userId: string | null = null;

  if (provided.startsWith('marty_')) {
    if (!configured.some((k) => safeEqual(k, provided))) {
      return json({ error: 'Clé d\'API invalide.' }, 401);
    }
    identity = provided;
    auditLabel = `api:key_${provided.slice(-4)}`;
  } else {
    const user = await verifyMartyAccount(provided);
    if (!user) {
      return json({ error: 'Session expirée ou invalide. Reconnectez-vous à votre compte Marty.' }, 401);
    }
    if (user.banned) {
      return json({ error: 'Compte désactivé. Contactez votre administrateur.' }, 403);
    }
    identity = user.id;
    userId = user.id;
    auditLabel = user.email;
  }

  if (rateLimited(identity)) {
    return json({ error: 'Trop de requêtes. Réessayez dans une minute.' }, 429);
  }

  // --- Validation de la requête ---
  let body: { description?: unknown; options?: { provider?: string; model?: string } };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Corps de requête JSON invalide.' }, 400);
  }
  const description = typeof body.description === 'string' ? body.description.trim() : '';
  if (description.length < 10) {
    return json({ error: 'Le champ "description" est requis (au moins 10 caractères).' }, 400);
  }
  if (description.length > 8000) {
    return json({ error: 'Description trop longue (max 8000 caractères).' }, 400);
  }

  // --- Sélection du modèle (Claude Opus par défaut) ---
  const provider = body.options?.provider === 'google' ? 'google' : 'anthropic';
  let model;
  if (provider === 'google') {
    if (!process.env.GEMINI_API_KEY) return json({ error: 'GEMINI_API_KEY non configurée côté serveur.' }, 503);
    model = createGoogleGenerativeAI({ apiKey: process.env.GEMINI_API_KEY })(body.options?.model || 'gemini-2.0-flash');
  } else {
    if (!process.env.ANTHROPIC_API_KEY) return json({ error: 'ANTHROPIC_API_KEY non configurée côté serveur.' }, 503);
    model = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY })(body.options?.model || 'claude-opus-4-8');
  }

  // --- Génération ---
  try {
    const result = await generateText({
      model,
      system: DESIGN_SYSTEM,
      prompt: `Description métier du Data Product à modéliser :\n\n${description}`,
      ...(provider === 'anthropic' ? {} : { temperature: 0.3 }),
      maxOutputTokens: 8000,
    });

    const parsed = extractJson(result.text);
    const dm = normalizeModel(parsed);
    const quality = buildQualityReport(dm);
    const deliverables = buildDeliverables(dm, quality);

    const usage = {
      input: result.usage?.inputTokens ?? 0,
      output: result.usage?.outputTokens ?? 0,
      total: result.usage?.totalTokens ?? ((result.usage?.inputTokens ?? 0) + (result.usage?.outputTokens ?? 0)),
    };

    // Coût estimé de la génération — affiché au client pour le sensibiliser.
    const modelName = provider === 'google'
      ? (body.options?.model || 'gemini-2.0-flash')
      : (body.options?.model || 'claude-opus-4-8');
    const usd = estimateCostUsd(modelName, usage.input, usage.output);
    const cost = { usd: Number(usd.toFixed(4)), eur: Number((usd * USD_TO_EUR).toFixed(4)) };

    // --- Persistance : la génération devient un vrai Data Product ---
    // L'utilisateur la retrouve dans son historique ET sur martstudio.it.com, où il
    // peut poursuivre l'atelier. (Seulement pour un compte : une clé machine n'a pas
    // de propriétaire à qui rattacher le produit.)
    let productId: string | null = null;
    if (userId) {
      const session = buildWorkshopSession(dm, {
        tokenUsage: { input: usage.input, output: usage.output, total: usage.total, requests: 1 },
        llmModel: modelName,
        llmProvider: provider,
      });
      productId = await saveProduct(session, userId, auditLabel);
    }

    // --- Audit best-effort (non bloquant) ---
    void auditLog(auditLabel, userId, dm.entities.length, usage.total, provider, cost.eur);

    return json({
      productId,
      product: dm.product,
      model: {
        entities: dm.entities,
        attributes: dm.attributes,
        relations: dm.relations,
        kpis: dm.kpis,
        rules: dm.rules,
      },
      deliverables,
      quality,
      usage,
      cost,
      meta: {
        provider,
        model: provider === 'google' ? (body.options?.model || 'gemini-2.0-flash') : (body.options?.model || 'claude-opus-4-8'),
        entities: dm.entities.length,
        attributes: dm.attributes.length,
        relations: dm.relations.length,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    captureServerError(error, { where: 'api.v1.design', provider });
    const msg = error instanceof Error ? error.message : String(error);
    const low = msg.toLowerCase();
    if (low.includes('429') || low.includes('quota') || low.includes('rate limit') || low.includes('resource_exhausted') || low.includes('too many requests')) {
      return json({ error: 'Quota du fournisseur IA atteint. Réessayez plus tard.' }, 429);
    }
    if (low.includes('overloaded') || low.includes('503') || low.includes('unavailable')) {
      return json({ error: 'Service IA momentanément surchargé. Réessayez dans un instant.' }, 503);
    }
    if (low.includes('json')) {
      return json({ error: 'Le modèle n\'a pas renvoyé un modèle exploitable. Reformulez la description et réessayez.' }, 502);
    }
    return json({ error: `Erreur de génération : ${msg}` }, 500);
  }
}

// Enregistre la génération dans data_products (même format que l'atelier du site,
// pour que le produit soit ouvrable et modifiable sur martstudio.it.com).
async function saveProduct(session: WorkshopSession, userId: string, email: string): Promise<string | null> {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceKey) return null;
    const supa = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { error } = await supa.from('data_products').upsert({
      id: session.id,
      owner_id: userId,
      owner_email: email,
      name: session.productName || 'Data Product',
      domain: session.domain || null,
      status: session.status,
      data: session,
      updated_at: new Date().toISOString(),
    });
    if (error) {
      console.error('[api.v1.design] enregistrement du produit impossible:', error.message);
      return null;
    }
    return session.id;
  } catch (e) {
    captureServerError(e, { where: 'api.v1.design.saveProduct' });
    return null; // ne jamais perdre la génération pour un échec d'enregistrement
  }
}

// Journalise l'appel dans activity_logs (clé service = droits d'écriture).
async function auditLog(label: string, userId: string | null, entities: number, tokens: number, provider: string, eur: number): Promise<void> {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceKey) return;
    const supa = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    await supa.from('activity_logs').insert({
      user_id: userId,
      user_email: label,
      action: 'api_design',
      detail: `${entities} entités • ${tokens} tokens • ~${eur.toFixed(2)} € • ${provider}`,
    });
  } catch {
    // Audit best-effort : ne jamais faire échouer la requête pour un échec de log.
  }
}

// Petite aide : GET renvoie un descriptif de l'endpoint (pratique pour tester).
export async function GET(): Promise<Response> {
  return json({
    endpoint: 'POST /api/v1/design',
    auth: 'Authorization: Bearer <clé> (ou en-tête x-api-key)',
    body: { description: 'string (10..8000 caractères)', options: { provider: 'anthropic|google (défaut: anthropic)', model: 'optionnel' } },
    returns: ['product', 'model{entities,attributes,relations,kpis,rules}', 'deliverables{sql,dbml,dbt,dictionary}', 'usage', 'meta'],
  });
}
