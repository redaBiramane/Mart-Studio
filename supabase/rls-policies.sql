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
drop policy if exists "logs_insert_self_or_admin" on public.activity_logs;
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

-- ============================================================
-- product_members : partage d'un Data Product avec des collègues
-- Rôles : 'viewer' (lecture seule) ou 'editor' (collaboration).
-- ============================================================
-- NB : data_products.id est de type TEXT (IDs générés côté client) → product_id TEXT.
create table if not exists public.product_members (
  product_id text not null references public.data_products(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  user_email text not null,
  role       text not null default 'editor' check (role in ('viewer','editor')),
  invited_by uuid,
  created_at timestamptz not null default now(),
  primary key (product_id, user_id)
);

alter table public.product_members enable row level security;

-- Nettoie d'éventuelles versions typées uuid (si un ancien essai a partiellement tourné).
drop function if exists public.is_product_member(uuid);
drop function if exists public.is_product_editor(uuid);
drop function if exists public.is_product_owner(uuid);
drop function if exists public.share_product(uuid, text, text);

-- Helpers SECURITY DEFINER : évitent la récursion RLS entre data_products et product_members.
create or replace function public.is_product_member(pid text)
returns boolean language sql security definer set search_path = public as $$
  select exists (select 1 from public.product_members where product_id = pid and user_id = auth.uid());
$$;

create or replace function public.is_product_editor(pid text)
returns boolean language sql security definer set search_path = public as $$
  select exists (select 1 from public.product_members where product_id = pid and user_id = auth.uid() and role = 'editor');
$$;

create or replace function public.is_product_owner(pid text)
returns boolean language sql security definer set search_path = public as $$
  select exists (select 1 from public.data_products where id = pid and owner_id = auth.uid());
$$;

-- data_products : les membres peuvent LIRE ; les éditeurs peuvent aussi MODIFIER.
drop policy if exists "products_select_owner_or_admin" on public.data_products;
drop policy if exists "products_select_owner_admin_member" on public.data_products;
create policy "products_select_owner_admin_member" on public.data_products
  for select using (owner_id = auth.uid() or public.is_admin() or public.is_product_member(id));

drop policy if exists "products_update_owner_or_admin" on public.data_products;
drop policy if exists "products_update_owner_admin_editor" on public.data_products;
create policy "products_update_owner_admin_editor" on public.data_products
  for update using (owner_id = auth.uid() or public.is_admin() or public.is_product_editor(id)) with check (true);
-- (insert et delete restent réservés au propriétaire / admin — inchangés ci-dessus.)

-- product_members : lisible par le membre lui-même ou le propriétaire du produit ; géré par le propriétaire.
drop policy if exists "members_select" on public.product_members;
create policy "members_select" on public.product_members
  for select using (user_id = auth.uid() or public.is_product_owner(product_id) or public.is_admin());

drop policy if exists "members_write_owner" on public.product_members;
create policy "members_write_owner" on public.product_members
  for all using (public.is_product_owner(product_id) or public.is_admin())
          with check (public.is_product_owner(product_id) or public.is_admin());

-- RPC : partager par email. Cherche le profil du collègue (bypass RLS) puis crée le membre.
-- Renvoie : 'ok' | 'not_owner' | 'not_found' | 'self'.
create or replace function public.share_product(pid text, target_email text, member_role text default 'editor')
returns text language plpgsql security definer set search_path = public as $$
declare tgt uuid; pname text; sharer text; rolefr text;
begin
  if not (public.is_product_owner(pid) or public.is_admin()) then return 'not_owner'; end if;
  if member_role not in ('viewer','editor') then member_role := 'editor'; end if;
  select id into tgt from public.profiles where lower(email) = lower(trim(target_email)) limit 1;
  if tgt is null then return 'not_found'; end if;
  if tgt = auth.uid() then return 'self'; end if;
  insert into public.product_members (product_id, user_id, user_email, role, invited_by)
  values (pid, tgt, trim(target_email), member_role, auth.uid())
  on conflict (product_id, user_id) do update set role = excluded.role;

  -- Notifications (bypass RLS grâce à security definer)
  select name into pname from public.data_products where id = pid;
  select email into sharer from public.profiles where id = auth.uid();
  rolefr := case when member_role = 'viewer' then 'lecteur' else 'éditeur' end;
  insert into public.activity_logs (user_id, user_email, action, detail)
  values (tgt, target_email, 'shared_with', coalesce(pname, 'Un data product') || ' — partagé par ' || coalesce(sharer, 'un collègue') || ' (' || rolefr || ')');
  insert into public.activity_logs (user_id, user_email, action, detail)
  values (auth.uid(), sharer, 'shared', coalesce(pname, 'Un data product') || ' → ' || trim(target_email) || ' (' || rolefr || ')');
  return 'ok';
end;
$$;

grant execute on function public.share_product(text, text, text) to authenticated;

-- RPC : lister les utilisateurs de la base pour les proposer au partage
-- (bypass RLS de profiles ; renvoie tout le monde sauf soi-même et les bannis).
create or replace function public.list_shareable_users()
returns table (id uuid, email text, full_name text)
language sql security definer set search_path = public as $$
  select id, email, full_name from public.profiles
  where id <> auth.uid() and role <> 'banned'
  order by email;
$$;

grant execute on function public.list_shareable_users() to authenticated;
