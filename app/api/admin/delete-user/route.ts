import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

// Suppression complète d'un utilisateur (profil + Data Products + compte Auth).
// Nécessite SUPABASE_SERVICE_ROLE_KEY (serveur uniquement). L'appelant doit être admin.
export async function POST(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json({ error: 'service_role_not_configured' }, { status: 501 });
  }

  const token = req.headers.get('authorization')?.replace('Bearer ', '').trim();
  if (!token) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const userId = body?.userId as string | undefined;
  if (!userId) return NextResponse.json({ error: 'missing_userId' }, { status: 400 });

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Vérifier l'identité de l'appelant et son rôle admin
  const { data: caller, error: cErr } = await admin.auth.getUser(token);
  if (cErr || !caller.user) return NextResponse.json({ error: 'invalid_token' }, { status: 401 });
  if (caller.user.id === userId) return NextResponse.json({ error: 'cannot_delete_self' }, { status: 400 });

  const { data: prof } = await admin.from('profiles').select('role').eq('id', caller.user.id).single();
  if (prof?.role !== 'admin') return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  // Supprimer données puis compte Auth
  await admin.from('data_products').delete().eq('owner_id', userId);
  await admin.from('profiles').delete().eq('id', userId);
  const { error: dErr } = await admin.auth.admin.deleteUser(userId);
  if (dErr) return NextResponse.json({ error: dErr.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
