-- Scheduled discounts extend existing price/old_price fields without changing base prices.
alter table public.products add column if not exists discount_starts_at timestamptz;
alter table public.products add column if not exists discount_ends_at timestamptz;
alter table public.products add column if not exists discount_label text;
alter table public.product_variants add column if not exists discount_starts_at timestamptz;
alter table public.product_variants add column if not exists discount_ends_at timestamptz;
alter table public.product_variants add column if not exists discount_label text;

alter table public.products drop constraint if exists products_discount_price_check;
alter table public.products add constraint products_discount_price_check check (old_price is null or (old_price > price and price >= 0));
alter table public.product_variants drop constraint if exists product_variants_discount_price_check;
alter table public.product_variants add constraint product_variants_discount_price_check check (old_price is null or (old_price > price and price >= 0));

create or replace function public.product_discount_active(p_old_price numeric, p_price numeric, p_starts_at timestamptz, p_ends_at timestamptz)
returns boolean language sql stable as $$
  select p_old_price is not null and p_old_price > p_price
    and (p_starts_at is null or p_starts_at <= now())
    and (p_ends_at is null or p_ends_at > now());
$$;
