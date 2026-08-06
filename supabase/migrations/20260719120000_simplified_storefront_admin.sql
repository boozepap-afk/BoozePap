-- Simplified ChupaHub catalog and content administration.
-- Additive and idempotent: it preserves all products, customers, orders and existing content.

create extension if not exists pgcrypto;

-- Retain the existing base product price for legacy storefront links while product_variants
-- supplies simple customer-facing sizes such as 250ml, 750ml and 1 litre.
alter table public.product_variants add column if not exists image_url text;
alter table public.order_items add column if not exists variant_id uuid references public.product_variants(id) on delete set null;

-- Every active administrator may manage the simple catalog and page-content records. Public
-- visitors can read only published rows through the existing active-row RLS policies.
create index if not exists product_variants_storefront_idx
  on public.product_variants(product_id, is_active, sort_order);

-- Generate a readable slug when an admin omits it. Application code also supplies a slug so
-- this is a safe backup for imports and Supabase Dashboard edits.
create or replace function public.chupahub_default_slug()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  base_slug text;
begin
  if new.slug is null or btrim(new.slug) = '' then
    base_slug := trim(both '-' from regexp_replace(lower(coalesce(new.name, 'item')), '[^a-z0-9]+', '-', 'g'));
    new.slug := coalesce(nullif(base_slug, ''), 'item') || '-' || left(replace(coalesce(new.id::text, gen_random_uuid()::text), '-', ''), 8);
  end if;
  return new;
end;
$$;

drop trigger if exists products_default_slug on public.products;
create trigger products_default_slug before insert or update of name, slug on public.products
for each row execute function public.chupahub_default_slug();
drop trigger if exists categories_default_slug on public.categories;
create trigger categories_default_slug before insert or update of name, slug on public.categories
for each row execute function public.chupahub_default_slug();

-- Seed editable website-content records only when missing. The storefront may safely use
-- these public settings for shared text, navigation, colours and payment wording.
insert into public.store_settings(key, value, description, is_public) values
  ('site_content', '{"about":"Fast, responsible alcohol delivery across Nairobi.","contact_phone":"","contact_email":"","header_notice":"Reliable delivery across Nairobi","footer_text":"Premium drinks delivered across Nairobi.","logo_text":"ChupaHub"}'::jsonb, 'Editable shared website text, header, footer and contact details.', true),
  ('site_design', '{"primary_color":"#f05a1a","accent_color":"#5b1b10","menu":["Shop","Offers","About","Contact"]}'::jsonb, 'Editable website colours and navigation labels.', true),
  ('homepage_sections', '{"categories":{"visible":true,"order":10,"heading":"Shop by category"},"top_sellers":{"visible":true,"order":20,"heading":"Top Sellers"},"new_arrivals":{"visible":true,"order":30,"heading":"New Arrivals"},"featured":{"visible":true,"order":40,"heading":"Featured Offers"}}'::jsonb, 'Homepage section headings, visibility and display order.', true)
on conflict (key) do nothing;
