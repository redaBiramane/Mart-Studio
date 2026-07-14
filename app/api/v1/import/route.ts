// ============================================================
// Mart Studio — API publique v1 : POST /api/v1/import
// ------------------------------------------------------------
// Reverse engineering à partir d'un FICHIER existant (SQL, SAS, CSV, texte).
//
//   { "filename": "schema.sql", "content": "CREATE TABLE …", "description": "(optionnel)" }
//
// Deux chemins :
//  1. Le fichier contient du DDL SQL (CREATE TABLE…) → parsé de façon
//     DÉTERMINISTE (lib/ddl). Aucun appel IA : gratuit, instantané, et aucune
//     limite de taille. C'est le cas idéal.
//  2. Sinon (SAS, CSV, description libre) → le contenu est soumis au modèle IA,
//     qui en déduit le modèle.
// ============================================================

import { generateText } from 'ai';
import { parseDDL } from '@/lib/ddl';
import {
  authenticate, json, pickModel, saveProduct, auditLog,
  extractJson, providerError, DESIGN_SYSTEM, USD_TO_EUR,
} from '@/lib/api-common';
import {
  normalizeModel, buildDeliverables, buildQualityReport, buildWorkshopSession,
  type DesignModel,
} from '@/lib/generators';
import { estimateCostUsd } from '@/lib/llm-labels';

export const maxDuration = 120;
export const runtime = 'nodejs';

const MAX_CONTENT = 200_000; // 200 Ko de texte : large pour un DDL, borne les abus

// Le fichier contient-il un vrai DDL exploitable sans IA ?
function looksLikeDDL(content: string): boolean {
  return /create\s+(or\s+replace\s+)?(table|view)\s/i.test(content);
}

// DDL → modèle, sans IA.
function ddlToModel(content: string, filename: string): DesignModel | null {
  const parsed = parseDDL(content);
  if (!parsed.tables.length) return null;

  const model: DesignModel = {
    product: {
      name: filename.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim() || 'Modèle importé',
      objective: `Modèle rétro-conçu à partir de ${filename}.`,
      domain: '',
    },
    entities: parsed.tables.map((t) => ({ name: t.name, definition: `Table importée depuis ${filename}.`, type: 'transactional' })),
    attributes: parsed.tables.flatMap((t) =>
      t.columns.map((c) => ({
        entityName: t.name,
        name: c.name,
        type: c.type,
        description: '',
        isPK: c.isPrimaryKey,
        isFK: c.isForeignKey,
        required: c.isPrimaryKey,
        sensitive: false,
      })),
    ),
    // Le parseur donne source = table référencée (côté 1), target = table portant la FK (côté N).
    relations: parsed.relations.map((r) => ({
      source: r.source,
      target: r.target,
      cardinality: '1:N',
      required: true,
      description: `${r.target}.${r.fkColumn} → ${r.source}.${r.refColumn}`,
    })),
    kpis: [],
    rules: [],
  };
  return model;
}

export async function POST(req: Request): Promise<Response> {
  const auth = await authenticate(req);
  if (!auth.ok) return auth.res;
  const { caller } = auth;

  let body: { filename?: unknown; content?: unknown; description?: unknown; options?: { provider?: string; model?: string } };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Corps de requête JSON invalide.' }, 400);
  }

  const filename = typeof body.filename === 'string' ? body.filename.trim() : 'fichier';
  const content = typeof body.content === 'string' ? body.content : '';
  const description = typeof body.description === 'string' ? body.description.trim() : '';

  if (!content.trim()) return json({ error: 'Le champ "content" (contenu du fichier) est requis.' }, 400);
  if (content.length > MAX_CONTENT) {
    return json({ error: `Fichier trop volumineux (max ${MAX_CONTENT / 1000} Ko de texte).` }, 400);
  }

  const provider: 'anthropic' | 'google' = body.options?.provider === 'google' ? 'google' : 'anthropic';

  try {
    let dm: DesignModel;
    let usage = { input: 0, output: 0, total: 0 };
    let modelName = '';
    let source: 'ddl' | 'ia' = 'ddl';

    const direct = looksLikeDDL(content) ? ddlToModel(content, filename) : null;

    if (direct) {
      // Chemin déterministe : aucun appel IA, aucun coût, aucune limite de taille.
      dm = normalizeModel(direct);
      if (description) dm.product.objective = description;
    } else {
      // Chemin IA : le fichier n'est pas un DDL (SAS, CSV, notes…).
      source = 'ia';
      const picked = pickModel(provider, body.options?.model);
      modelName = picked.name;
      const prompt = [
        description ? `Contexte métier fourni par l'utilisateur :\n${description}\n` : '',
        `Voici le contenu du fichier « ${filename} ». Déduis-en le modèle de données (entités, attributs, types, clés, relations).`,
        `Si c'est un script (SAS, SQL, Python…), analyse les tables lues/écrites et leurs colonnes.`,
        `Si c'est un CSV, la première ligne donne les colonnes : déduis les types à partir des valeurs.`,
        `\n--- DÉBUT DU FICHIER ---\n${content.slice(0, 60_000)}\n--- FIN DU FICHIER ---`,
      ].filter(Boolean).join('\n');

      const result = await generateText({
        model: picked.instance,
        system: DESIGN_SYSTEM,
        prompt,
        ...(provider === 'anthropic' ? {} : { temperature: 0.3 }),
        maxOutputTokens: 8000,
      });
      dm = normalizeModel(extractJson(result.text));
      const i = result.usage?.inputTokens ?? 0, o = result.usage?.outputTokens ?? 0;
      usage = { input: i, output: o, total: result.usage?.totalTokens ?? i + o };
    }

    const quality = buildQualityReport(dm);
    const deliverables = buildDeliverables(dm, quality);

    const usd = source === 'ia' ? estimateCostUsd(modelName, usage.input, usage.output) : 0;
    const cost = { usd: Number(usd.toFixed(4)), eur: Number((usd * USD_TO_EUR).toFixed(4)) };

    let productId: string | null = null;
    if (caller.userId) {
      const session = buildWorkshopSession(dm, {
        tokenUsage: { ...usage, requests: source === 'ia' ? 1 : 0 },
        llmModel: modelName || undefined,
        llmProvider: source === 'ia' ? provider : undefined,
      });
      productId = await saveProduct(session, caller.userId, caller.auditLabel);
    }

    void auditLog('api_import', caller,
      `${filename} • ${source === 'ddl' ? 'DDL (sans IA)' : 'IA'} • ${dm.entities.length} entités • ${usage.total} tokens • ~${cost.eur.toFixed(2)} €`);

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
        source,                       // « ddl » = parsé sans IA (gratuit), « ia » = déduit par le modèle
        provider: source === 'ia' ? provider : '',
        model: modelName,
        filename,
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
