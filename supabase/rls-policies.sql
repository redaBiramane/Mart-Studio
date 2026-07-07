-- ============================================================
-- Mart Studio — Politiques RLS recommandées (à exécuter dans Supabase → SQL Editor)
-- Sécurise data_products, profiles, activity_logs.
-- La sécurité réelle repose ICI : le contrôle isAdmin côté React n'est que cosmétique.
-- ============================================================

-- Fonction utilitaire : l'utilisateur courant est-il admin ?
-- SECURITY DEFINER = ignore la RLS → évite la récursion sur profiles.
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- ------------------------------------------------------------
-- profiles
-- ------------------------------------------------------------
alter table public.profiles enable row level security;

-- Le rôle 'banned' doit être autorisé par la contrainte (bannissement)
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('user', 'admin', 'banned'));

drop policy if exists "profiles_select_self_or_admin" on public.profiles;
create policy "profiles_select_self_or_admin" on public.profiles
  for select using (id = auth.uid() or public.is_admin());

drop policy if exists "profiles_insert_self" on public.profiles;
create policy "profiles_insert_self" on public.profiles
  for insert with check (id = auth.uid());

drop policy if exists "profiles_update_self_or_admin" on public.profiles;
create policy "profiles_update_self_or_admin" on public.profiles
  for update using (id = auth.uid() or public.is_admin()) with check (true);

drop policy if exists "profiles_delete_admin" on public.profiles;
create policy "profiles_delete_admin" on public.profiles
  for delete using (public.is_admin());

-- ------------------------------------------------------------
-- data_products
-- ------------------------------------------------------------
alter table public.data_products enable row level security;

drop policy if exists "products_select_owner_or_admin" on public.data_products;
create policy "products_select_owner_or_admin" on public.data_products
  for select using (owner_id = auth.uid() or public.is_admin());

drop policy if exists "products_insert_owner" on public.data_products;
create policy "products_insert_owner" on public.data_products
  for insert with check (owner_id = auth.uid());

drop policy if exists "products_update_owner_or_admin" on public.data_products;
create policy "products_update_owner_or_admin" on public.data_products
  for update using (owner_id = auth.uid() or public.is_admin()) with check (true);

drop policy if exists "products_delete_owner_or_admin" on public.data_products;
create policy "products_delete_owner_or_admin" on public.data_products
  for delete using (owner_id = auth.uid() or public.is_admin());

-- ------------------------------------------------------------
-- activity_logs
-- ------------------------------------------------------------
alter table public.activity_logs enable row level security;

-- Chacun peut insérer sa propre activité ; lecture réservée à l'admin.
drop policy if exists "logs_insert_self" on public.activity_logs;
create policy "logs_insert_self" on public.activity_logs
  for insert with check (user_id = auth.uid());

drop policy if exists "logs_select_admin" on public.activity_logs;
create policy "logs_select_admin" on public.activity_logs
  for select using (public.is_admin());

-- ------------------------------------------------------------
-- step_questions — questions de l'atelier pilotées par l'admin
-- ------------------------------------------------------------
create table if not exists public.step_questions (
  id uuid primary key default gen_random_uuid(),
  step int not null check (step between 1 and 7),
  position int not null default 0,
  text text not null,
  created_at timestamptz not null default now()
);

alter table public.step_questions enable row level security;

-- Lecture par tout utilisateur authentifié (Marty + atelier en ont besoin)
drop policy if exists "step_questions_select_auth" on public.step_questions;
create policy "step_questions_select_auth" on public.step_questions
  for select using (auth.role() = 'authenticated');

-- Écriture (add/update/delete) réservée à l'admin
drop policy if exists "step_questions_write_admin" on public.step_questions;
create policy "step_questions_write_admin" on public.step_questions
  for all using (public.is_admin()) with check (public.is_admin());

-- ------------------------------------------------------------
-- activity_logs : réponses aux idées (admin -> utilisateur)
-- Permet à l'admin d'insérer un log ADRESSÉ à un autre utilisateur (idea_reply)
-- et à chacun de lire les logs qui le concernent (ses réponses).
-- ------------------------------------------------------------
drop policy if exists "logs_insert_self" on public.activity_logs;
create policy "logs_insert_self_or_admin" on public.activity_logs
  for insert with check (user_id = auth.uid() or public.is_admin());

drop policy if exists "logs_select_self" on public.activity_logs;
create policy "logs_select_self" on public.activity_logs
  for select using (user_id = auth.uid() or public.is_admin());

-- ============================================================
-- app_config : configuration globale (ex. étapes de l'atelier)
-- Lecture par tout utilisateur authentifié, écriture réservée aux admins.
-- ============================================================
create table if not exists public.app_config (
  key text primary key,
  value jsonb,
  updated_at timestamptz default now()
);
alter table public.app_config enable row level security;

drop policy if exists "app_config_select_auth" on public.app_config;
create policy "app_config_select_auth" on public.app_config
  for select using (auth.role() = 'authenticated');

drop policy if exists "app_config_write_admin" on public.app_config;
create policy "app_config_write_admin" on public.app_config
  for all using (public.is_admin()) with check (public.is_admin());
