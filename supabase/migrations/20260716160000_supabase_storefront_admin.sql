-- Complete, non-destructive Supabase schema for the ChupaHub storefront and admin.
-- Safe to run repeatedly: existing rows and tables are preserved.
create extension if not exists pgcrypto;


-- Recreate any core table that was deleted before applying the additive changes below.
-- Existing tables and rows are left untouched.
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  icon text,
  image_url text,
  description text,
  color text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.brands (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  country text,
  logo_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.categories(id) on delete set null,
  brand_id uuid references public.brands(id) on delete set null,
  name text not null,
  slug text unique not null,
  description text,
  short_description text,
  abv numeric(5,2),
  country text,
  bottle_size text,
  price numeric(12,2) not null check (price >= 0),
  old_price numeric(12,2) check (old_price is null or old_price >= price),
  currency text not null default 'KES',
  stock integer not null default 0 check (stock >= 0),
  sku text unique,
  barcode text,
  image_url text,
  gallery_urls text[] not null default '{}',
  is_featured boolean not null default false,
  is_top_seller boolean not null default false,
  is_new_arrival boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete cascade,
  full_name text not null,
  phone text,
  email text,
  loyalty_points integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers(id) on delete set null,
  status text not null default 'pending' check (status in ('pending','paid','packing','out_for_delivery','completed','cancelled','refunded')),
  payment_method text not null default 'mpesa',
  payment_status text not null default 'pending',
  payment_reference text,
  subtotal numeric(12,2) not null default 0,
  delivery_fee numeric(10,2) not null default 0,
  discount_total numeric(10,2) not null default 0,
  total numeric(12,2) not null default 0,
  delivery_location_id uuid references public.delivery_locations(id) on delete set null,
  delivery_address text,
  gps_lat numeric(10,7),
  gps_lng numeric(10,7),
  gift_note text,
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  quantity integer not null check (quantity > 0),
  unit_price numeric(12,2) not null,
  line_total numeric(12,2) not null,
  created_at timestamptz not null default now()
);

