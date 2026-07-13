// ============================================================
// Mart Studio — API publique v1 : POST /api/v1/auth
// ------------------------------------------------------------
// Connexion des clients (extension VSCode) avec le COMPTE MARTY que
// l'utilisateur possède déjà sur martstudio.it.com. Aucune clé à
// distribuer : il saisit son email + mot de passe, on lui rend un jeton
// de session Supabase, qu'il présente ensuite à /api/v1/design.
//
//   { "email": "...", "password": "..." }   → connexion
//   { "refreshToken": "..." }               → renouvellement du jeton
//
// Le client n'a ainsi jamais besoin de connaître la configuration
// Supabase : tout passe par cette route.
// ============================================================

import { createClient } from '@supabase/supabase-js';
import { captureServerError } from '@/lib/sentry-server';

export const runtime = 'nodejs';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

export async function POST(req: Request): Promise<Response> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    return json({ error: 'Authentification non configurée côté serveur.' }, 503);
  }

  let body: { email?: unknown; password?: unknown; refreshToken?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Corps de requête JSON invalide.' }, 400);
  }

  const supa = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });

  try {
    // --- Renouvellement d'un jeton expiré ---
    if (typeof body.refreshToken === 'string' && body.refreshToken) {
      const { data, error } = await supa.auth.refreshSession({ refresh_token: body.refreshToken });
      if (error || !data.session) {
        return json({ error: 'Session expirée. Reconnectez-vous.' }, 401);
      }
      return json({
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
        email: data.session.user?.email || '',
      });
    }

    // --- Connexion email / mot de passe ---
    const email = typeof body.email === 'string' ? body.email.trim() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    if (!email || !password) {
      return json({ error: 'Email et mot de passe requis.' }, 400);
    }

    const { data, error } = await supa.auth.signInWithPassword({ email, password });
    if (error || !data.session) {
      return json({ error: 'Email ou mot de passe incorrect.' }, 401);
    }
    return json({
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      email: data.session.user?.email || email,
    });
  } catch (error) {
    captureServerError(error, { where: 'api.v1.auth' });
    return json({ error: 'Erreur d\'authentification.' }, 500);
  }
}
