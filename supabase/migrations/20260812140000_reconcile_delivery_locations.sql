-- Reconcile production databases where the optional saved-address table is
-- absent or predates the checkout/account fields. This is additive only and
-- preserves every existing customer, address, and order.
create table if not exists public.delivery_locations (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers(id) on delete cascade,
  label text,
  address text not null,
  latitude numeric(10,7),
  longitude numeric(10,7),
  delivery_fee numeric(10,2) not null default 0,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.delivery_locations
  add column if not exists customer_id uuid references public.customers(id) on delete cascade,
  add column if not exists label text,
  add column if not exists address text,
  add column if not exists latitude numeric(10,7),
  add column if not exists longitude numeric(10,7),
  add column if not exists delivery_fee numeric(10,2) not null default 0,
  add column if not exists is_default boolean not null default false,
  add column if not exists apartment text,
  add column if not exists building text,
  add column if not exists delivery_instructions text,
  add column if not exists place_id text,
  add column if not exists place_name text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create index if not exists delivery_locations_customer_idx
  on public.delivery_locations(customer_id, is_default desc, updated_at desc);

alter table public.delivery_locations enable row level security;

drop policy if exists "Customers manage own locations" on public.delivery_locations;
create policy "Customers manage own locations" on public.delivery_locations
  for all to authenticated
  using (customer_id in (select id from public.customers where user_id = auth.uid()) or public.is_admin())
  with check (customer_id in (select id from public.customers where user_id = auth.uid()) or public.is_admin());

drop policy if exists "Admins read delivery locations" on public.delivery_locations;
create policy "Admins read delivery locations" on public.delivery_locations
  for select to authenticated using (public.is_admin());

-- Ask PostgREST to refresh immediately after the table/columns are reconciled.
notify pgrst, 'reload schema';
