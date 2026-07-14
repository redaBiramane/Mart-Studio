// ============================================================
// Mart Studio — API publique v1 : POST /api/v1/design
// ------------------------------------------------------------
// « Data Architect en tant que service » : reçoit une description métier,
// appelle le LLM (Claude Opus par défaut) et renvoie un modèle conceptuel
// complet + ses livrables (SQL, DBML, dbt, dictionnaire, sémantique, ERD).
//
// Authentification (cf. lib/api-common) :
//   - compte Marty : jeton de session (extension VSCode) → audit nominatif ;
//   - clé « marty_… » : usages machine (CLI, scripts).
//
// La génération est enregistrée comme Data Product : l'utilisateur la retrouve
// dans son historique et sur martstudio.it.com.
// ============================================================

import { generateText } from 'ai';
import {
  authenticate, json, pickModel, saveProduct, auditLog,
  extractJson, providerError, DESIGN_SYSTEM, USD_TO_EUR,
} from '@/lib/api-common';
import { normalizeModel, buildDeliverables, buildQualityReport, buildWorkshopSession } from '@/lib/generators';
import { estimateCostUsd } from '@/lib/llm-labels';

export const maxDuration = 120;
export const runtime = 'nodejs';

export async function POST(req: Request): Promise<Response> {
  const auth = await authenticate(req);
  if (!auth.ok) return auth.res;
  const { caller } = auth;

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

  const provider: 'anthropic' | 'google' = body.options?.provider === 'google' ? 'google' : 'anthropic';

  try {
    const picked = pickModel(provider, body.options?.model);
    const result = await generateText({
      model: picked.instance,
      system: DESIGN_SYSTEM,
      prompt: `Description métier du Data Product à modéliser :\n\n${description}`,
      ...(provider === 'anthropic' ? {} : { temperature: 0.3 }),
      maxOutputTokens: 8000,
    });

    const dm = normalizeModel(extractJson(result.text));
    const quality = buildQualityReport(dm);
    const deliverables = buildDeliverables(dm, quality);

    const i = result.usage?.inputTokens ?? 0, o = result.usage?.outputTokens ?? 0;
    const usage = { input: i, output: o, total: result.usage?.totalTokens ?? i + o };

    // Coût estimé — affiché au client pour le sensibiliser.
    const usd = estimateCostUsd(picked.name, usage.input, usage.output);
    const cost = { usd: Number(usd.toFixed(4)), eur: Number((usd * USD_TO_EUR).toFixed(4)) };

    // Persistance (impossible pour une clé machine : pas de propriétaire).
    let productId: string | null = null;
    if (caller.userId) {
      const session = buildWorkshopSession(dm, {
        tokenUsage: { ...usage, requests: 1 },
        llmModel: picked.name,
        llmProvider: provider,
      });
      productId = await saveProduct(session, caller.userId, caller.auditLabel);
    }

    void auditLog('api_design', caller,
      `${dm.entities.length} entités • ${usage.total} tokens • ~${cost.eur.toFixed(2)} € • ${provider}`);

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
        model: picked.name,
        entities: dm.entities.length,
        attributes: dm.attributes.length,
        relations: dm.relations.length,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    return providerError(error);
  }
}

// GET : descriptif de l'endpoint (pratique pour tester).
export async function GET(): Promise<Response> {
  return json({
    endpoint: 'POST /api/v1/design',
    auth: 'Authorization: Bearer <jeton de compte Marty, ou clé marty_…>',
    body: { description: 'string (10..8000 caractères)', options: { provider: 'anthropic|google', model: 'optionnel' } },
    returns: ['productId', 'product', 'model', 'deliverables', 'quality', 'usage', 'cost', 'meta'],
    related: ['POST /api/v1/import (fichier SQL/SAS/CSV)', 'GET /api/v1/products (historique)'],
  });
}
