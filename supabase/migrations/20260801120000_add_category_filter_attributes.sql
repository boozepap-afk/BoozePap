-- Optional merchandising attributes used by category-specific storefront filters.
-- Nullable columns preserve every existing product and require no backfill.
alter table public.products
  add column if not exists grape_variety text,
  add column if not exists wine_type text,
  add column if not exists sweetness text,
  add column if not exists whisky_type text,
  add column if not exists age_statement text,
  add column if not exists beer_type text,
  add column if not exists pack_size text,
  add column if not exists product_format text,
  add column if not exists gin_style text,
  add column if not exists flavour text;

create index if not exists products_wine_type_idx on public.products (wine_type) where wine_type is not null;
create index if not exists products_grape_variety_idx on public.products (grape_variety) where grape_variety is not null;
