-- Production commerce extensions for ChupaHub. Non-destructive and rerunnable.
create extension if not exists pgcrypto;

alter table public.categories add column if not exists parent_id uuid references public.categories(id) on delete set null;
alter table public.categories add column if not exists seo_title text;
alter table public.categories add column if not exists seo_description text;
alter table public.products add column if not exists low_stock_threshold integer not null default 5 check (low_stock_threshold >= 0);
alter table public.products add column if not exists track_inventory boolean not null default true;
alter table public.products add column if not exists seo_title text;
alter table public.products add column if not exists seo_description text;
alter table public.products add column if not exists weight_grams integer check (weight_grams is null or weight_grams >= 0);
alter table public.orders add column if not exists customer_email text;
alter table public.orders add column if not exists customer_phone text;
alter table public.orders add column if not exists tracking_code text;
alter table public.orders add column if not exists fulfilled_at timestamptz;

create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  name text not null,
  sku text unique,
  barcode text,
  option_values jsonb not null default '{}'::jsonb,
  price numeric(12,2) not null check (price >= 0),
  old_price numeric(12,2) check (old_price is null or old_price >= price),
  stock integer not null default 0 check (stock >= 0),
  low_stock_threshold integer not null default 5 check (low_stock_threshold >= 0),
  image_url text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  from_status text,
  to_status text not null,
  note text,
  changed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products(id) on delete set null,
  variant_id uuid references public.product_variants(id) on delete set null,
  quantity_change integer not null,
  reason text not null check (reason in ('sale','return','restock','adjustment','damage','transfer')),
  reference text,
  note text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (product_id is not null or variant_id is not null)
);

create table if not exists public.store_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  description text,
  is_public boolean not null default false,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  table_name text not null,
  record_id text,
  action text not null,
  old_data jsonb,
  new_data jsonb,
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists categories_parent_idx on public.categories(parent_id, sort_order);
create index if not exists variants_product_idx on public.product_variants(product_id, sort_order);
create index if not exists variants_low_stock_idx on public.product_variants(is_active, stock, low_stock_threshold);
create index if not exists products_low_stock_idx on public.products(is_active, stock, low_stock_threshold);
create index if not exists order_history_order_idx on public.order_status_history(order_id, created_at desc);
create index if not exists inventory_product_idx on public.inventory_movements(product_id, created_at desc);
create index if not exists audit_created_idx on public.audit_log(created_at desc);

alter table public.product_variants enable row level security;
alter table public.order_status_history enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.store_settings enable row level security;
alter table public.audit_log enable row level security;

drop policy if exists "Public read active variants" on public.product_variants;
create policy "Public read active variants" on public.product_variants for select using (is_active or public.is_admin());
drop policy if exists "Admins manage variants" on public.product_variants;
create policy "Admins manage variants" on public.product_variants for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "Admins manage order history" on public.order_status_history;
create policy "Admins manage order history" on public.order_status_history for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "Customers read own order history" on public.order_status_history;
create policy "Customers read own order history" on public.order_status_history for select to authenticated using (
  order_id in (select o.id from public.orders o join public.customers c on c.id = o.customer_id where c.user_id = auth.uid())
);
drop policy if exists "Admins manage inventory movements" on public.inventory_movements;
create policy "Admins manage inventory movements" on public.inventory_movements for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "Public read public settings" on public.store_settings;
create policy "Public read public settings" on public.store_settings for select using (is_public or public.is_admin());
drop policy if exists "Admins manage settings" on public.store_settings;
create policy "Admins manage settings" on public.store_settings for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "Admins read audit log" on public.audit_log;
create policy "Admins read audit log" on public.audit_log for select to authenticated using (public.is_admin());

create or replace function public.audit_admin_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if public.is_admin() then
    insert into public.audit_log(table_name, record_id, action, old_data, new_data, user_id)
    values (tg_table_name, coalesce(to_jsonb(new)->>'id', to_jsonb(new)->>'key', to_jsonb(old)->>'id', to_jsonb(old)->>'key'), tg_op,
      case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
      case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end, auth.uid());
  end if;
  return coalesce(new, old);
end $$;

create or replace function public.record_order_status_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.status is distinct from new.status then
    insert into public.order_status_history(order_id, from_status, to_status, changed_by)
    values (new.id, old.status, new.status, auth.uid());
    if new.status = 'completed' and new.fulfilled_at is null then new.fulfilled_at = now(); end if;
  end if;
  return new;
end $$;

drop trigger if exists product_variants_updated_at on public.product_variants;
create trigger product_variants_updated_at before update on public.product_variants for each row execute function public.set_updated_at();
drop trigger if exists store_settings_updated_at on public.store_settings;
create trigger store_settings_updated_at before update on public.store_settings for each row execute function public.set_updated_at();
drop trigger if exists orders_status_history on public.orders;
create trigger orders_status_history before update on public.orders for each row execute function public.record_order_status_change();

-- Auditing is deliberately limited to admin-managed commerce content.
do $$
declare table_name text;
begin
  foreach table_name in array array['products','product_variants','categories','promotions','homepage_banners','delivery_settings','store_settings'] loop
    execute format('drop trigger if exists admin_audit on public.%I', table_name);
    execute format('create trigger admin_audit after insert or update or delete on public.%I for each row execute function public.audit_admin_change()', table_name);
  end loop;
end $$;

insert into public.store_settings(key, value, description, is_public) values
('store', '{"name":"ChupaHub","currency":"KES","low_stock_default":5}'::jsonb, 'Core storefront settings', true),
('checkout', '{"allow_cash":true,"allow_mpesa":true,"minimum_order":0}'::jsonb, 'Checkout and payment options', true),
('notifications', '{"low_stock_email":true,"new_order_email":true}'::jsonb, 'Administrator notification preferences', false)
on conflict (key) do nothing;

-- Enable realtime invalidation for admin-managed tables without duplicate membership errors.
do $$
declare table_name text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach table_name in array array['products','product_variants','categories','orders','promotions','homepage_banners','delivery_settings','store_settings'] loop
      if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = table_name) then
        execute format('alter publication supabase_realtime add table public.%I', table_name);
      end if;
    end loop;
  end if;
end $$;