create table if not exists public.promotions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  code text unique,
  description text,
  discount_type text not null check (discount_type in ('percent','fixed','bundle')),
  discount_value numeric(10,2) not null default 0,
  image_url text,
  badge_text text,
  button_label text,
  button_url text,
  sort_order integer not null default 0,
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.homepage_banners (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subtitle text,
  image_url text not null,
  mobile_image_url text,
  badge_text text,
  button_label text,
  button_url text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_users (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique not null references auth.users(id) on delete cascade,
  email text not null unique,
  role text not null default 'admin' check (role in ('admin','manager','editor')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Add storefront/admin fields without replacing existing tables.
alter table if exists public.categories
  add column if not exists description text,
  add column if not exists color text;

alter table if exists public.products
  add column if not exists short_description text,
  add column if not exists currency text not null default 'KES',
  add column if not exists sort_order integer not null default 0;

alter table if exists public.promotions
  add column if not exists image_url text,
  add column if not exists badge_text text,
  add column if not exists button_label text,
  add column if not exists button_url text,
  add column if not exists sort_order integer not null default 0;

alter table if exists public.homepage_banners
  add column if not exists mobile_image_url text,
  add column if not exists badge_text text;

alter table if exists public.orders
  add column if not exists payment_reference text,
  add column if not exists admin_notes text;

create table if not exists public.delivery_settings (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  min_distance_km numeric(8,2) not null default 0 check (min_distance_km >= 0),
  max_distance_km numeric(8,2) check (max_distance_km is null or max_distance_km >= min_distance_km),
  fee numeric(10,2) not null default 0 check (fee >= 0),
  estimated_minutes_min integer not null default 10 check (estimated_minutes_min >= 0),
  estimated_minutes_max integer not null default 50 check (estimated_minutes_max >= estimated_minutes_min),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists categories_active_sort_idx on public.categories(is_active, sort_order, name);
create index if not exists products_storefront_idx on public.products(is_active, sort_order, created_at desc);
create index if not exists banners_active_sort_idx on public.homepage_banners(is_active, sort_order);
create index if not exists promotions_active_dates_idx on public.promotions(is_active, starts_at, ends_at);
create index if not exists delivery_settings_active_sort_idx on public.delivery_settings(is_active, sort_order);
create index if not exists order_items_order_idx on public.order_items(order_id);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admin_users
    where user_id = auth.uid() and is_active = true
  );
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

alter table public.categories enable row level security;
alter table public.brands enable row level security;
alter table public.products enable row level security;
alter table public.customers enable row level security;
alter table public.delivery_locations enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.promotions enable row level security;
alter table public.homepage_banners enable row level security;
alter table public.admin_users enable row level security;
alter table public.delivery_settings enable row level security;

-- Restore public storefront reads when a table had been deleted and recreated.
drop policy if exists "Public read active categories" on public.categories;
create policy "Public read active categories" on public.categories for select using (is_active or public.is_admin());
drop policy if exists "Public read active brands" on public.brands;
create policy "Public read active brands" on public.brands for select using (is_active or public.is_admin());
drop policy if exists "Public read active products" on public.products;
create policy "Public read active products" on public.products for select using (is_active or public.is_admin());
drop policy if exists "Public read active promotions" on public.promotions;
create policy "Public read active promotions" on public.promotions for select using (is_active or public.is_admin());
drop policy if exists "Public read active banners" on public.homepage_banners;
create policy "Public read active banners" on public.homepage_banners for select using (is_active or public.is_admin());

-- Restore customer ownership policies when operational tables had been recreated.
drop policy if exists "Customers read own profile" on public.customers;
create policy "Customers read own profile" on public.customers for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
drop policy if exists "Customers update own profile" on public.customers;
create policy "Customers update own profile" on public.customers for update to authenticated
  using (user_id = auth.uid() or public.is_admin()) with check (user_id = auth.uid() or public.is_admin());
drop policy if exists "Customers insert own profile" on public.customers;
create policy "Customers insert own profile" on public.customers for insert to authenticated
  with check (user_id = auth.uid() or public.is_admin());
drop policy if exists "Customers manage own locations" on public.delivery_locations;
create policy "Customers manage own locations" on public.delivery_locations for all to authenticated
  using (public.is_admin() or customer_id in (select id from public.customers where user_id = auth.uid()))
  with check (public.is_admin() or customer_id in (select id from public.customers where user_id = auth.uid()));
drop policy if exists "Customers read own orders" on public.orders;
create policy "Customers read own orders" on public.orders for select to authenticated
  using (public.is_admin() or customer_id in (select id from public.customers where user_id = auth.uid()));
drop policy if exists "Customers create own orders" on public.orders;
create policy "Customers create own orders" on public.orders for insert to authenticated
  with check (public.is_admin() or customer_id in (select id from public.customers where user_id = auth.uid()));
drop policy if exists "Order items visible to owner" on public.order_items;
create policy "Order items visible to owner" on public.order_items for select to authenticated
  using (public.is_admin() or order_id in (select o.id from public.orders o join public.customers c on c.id = o.customer_id where c.user_id = auth.uid()));
drop policy if exists "Order items insert by owner" on public.order_items;
create policy "Order items insert by owner" on public.order_items for insert to authenticated
  with check (public.is_admin() or order_id in (select o.id from public.orders o join public.customers c on c.id = o.customer_id where c.user_id = auth.uid()));
drop policy if exists "Admins read admin users" on public.admin_users;
create policy "Admins read admin users" on public.admin_users for select to authenticated using (public.is_admin());
drop policy if exists "Admins manage admin users" on public.admin_users;
create policy "Admins manage admin users" on public.admin_users for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Recreate policies by name so this migration is rerunnable and can repair old policies.
drop policy if exists "Public read delivery settings" on public.delivery_settings;
create policy "Public read delivery settings" on public.delivery_settings
  for select using (is_active or public.is_admin());
drop policy if exists "Admin write delivery settings" on public.delivery_settings;
create policy "Admin write delivery settings" on public.delivery_settings
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Tighten all administrative writes to authenticated administrators.
drop policy if exists "Admin write categories" on public.categories;
create policy "Admin write categories" on public.categories for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists "Admin write brands" on public.brands;
create policy "Admin write brands" on public.brands for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists "Admin write products" on public.products;
create policy "Admin write products" on public.products for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists "Admin write promotions" on public.promotions;
create policy "Admin write promotions" on public.promotions for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists "Admin write banners" on public.homepage_banners;
create policy "Admin write banners" on public.homepage_banners for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists "Admin update orders" on public.orders;
create policy "Admin update orders" on public.orders for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists "Admin delete orders" on public.orders;
create policy "Admin delete orders" on public.orders for delete to authenticated
  using (public.is_admin());
drop policy if exists "Admin manage order items" on public.order_items;
create policy "Admin manage order items" on public.order_items for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Administrators can inspect all operational data; customers retain the old owner policies.
drop policy if exists "Admins read customers" on public.customers;
create policy "Admins read customers" on public.customers for select to authenticated using (public.is_admin());
drop policy if exists "Admins read delivery locations" on public.delivery_locations;
create policy "Admins read delivery locations" on public.delivery_locations for select to authenticated using (public.is_admin());
drop policy if exists "Admins read orders" on public.orders;
create policy "Admins read orders" on public.orders for select to authenticated using (public.is_admin());
drop policy if exists "Admins read order items" on public.order_items;
create policy "Admins read order items" on public.order_items for select to authenticated using (public.is_admin());

-- Restore timestamp triggers idempotently, including on recreated tables.
drop trigger if exists categories_updated_at on public.categories;
create trigger categories_updated_at before update on public.categories for each row execute function public.set_updated_at();
drop trigger if exists brands_updated_at on public.brands;
create trigger brands_updated_at before update on public.brands for each row execute function public.set_updated_at();
drop trigger if exists products_updated_at on public.products;
create trigger products_updated_at before update on public.products for each row execute function public.set_updated_at();
drop trigger if exists customers_updated_at on public.customers;
create trigger customers_updated_at before update on public.customers for each row execute function public.set_updated_at();
drop trigger if exists delivery_locations_updated_at on public.delivery_locations;
create trigger delivery_locations_updated_at before update on public.delivery_locations for each row execute function public.set_updated_at();
drop trigger if exists orders_updated_at on public.orders;
create trigger orders_updated_at before update on public.orders for each row execute function public.set_updated_at();
drop trigger if exists promotions_updated_at on public.promotions;
create trigger promotions_updated_at before update on public.promotions for each row execute function public.set_updated_at();
drop trigger if exists homepage_banners_updated_at on public.homepage_banners;
create trigger homepage_banners_updated_at before update on public.homepage_banners for each row execute function public.set_updated_at();
drop trigger if exists admin_users_updated_at on public.admin_users;
create trigger admin_users_updated_at before update on public.admin_users for each row execute function public.set_updated_at();
drop trigger if exists delivery_settings_updated_at on public.delivery_settings;
create trigger delivery_settings_updated_at before update on public.delivery_settings for each row execute function public.set_updated_at();

-- Required public image buckets. Existing objects and the legacy bucket are untouched.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('category-images', 'category-images', true, 10485760, array['image/jpeg','image/png','image/webp','image/gif']),
  ('product-images', 'product-images', true, 10485760, array['image/jpeg','image/png','image/webp','image/gif']),
  ('banner-images', 'banner-images', true, 10485760, array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Public reads and authenticated-admin-only writes for each managed bucket.
drop policy if exists "Public read ChupaHub images" on storage.objects;
create policy "Public read ChupaHub images" on storage.objects for select
  using (bucket_id in ('category-images','product-images','banner-images'));
drop policy if exists "Admins upload ChupaHub images" on storage.objects;
create policy "Admins upload ChupaHub images" on storage.objects for insert to authenticated
  with check (bucket_id in ('category-images','product-images','banner-images') and public.is_admin());
drop policy if exists "Admins update ChupaHub images" on storage.objects;
create policy "Admins update ChupaHub images" on storage.objects for update to authenticated
  using (bucket_id in ('category-images','product-images','banner-images') and public.is_admin())
  with check (bucket_id in ('category-images','product-images','banner-images') and public.is_admin());
drop policy if exists "Admins delete ChupaHub images" on storage.objects;
create policy "Admins delete ChupaHub images" on storage.objects for delete to authenticated
  using (bucket_id in ('category-images','product-images','banner-images') and public.is_admin());
