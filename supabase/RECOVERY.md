# Supabase missing-table recovery

Use this procedure when Supabase reports an error such as:

```text
ERROR: 42P01: relation "public.categories" does not exist
```

## Recovery order

1. Open **Supabase Dashboard → SQL Editor → New query**.
2. Paste and run the complete contents of `migrations/20260716160000_supabase_storefront_admin.sql`.
3. Confirm that the schema query completed successfully.
4. Paste and run the complete contents of `migrations/20260716161000_seed_existing_storefront.sql`.
5. Do not run the seed before the schema migration, and do not use the older core migration as a recovery script.

The schema migration uses `create table if not exists`, `add column if not exists`, and policy/trigger replacement. It recreates deleted application tables while preserving tables and rows that still exist.

## Verification query

Run this after both migrations. Every `to_regclass` result should contain the displayed table name, and each count should be greater than zero after seeding.

```sql
select
  to_regclass('public.categories') as categories_table,
  to_regclass('public.products') as products_table,
  to_regclass('public.homepage_banners') as banners_table,
  to_regclass('public.promotions') as promotions_table,
  to_regclass('public.delivery_settings') as delivery_settings_table;

select
  (select count(*) from public.categories) as categories,
  (select count(*) from public.products) as products,
  (select count(*) from public.homepage_banners) as banners,
  (select count(*) from public.promotions) as promotions,
  (select count(*) from public.delivery_settings) as delivery_settings;
```

If an administrator account was deleted along with the tables, recreate the Auth user first and then restore its admin record using the command in `../chupahub/DEPLOYMENT.md`.
