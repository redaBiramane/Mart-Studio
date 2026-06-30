-- ============================================================
-- Mart Studio — Schéma de base de données Supabase
-- À exécuter dans : Supabase → SQL Editor → New query → Run
-- ============================================================

-- ---- Table des profils (1 ligne par utilisateur authentifié) ----
create table if not exists public.profiles (
  id          uuid primary key references auth.users on delete cascade,
  email       text,
  full_name   text,
  role        text not null default 'user' check (role in ('user', 'admin')),
  created_at  timestamptz not null default now()
);

-- ---- Table des Data Products ----
-- La session complète de l'atelier est stockée en JSONB dans "data".
-- Quelques colonnes sont dénormalisées pour le listing et le filtrage.
create table if not exists public.data_products (
  id          text primary key,                 -- réutilise l'id ws_... généré par l'app
  owner_id    uuid not null references auth.users on delete cascade,
  owner_email text,
  name        text,
  domain      text,
  status      text not null default 'active',
  data        jsonb not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists data_products_owner_idx on public.data_products (owner_id);

-- ---- Journal d'activité (consultable par l'admin) ----
create table if not exists public.activity_logs (
  id          bigint generated always as identity primary key,
  user_id     uuid references auth.users on delete set null,
  user_email  text,
  action      text not null,          -- ex: 'login', 'create_product', 'complete_product'...
  detail      text,                   -- ex: nom du produit
  created_at  timestamptz not null default now()
);

create index if not exists activity_logs_created_idx on public.activity_logs (created_at desc);

-- ============================================================
-- Fonction utilitaire : l'utilisateur courant est-il admin ?
-- ============================================================
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- ============================================================
-- Création automatique du profil à l'inscription
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.email));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- Row Level Security
-- ============================================================
alter table public.profiles      enable row level security;
alter table public.data_products enable row level security;
alter table public.activity_logs enable row level security;

-- Profiles : chacun lit/modifie son profil ; l'admin lit tout
drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin" on public.profiles
  for select using (id = auth.uid() or public.is_admin());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (id = auth.uid());

-- L'admin peut modifier le rôle de n'importe quel utilisateur (promouvoir / rétrograder)
drop policy if exists "profiles_update_admin" on public.profiles;
create policy "profiles_update_admin" on public.profiles
  for update using (public.is_admin());

-- Data products : le propriétaire gère les siens ; l'admin lit tout
drop policy if exists "products_select_own_or_admin" on public.data_products;
create policy "products_select_own_or_admin" on public.data_products
  for select using (owner_id = auth.uid() or public.is_admin());

drop policy if exists "products_insert_own" on public.data_products;
create policy "products_insert_own" on public.data_products
  for insert with check (owner_id = auth.uid());

drop policy if exists "products_update_own" on public.data_products;
create policy "products_update_own" on public.data_products
  for update using (owner_id = auth.uid());

drop policy if exists "products_delete_own_or_admin" on public.data_products;
create policy "products_delete_own_or_admin" on public.data_products
  for delete using (owner_id = auth.uid() or public.is_admin());

-- Activity logs : chacun insère/lit les siens ; l'admin lit tout
drop policy if exists "logs_insert_own" on public.activity_logs;
create policy "logs_insert_own" on public.activity_logs
  for insert with check (user_id = auth.uid());

drop policy if exists "logs_select_own_or_admin" on public.activity_logs;
create policy "logs_select_own_or_admin" on public.activity_logs
  for select using (user_id = auth.uid() or public.is_admin());

-- ============================================================
-- Pour devenir admin, exécute (en remplaçant l'email) :
--   update public.profiles set role = 'admin' where email = 'toi@exemple.com';
-- ============================================================
