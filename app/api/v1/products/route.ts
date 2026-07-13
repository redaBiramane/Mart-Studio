// ============================================================
// Mart Studio — API publique v1 : /api/v1/products
// ------------------------------------------------------------
//   GET /api/v1/products        → l'historique des Data Products de l'utilisateur
//   GET /api/v1/products?id=…   → un produit + ses livrables régénérés
//
// Les livrables sont RECONSTRUITS à partir du modèle enregistré (générateurs
// déterministes) : aucun appel à l'IA, donc aucun coût et aucune attente.
// ============================================================

import { createClient } from '@supabase/supabase-js';
import { buildDeliverables, buildQualityReport, type DesignModel } from '@/lib/generators';
import { captureServerError } from '@/lib/sentry-server';
import type { WorkshopSession } from '@/lib/types';

export const runtime = 'nodejs';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

// Identifie l'appelant par son jeton de compte Marty.
async function currentUser(req: Request): Promise<{ id: string; email: string } | null> {
  const token = (req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || '').trim();
  if (!token) return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return null;
  try {
    const supa = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await supa.auth.getUser(token);
    if (error || !data.user) return null;
    return { id: data.user.id, email: data.user.email || data.user.id };
  } catch {
    return null;
  }
}

// Reconstitue le modèle « design » à partir de la session enregistrée.
function sessionToModel(s: WorkshopSession): DesignModel {
  const nameOf = (id: string) => s.entities.find((e) => e.id === id)?.name || id;
  return {
    product: {
      name: s.productName || 'Data Product',
      businessProblem: s.businessProblem,
      objective: s.objective,
      domain: s.domain,
    },
    entities: s.entities.map((e) => ({ name: e.name, definition: e.definition, type: e.type })),
    attributes: s.attributes.map((a) => ({
      entityName: nameOf(a.entityId),
      name: a.name,
      type: a.type,
      description: a.description,
      isPK: a.isPrimaryKey,
      isFK: a.isForeignKey,
      required: a.isRequired,
      sensitive: a.isSensitive,
    })),
    relations: s.relations.map((r) => ({
      source: r.sourceEntityName,
      target: r.targetEntityName,
      cardinality: r.type,
      required: r.isRequired,
      description: r.description,
    })),
    kpis: s.kpis.map((k) => ({ name: k.name, formula: k.formula, description: k.description })),
    rules: s.businessRules.map((r) => ({ name: r.name, description: r.description, type: r.type })),
  };
}

export async function GET(req: Request): Promise<Response> {
  const user = await currentUser(req);
  if (!user) {
    return json({ error: 'Session expirée ou invalide. Reconnectez-vous à votre compte Marty.' }, 401);
  }

  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supaUrl || !serviceKey) return json({ error: 'Stockage non configuré côté serveur.' }, 503);
  const supa = createClient(supaUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  const id = new URL(req.url).searchParams.get('id');

  try {
    // --- Un produit précis : on rejoue ses livrables (sans IA) ---
    if (id) {
      const { data, error } = await supa
        .from('data_products')
        .select('id, name, data, owner_id, updated_at')
        .eq('id', id)
        .single();
      if (error || !data) return json({ error: 'Data Product introuvable.' }, 404);
      // Un utilisateur ne voit que SES produits.
      if (data.owner_id !== user.id) return json({ error: 'Accès refusé.' }, 403);

      const session = data.data as WorkshopSession;
      const model = sessionToModel(session);
      const quality = buildQualityReport(model);
      return json({
        productId: data.id,
        product: model.product,
        model: {
          entities: model.entities,
          attributes: model.attributes,
          relations: model.relations,
          kpis: model.kpis,
          rules: model.rules,
        },
        deliverables: buildDeliverables(model, quality),
        quality,
        usage: session.tokenUsage || { input: 0, output: 0, total: 0 },
        meta: {
          provider: session.llmProvider || '',
          model: session.llmModel || '',
          entities: model.entities.length,
          attributes: model.attributes.length,
          relations: model.relations.length,
          updatedAt: data.updated_at,
        },
      });
    }

    // --- La liste (historique) ---
    const { data, error } = await supa
      .from('data_products')
      .select('id, name, domain, updated_at, data')
      .eq('owner_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(30);
    if (error) return json({ error: 'Lecture de l\'historique impossible.' }, 500);

    const products = (data || []).map((p) => {
      const s = p.data as WorkshopSession;
      return {
        id: p.id,
        name: p.name || 'Data Product',
        domain: p.domain || '',
        updatedAt: p.updated_at,
        entities: s?.entities?.length || 0,
        tokens: s?.tokenUsage?.total || 0,
        model: s?.llmModel || '',
      };
    });
    return json({ products });
  } catch (e) {
    captureServerError(e, { where: 'api.v1.products' });
    return json({ error: 'Erreur serveur.' }, 500);
  }
}
