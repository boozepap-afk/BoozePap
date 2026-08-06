-- ChupaHub admin dashboard access hardening.
-- Safe to run multiple times. Grants API privileges while RLS keeps writes admin-only.

create extension if not exists pgcrypto;

grant usage on schema public to anon, authenticated;

create table if not exists public.admin_users (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique not null references auth.users(id) on delete cascade,
  email text not null unique,
  role text not null default 'admin' check (role in ('admin','manager','editor')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'categories', 'brands', 'products', 'product_variants', 'promotions', 'homepage_banners',
    'delivery_settings', 'store_settings'
  ] loop
    if to_regclass(format('public.%I', table_name)) is not null then
      execute format('grant select on table public.%I to anon, authenticated', table_name);
    end if;
  end loop;

  foreach table_name in array array[
    'customers', 'delivery_locations', 'orders', 'order_items', 'order_status_history',
    'inventory_movements', 'audit_log', 'admin_users'
  ] loop
    if to_regclass(format('public.%I', table_name)) is not null then
      execute format('grant select on table public.%I to authenticated', table_name);
    end if;
  end loop;

  foreach table_name in array array[
    'categories', 'brands', 'products', 'product_variants', 'promotions', 'homepage_banners',
    'delivery_settings', 'store_settings', 'orders', 'order_items', 'order_status_history',
    'inventory_movements'
  ] loop
    if to_regclass(format('public.%I', table_name)) is not null then
      execute format('grant insert, update, delete on table public.%I to authenticated', table_name);
    end if;
  end loop;
end $$;

grant usage, select on all sequences in schema public to authenticated;

create or replace function public.current_admin()
returns table (
  id uuid,
  user_id uuid,
  email text,
  role text,
  is_active boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select au.id, au.user_id, au.email, au.role, au.is_active
  from public.admin_users au
  where au.user_id = auth.uid()
    and au.is_active = true
  limit 1;
$$;

revoke all on function public.current_admin() from public;
grant execute on function public.current_admin() to authenticated;

drop policy if exists "Admins read own admin profile" on public.admin_users;
create policy "Admins read own admin profile"
on public.admin_users
for select
to authenticated
using (user_id = auth.uid() and is_active = true);

comment on function public.current_admin() is
  'Returns the active admin_users row for the authenticated Supabase user so /admin can verify access without exposing service-role credentials.';
