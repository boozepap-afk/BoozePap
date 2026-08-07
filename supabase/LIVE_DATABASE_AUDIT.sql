-- BoozePap production database audit
--
-- Run this read-only script in the Supabase SQL editor against the intended
-- production project. Do not run migration files manually to "check" them:
-- first compare the linked project's migration history with the repository.

-- Migration history recorded by Supabase. Compare this list with
-- `supabase migration list --linked` from a linked local CLI project.
select version, name
from supabase_migrations.schema_migrations
order by version;

-- Required database objects. Every row must report `present`.
select required.object_name,
       case when required.object_kind = 'function'
              then to_regprocedure('public.current_admin()') is not null
            else to_regclass('public.' || required.object_name) is not null
       end as present
from (values
  ('current_admin', 'function'),
  ('categories', 'table'),
  ('homepage_banners', 'table'),
  ('products', 'table'),
  ('product_variants', 'table'),
  ('store_settings', 'table'),
  ('orders', 'table'),
  ('order_items', 'table')
) as required(object_name, object_kind)
order by required.object_name;

-- `order_items.variant_id` must be present.
select exists (
  select 1 from information_schema.columns
  where table_schema = 'public' and table_name = 'order_items' and column_name = 'variant_id'
) as order_items_has_variant_id;

-- All listed tables must have RLS enabled.
select c.relname as table_name, c.relrowsecurity as rls_enabled,
       count(p.policyname) as policy_count
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
left join pg_policies p on p.schemaname = n.nspname and p.tablename = c.relname
where n.nspname = 'public'
  and c.relname in ('admin_users', 'categories', 'homepage_banners', 'products', 'product_variants', 'store_settings', 'orders', 'order_items')
group by c.relname, c.relrowsecurity
order by c.relname;

-- Public storefront image buckets. `is_public` must be true for all three.
select id, public as is_public
from storage.buckets
where id in ('category-images', 'product-images', 'banner-images')
order by id;

-- Policy names provide an auditable confirmation that both customer/admin and
-- Storage access paths exist. Review this result rather than assuming grants
-- bypass RLS.
select schemaname, tablename, policyname, cmd, roles
from pg_policies
where (schemaname = 'public' and tablename in ('admin_users', 'categories', 'homepage_banners', 'products', 'product_variants', 'store_settings', 'orders', 'order_items'))
   or (schemaname = 'storage' and tablename = 'objects')
order by schemaname, tablename, policyname;
