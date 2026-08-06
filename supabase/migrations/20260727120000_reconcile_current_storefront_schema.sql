-- Forward-only reconciliation for the current ChupaHub storefront.
-- Preserves all live rows. Does not seed, truncate, rename, or drop tables.
-- Apply only after comparing `supabase migration list --linked` with MIGRATIONS.md.

begin;

create extension if not exists pgcrypto;

-- Fail with a precise message rather than creating a partial second core.
do $$
declare
  required_table text;
begin
  foreach required_table in array array[
    'categories', 'brands', 'products', 'homepage_banners', 'promotions',
    'delivery_settings', 'store_settings'
  ] loop
    if to_regclass('public.' || required_table) is null then
      raise exception 'ChupaHub reconciliation stopped: required table public.% is missing. Reconcile migration history before applying this file.', required_table;
    end if;
  end loop;
end;
$$;

-- Columns read or written by the current storefront and admin.
alter table public.categories
  add column if not exists description text,
  add column if not exists color text,
  add column if not exists seo_title text,
  add column if not exists seo_description text,
  add column if not exists sort_order integer not null default 0,
  add column if not exists is_active boolean not null default true;

alter table public.products
  add column if not exists short_description text,
  add column if not exists currency text not null default 'KES',
  add column if not exists sort_order integer not null default 0,
  add column if not exists seo_title text,
  add column if not exists seo_description text,
  add column if not exists low_stock_threshold integer not null default 5,
  add column if not exists track_inventory boolean not null default true,
  add column if not exists tasting_notes text,
  add column if not exists pairing_suggestions text,
  add column if not exists discount_starts_at timestamptz,
  add column if not exists discount_ends_at timestamptz,
  add column if not exists discount_label text;

alter table public.homepage_banners
  add column if not exists mobile_image_url text,
  add column if not exists badge_text text,
  add column if not exists starts_at timestamptz,
  add column if not exists ends_at timestamptz,
  add column if not exists sort_order integer not null default 0,
  add column if not exists is_active boolean not null default true;

alter table public.promotions
  add column if not exists image_url text,
  add column if not exists badge_text text,
  add column if not exists button_label text,
  add column if not exists button_url text,
  add column if not exists sort_order integer not null default 0,
  add column if not exists starts_at timestamptz,
  add column if not exists ends_at timestamptz,
  add column if not exists is_active boolean not null default true;

create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  name text not null,
  sku text unique,
  option_values jsonb not null default '{}'::jsonb,
  price numeric(12,2) not null check (price >= 0),
  old_price numeric(12,2),
  stock integer not null default 0 check (stock >= 0),
  low_stock_threshold integer not null default 5 check (low_stock_threshold >= 0),
  image_url text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, name)
);

alter table public.product_variants
  add column if not exists old_price numeric(12,2),
  add column if not exists discount_starts_at timestamptz,
  add column if not exists discount_ends_at timestamptz,
  add column if not exists discount_label text,
  add column if not exists low_stock_threshold integer not null default 5,
  add column if not exists image_url text,
  add column if not exists is_active boolean not null default true,
  add column if not exists sort_order integer not null default 0;

create table if not exists public.homepage_product_sections (
  id uuid primary key default gen_random_uuid(),
  heading text not null,
  category_id uuid references public.categories(id) on delete set null,
  product_ids uuid[] not null default '{}',
  use_best_sellers boolean not null default false,
  item_limit integer not null default 8 check (item_limit between 1 and 24),
  sort_order integer not null default 0,
  rotation_enabled boolean not null default true,
  rotation_seconds integer not null default 6 check (rotation_seconds between 5 and 30),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Public read permissions. RLS still controls which rows are visible.
grant select on public.categories, public.brands, public.products,
  public.product_variants, public.homepage_banners, public.promotions,
  public.delivery_settings, public.store_settings,
  public.homepage_product_sections to anon, authenticated;

alter table public.categories enable row level security;
alter table public.brands enable row level security;
alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.homepage_banners enable row level security;
alter table public.promotions enable row level security;
alter table public.delivery_settings enable row level security;
alter table public.store_settings enable row level security;
alter table public.homepage_product_sections enable row level security;

drop policy if exists "Public read active categories" on public.categories;
create policy "Public read active categories" on public.categories for select to anon, authenticated using (is_active or public.is_admin());
drop policy if exists "Public read active brands" on public.brands;
create policy "Public read active brands" on public.brands for select to anon, authenticated using (is_active or public.is_admin());
drop policy if exists "Public read active products" on public.products;
create policy "Public read active products" on public.products for select to anon, authenticated using (is_active or public.is_admin());
drop policy if exists "Public read active variants" on public.product_variants;
create policy "Public read active variants" on public.product_variants for select to anon, authenticated using (is_active or public.is_admin());
drop policy if exists "Public read active banners" on public.homepage_banners;
create policy "Public read active banners" on public.homepage_banners for select to anon, authenticated using (is_active or public.is_admin());
drop policy if exists "Public read active promotions" on public.promotions;
create policy "Public read active promotions" on public.promotions for select to anon, authenticated using (is_active or public.is_admin());
drop policy if exists "Public read delivery settings" on public.delivery_settings;
create policy "Public read delivery settings" on public.delivery_settings for select to anon, authenticated using (is_active or public.is_admin());
drop policy if exists "Public read public settings" on public.store_settings;
create policy "Public read public settings" on public.store_settings for select to anon, authenticated using (is_public or public.is_admin());
drop policy if exists "Public read active homepage product sections" on public.homepage_product_sections;
create policy "Public read active homepage product sections" on public.homepage_product_sections for select to anon, authenticated using (is_active or public.is_admin());

create index if not exists products_storefront_idx on public.products(is_active, sort_order, created_at desc);
create index if not exists categories_active_sort_idx on public.categories(is_active, sort_order, name);
create index if not exists banners_active_sort_idx on public.homepage_banners(is_active, sort_order, created_at desc);
create index if not exists product_variants_product_idx on public.product_variants(product_id, is_active, sort_order);
create index if not exists homepage_sections_active_sort_idx on public.homepage_product_sections(is_active, sort_order);

commit;
