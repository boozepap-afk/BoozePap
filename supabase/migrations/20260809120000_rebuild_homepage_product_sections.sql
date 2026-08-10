-- Reconcile the existing homepage section table without replacing catalogue data.
begin;

alter table public.homepage_product_sections
  add column if not exists rotation_enabled boolean not null default false,
  add column if not exists destination_url text;
alter table public.homepage_product_sections alter column rotation_enabled set default false;

alter table public.homepage_product_sections enable row level security;
grant usage on schema public to anon, authenticated;
grant select on public.homepage_product_sections to anon, authenticated;
grant insert, update, delete on public.homepage_product_sections to authenticated;

drop policy if exists "Public read active homepage product sections" on public.homepage_product_sections;
create policy "Public read active homepage product sections"
  on public.homepage_product_sections for select to anon, authenticated
  using (is_active or public.is_admin());

drop policy if exists "Admins manage homepage product sections" on public.homepage_product_sections;
create policy "Admins manage homepage product sections"
  on public.homepage_product_sections for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Expose only ranked product IDs. Sales and customer order data remain private.
create or replace function public.homepage_top_selling_product_ids(result_limit integer default 24)
returns table(product_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  with completed_sales as (
    select oi.product_id, sum(oi.quantity)::bigint as units_sold
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
    where o.status in ('completed', 'delivered') and oi.product_id is not null
    group by oi.product_id
  ), selection_mode as (
    select
      exists(select 1 from completed_sales) as has_sales,
      exists(select 1 from public.products where is_active and is_top_seller) as has_top_sellers,
      exists(select 1 from public.products where is_active and is_featured) as has_featured
  )
  select p.id
  from public.products p
  cross join selection_mode mode
  left join completed_sales sales on sales.product_id = p.id
  where p.is_active and (
    (mode.has_sales and sales.product_id is not null) or
    (not mode.has_sales and mode.has_top_sellers and p.is_top_seller) or
    (not mode.has_sales and not mode.has_top_sellers and mode.has_featured and p.is_featured) or
    (not mode.has_sales and not mode.has_top_sellers and not mode.has_featured)
  )
  order by
    case when mode.has_sales then coalesce(sales.units_sold, 0) end desc,
    p.created_at desc
  limit greatest(1, least(coalesce(result_limit, 24), 24));
$$;
revoke all on function public.homepage_top_selling_product_ids(integer) from public;
grant execute on function public.homepage_top_selling_product_ids(integer) to anon, authenticated;

do $$
declare
  wine_id uuid;
  gin_id uuid;
  beer_id uuid;
begin
  select id into wine_id from public.categories where lower(name) in ('wine','wines') or lower(slug) in ('wine','wines') order by (lower(slug) = 'wine') desc limit 1;
  if wine_id is null then insert into public.categories(name, slug, is_active) values ('Wine', 'wine', true) returning id into wine_id; end if;

  select id into gin_id from public.categories where lower(name) in ('gin','gins') or lower(slug) in ('gin','gins') order by (lower(slug) = 'gin') desc limit 1;
  if gin_id is null then insert into public.categories(name, slug, is_active) values ('Gin', 'gin', true) returning id into gin_id; end if;

  select id into beer_id from public.categories where lower(name) in ('beer','beers') or lower(slug) in ('beer','beers') order by (lower(slug) = 'beer') desc limit 1;
  if beer_id is null then insert into public.categories(name, slug, is_active) values ('Beer', 'beer', true) returning id into beer_id; end if;

  update public.categories set is_active = true where id in (wine_id, gin_id, beer_id);

  delete from public.homepage_product_sections;
  insert into public.homepage_product_sections
    (heading, category_id, product_ids, use_best_sellers, item_limit, sort_order, rotation_enabled, is_active, destination_url)
  values
    ('Top Selling', null, '{}', true, 8, 1, false, true, '/collections/top-sellers'),
    ('Wines', wine_id, '{}', false, 8, 2, false, true, '/wine'),
    ('Gins', gin_id, '{}', false, 8, 3, false, true, '/gin'),
    ('Beers', beer_id, '{}', false, 8, 4, false, true, '/beer');
end $$;

notify pgrst, 'reload schema';
commit;
