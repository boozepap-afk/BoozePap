-- ChupaHub Supabase core schema
create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  icon text,
  image_url text,
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
  abv numeric(5,2),
  country text,
  bottle_size text,
  price numeric(12,2) not null check (price >= 0),
  old_price numeric(12,2) check (old_price is null or old_price >= price),
  stock integer not null default 0 check (stock >= 0),
  sku text unique,
  barcode text,
  image_url text,
  gallery_urls text[] not null default '{}',
  is_featured boolean not null default false,
  is_top_seller boolean not null default false,
  is_new_arrival boolean not null default false,
  is_active boolean not null default true,
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
  subtotal numeric(12,2) not null default 0,
  delivery_fee numeric(10,2) not null default 0,
  discount_total numeric(10,2) not null default 0,
  total numeric(12,2) not null default 0,
  delivery_location_id uuid references public.delivery_locations(id) on delete set null,
  delivery_address text,
  gps_lat numeric(10,7),
  gps_lng numeric(10,7),
  gift_note text,
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

create index if not exists products_active_category_idx on public.products(is_active, category_id);
create index if not exists products_flags_idx on public.products(is_top_seller, is_new_arrival, is_featured);
create index if not exists orders_customer_idx on public.orders(customer_id, created_at desc);

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.admin_users au where au.user_id = auth.uid() and au.is_active = true);
$$;

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

create policy "Public read active categories" on public.categories for select using (is_active or public.is_admin());
create policy "Admin write categories" on public.categories for all using (public.is_admin()) with check (public.is_admin());
create policy "Public read active brands" on public.brands for select using (is_active or public.is_admin());
create policy "Admin write brands" on public.brands for all using (public.is_admin()) with check (public.is_admin());
create policy "Public read active products" on public.products for select using (is_active or public.is_admin());
create policy "Admin write products" on public.products for all using (public.is_admin()) with check (public.is_admin());
create policy "Public read active promotions" on public.promotions for select using (is_active or public.is_admin());
create policy "Admin write promotions" on public.promotions for all using (public.is_admin()) with check (public.is_admin());
create policy "Public read active banners" on public.homepage_banners for select using (is_active or public.is_admin());
create policy "Admin write banners" on public.homepage_banners for all using (public.is_admin()) with check (public.is_admin());
create policy "Customers read own profile" on public.customers for select using (user_id = auth.uid() or public.is_admin());
create policy "Customers update own profile" on public.customers for update using (user_id = auth.uid() or public.is_admin()) with check (user_id = auth.uid() or public.is_admin());
create policy "Customers insert own profile" on public.customers for insert with check (user_id = auth.uid() or public.is_admin());
create policy "Customers manage own locations" on public.delivery_locations for all using (public.is_admin() or customer_id in (select id from public.customers where user_id = auth.uid())) with check (public.is_admin() or customer_id in (select id from public.customers where user_id = auth.uid()));
create policy "Customers read own orders" on public.orders for select using (public.is_admin() or customer_id in (select id from public.customers where user_id = auth.uid()));
create policy "Customers create own orders" on public.orders for insert with check (public.is_admin() or customer_id in (select id from public.customers where user_id = auth.uid()));
create policy "Admin update orders" on public.orders for update using (public.is_admin()) with check (public.is_admin());
create policy "Order items visible to owner" on public.order_items for select using (public.is_admin() or order_id in (select o.id from public.orders o join public.customers c on c.id=o.customer_id where c.user_id=auth.uid()));
create policy "Order items insert by owner" on public.order_items for insert with check (public.is_admin() or order_id in (select o.id from public.orders o join public.customers c on c.id=o.customer_id where c.user_id=auth.uid()));
create policy "Admins read admin users" on public.admin_users for select using (public.is_admin());
create policy "Admins manage admin users" on public.admin_users for all using (public.is_admin()) with check (public.is_admin());

create trigger categories_updated_at before update on public.categories for each row execute function public.set_updated_at();
create trigger brands_updated_at before update on public.brands for each row execute function public.set_updated_at();
create trigger products_updated_at before update on public.products for each row execute function public.set_updated_at();
create trigger customers_updated_at before update on public.customers for each row execute function public.set_updated_at();
create trigger delivery_locations_updated_at before update on public.delivery_locations for each row execute function public.set_updated_at();
create trigger orders_updated_at before update on public.orders for each row execute function public.set_updated_at();
create trigger promotions_updated_at before update on public.promotions for each row execute function public.set_updated_at();
create trigger homepage_banners_updated_at before update on public.homepage_banners for each row execute function public.set_updated_at();
create trigger admin_users_updated_at before update on public.admin_users for each row execute function public.set_updated_at();

insert into storage.buckets (id, name, public) values ('product-images','product-images',true) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('homepage-banners','homepage-banners',true) on conflict (id) do nothing;

create policy "Public read product images" on storage.objects for select using (bucket_id = 'product-images');
create policy "Admin upload product images" on storage.objects for insert with check (bucket_id = 'product-images' and public.is_admin());
create policy "Admin update product images" on storage.objects for update using (bucket_id = 'product-images' and public.is_admin()) with check (bucket_id = 'product-images' and public.is_admin());
create policy "Admin delete product images" on storage.objects for delete using (bucket_id = 'product-images' and public.is_admin());
create policy "Public read banner images" on storage.objects for select using (bucket_id = 'homepage-banners');
create policy "Admin upload banner images" on storage.objects for insert with check (bucket_id = 'homepage-banners' and public.is_admin());
create policy "Admin update banner images" on storage.objects for update using (bucket_id = 'homepage-banners' and public.is_admin()) with check (bucket_id = 'homepage-banners' and public.is_admin());
create policy "Admin delete banner images" on storage.objects for delete using (bucket_id = 'homepage-banners' and public.is_admin());
