// ============================================================
// Mart Studio — Socle commun des routes API publiques (/api/v1/*)
// ------------------------------------------------------------
// Authentification, limitation de débit, persistance et audit : mutualisés
// pour que /design et /import ne divergent jamais.
// ============================================================

import { createClient } from '@supabase/supabase-js';
import { createHash, timingSafeEqual } from 'node:crypto';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { captureServerError } from './sentry-server';
import type { WorkshopSession } from './types';

// Tarifs fournisseurs en dollars : taux indicatif pour afficher un ordre de
// grandeur en euros à l'utilisateur (sensibilisation au coût).
export const USD_TO_EUR = 0.92;

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

// ---- Limitation de débit (best-effort, par instance chaude) ----
const RL = new Map<string, number[]>();
const RL_MAX = 12;
const RL_WINDOW = 60_000;
function rateLimited(key: string): boolean {
  const now = Date.now();
  const arr = (RL.get(key) || []).filter((t) => now - t < RL_WINDOW);
  arr.push(now);
  RL.set(key, arr);
  return arr.length > RL_MAX;
}

// Comparaison à temps constant (évite les attaques temporelles sur la clé).
function safeEqual(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}

async function verifyMartyAccount(token: string): Promise<{ id: string; email: string; banned: boolean } | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return null;
  try {
    const supa = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await supa.auth.getUser(token);
    if (error || !data.user) return null;

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

export interface Caller {
  auditLabel: string;
  userId: string | null; // null = clé machine (pas de propriétaire)
}

// Authentifie l'appelant : compte Marty (jeton) OU clé d'API « marty_… » (CLI).
// Renvoie soit l'identité, soit la réponse d'erreur à retourner telle quelle.
export async function authenticate(req: Request): Promise<{ ok: true; caller: Caller } | { ok: false; res: Response }> {
  const provided = (
    req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ||
    req.headers.get('x-api-key') ||
    ''
  ).trim();
  if (!provided) {
    return { ok: false, res: json({ error: 'Authentification requise : connectez-vous avec votre compte Marty, ou fournissez une clé d\'API.' }, 401) };
  }

  let identity: string;
  let caller: Caller;

  if (provided.startsWith('marty_')) {
    const configured = (process.env.MARTY_API_KEYS || '').split(',').map((s) => s.trim()).filter(Boolean);
    if (!configured.some((k) => safeEqual(k, provided))) {
      return { ok: false, res: json({ error: 'Clé d\'API invalide.' }, 401) };
    }
    identity = provided;
    caller = { auditLabel: `api:key_${provided.slice(-4)}`, userId: null };
  } else {
    const user = await verifyMartyAccount(provided);
    if (!user) {
      return { ok: false, res: json({ error: 'Session expirée ou invalide. Reconnectez-vous à votre compte Marty.' }, 401) };
    }
    if (user.banned) {
      return { ok: false, res: json({ error: 'Compte désactivé. Contactez votre administrateur.' }, 403) };
    }
    identity = user.id;
    caller = { auditLabel: user.email, userId: user.id };
  }

  if (rateLimited(identity)) {
    return { ok: false, res: json({ error: 'Trop de requêtes. Réessayez dans une minute.' }, 429) };
  }
  return { ok: true, caller };
}

// ---- Sélection du modèle IA ----
export function pickModel(provider: 'anthropic' | 'google', model?: string) {
  if (provider === 'google') {
    if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY non configurée côté serveur.');
    const name = model || 'gemini-2.0-flash';
    return { instance: createGoogleGenerativeAI({ apiKey: process.env.GEMINI_API_KEY })(name), name };
  }
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY non configurée côté serveur.');
  const name = model || 'claude-opus-4-8';
  return { instance: createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY })(name), name };
}

// ---- Persistance : la génération devient un vrai Data Product ----
export async function saveProduct(session: WorkshopSession, userId: string, email: string): Promise<string | null> {
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
      console.error('[api.v1] enregistrement du produit impossible:', error.message);
      return null;
    }
    return session.id;
  } catch (e) {
    captureServerError(e, { where: 'api.v1.saveProduct' });
    return null; // ne jamais perdre la génération pour un échec d'enregistrement
  }
}

// ---- Audit best-effort (jamais bloquant) ----
export async function auditLog(
  action: string,
  caller: Caller,
  detail: string,
): Promise<void> {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceKey) return;
    const supa = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    await supa.from('activity_logs').insert({
      user_id: caller.userId,
      user_email: caller.auditLabel,
      action,
      detail,
    });
  } catch {
    /* l'audit ne doit jamais faire échouer la requête */
  }
}

// Extrait le premier objet JSON d'un texte (tolère un éventuel ```json … ```).
export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) throw new Error('Aucun JSON trouvé dans la réponse du modèle.');
  return JSON.parse(raw.slice(start, end + 1));
}

// Traduit une erreur fournisseur en réponse HTTP compréhensible.
export function providerError(error: unknown): Response {
  const msg = error instanceof Error ? error.message : String(error);
  const low = msg.toLowerCase();
  if (low.includes('non configurée')) return json({ error: msg }, 503);
  if (low.includes('429') || low.includes('quota') || low.includes('rate limit') || low.includes('resource_exhausted') || low.includes('too many requests')) {
    return json({ error: 'Quota du fournisseur IA atteint. Réessayez plus tard.' }, 429);
  }
  if (low.includes('overloaded') || low.includes('503') || low.includes('unavailable')) {
    return json({ error: 'Service IA momentanément surchargé. Réessayez dans un instant.' }, 503);
  }
  if (low.includes('json')) {
    return json({ error: 'Le modèle n\'a pas renvoyé un modèle exploitable. Reformulez et réessayez.' }, 502);
  }
  return json({ error: `Erreur de génération : ${msg}` }, 500);
}

export const DESIGN_SYSTEM = `Tu es Marty, Senior Data Architect / Data Modeler dans un grand groupe bancaire (Crédit Agricole).
Tu conçois un MODÈLE CONCEPTUEL DE DONNÉES complet et exploitable.

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
- Toute relation "plusieurs-à-plusieurs" est déclarée en cardinality "N:N".
- Noms de colonnes en snake_case, uniques par entité, sans abréviation obscure.
- Types SQL/Snowflake cohérents (VARCHAR(n), DECIMAL(p,s), DATE, TIMESTAMP, BOOLEAN, BIGINT…).
- Marque sensitive: true pour toute donnée personnelle/sensible (nom, email, téléphone, IBAN, identifiant client…).
- Descriptions métier en français, concises.
- Ne renvoie QUE le JSON.`;
