-- ============================================================
-- Mart Studio — PARTAGE de Data Products (à exécuter SEUL dans Supabase → SQL Editor)
-- Ce script est idempotent : tu peux le relancer autant de fois que nécessaire.
-- Il ne dépend que de is_admin() (déjà présent) et des tables data_products / profiles.
-- ============================================================

-- product_members : partage d'un Data Product avec des collègues
-- Rôles : 'viewer' (lecture seule) ou 'editor' (collaboration).
create table if not exists public.product_members (
  product_id uuid not null references public.data_products(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  user_email text not null,
  role       text not null default 'editor' check (role in ('viewer','editor')),
  invited_by uuid,
  created_at timestamptz not null default now(),
  primary key (product_id, user_id)
);

alter table public.product_members enable row level security;

-- Helpers SECURITY DEFINER : évitent la récursion RLS entre data_products et product_members.
create or replace function public.is_product_member(pid uuid)
returns boolean language sql security definer set search_path = public as $$
  select exists (select 1 from public.product_members where product_id = pid and user_id = auth.uid());
$$;

create or replace function public.is_product_editor(pid uuid)
returns boolean language sql security definer set search_path = public as $$
  select exists (select 1 from public.product_members where product_id = pid and user_id = auth.uid() and role = 'editor');
$$;

create or replace function public.is_product_owner(pid uuid)
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
create or replace function public.share_product(pid uuid, target_email text, member_role text default 'editor')
returns text language plpgsql security definer set search_path = public as $$
declare tgt uuid;
begin
  if not (public.is_product_owner(pid) or public.is_admin()) then return 'not_owner'; end if;
  if member_role not in ('viewer','editor') then member_role := 'editor'; end if;
  select id into tgt from public.profiles where lower(email) = lower(trim(target_email)) limit 1;
  if tgt is null then return 'not_found'; end if;
  if tgt = auth.uid() then return 'self'; end if;
  insert into public.product_members (product_id, user_id, user_email, role, invited_by)
  values (pid, tgt, trim(target_email), member_role, auth.uid())
  on conflict (product_id, user_id) do update set role = excluded.role;
  return 'ok';
end;
$$;

grant execute on function public.share_product(uuid, text, text) to authenticated;

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
