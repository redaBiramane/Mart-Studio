// ============================================================
// Mart Studio — Client Supabase
// ============================================================
// Si les variables d'environnement ne sont pas définies, l'app continue
// de fonctionner en mode local (localStorage), sans authentification.

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url as string, anonKey as string, {
      auth: { persistSession: true, autoRefreshToken: true },
    })
  : null;

export type UserRole = 'user' | 'admin';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  created_at: string;
}

export interface ActivityLog {
  id: number;
  user_id: string | null;
  user_email: string | null;
  action: string;
  detail: string | null;
  created_at: string;
}
