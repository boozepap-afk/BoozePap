# Chupa Hub Supabase migrations and production audit

This is the single authoritative migration and production-verification document.
It replaces the conflicting migration-order instructions previously split between
the root README and deployment checklist.

## Decision record

- **Admin direction:** retain the simple catalog/content admin introduced in PR
  24. It is the supported production UI. The advanced commerce schema remains
  in the database for compatibility, but its unverified dashboard sections are
  not restored by this cleanup.
- **Database source of truth:** Supabase Postgres, Auth, and Storage. The PHP
  backend under `chupahub/backend` is archived and must not be deployed or
  configured.
- **Checkout:** the current checkout page is presentation-only and is not an
  order-creation flow. Do not claim that cart localStorage is durable checkout
  persistence. Implement authenticated customer creation and an atomic order /
  order-items RPC before enabling payments in production.

## Migration order

For a **new project**, link the project and apply repository migrations with the
Supabase CLI. This uses migration history and applies only pending versions; do
not paste migration files into the SQL editor one by one.

```bash
supabase link --project-ref YOUR_PROJECT_REF
supabase migration list --linked
supabase db push
supabase migration list --linked
```

The repository order is the filename order below:

1. `20260715120000_chupahub_core.sql`
2. `20260716160000_supabase_storefront_admin.sql`
3. `20260716161000_seed_existing_storefront.sql`
4. `20260717120000_commerce_admin.sql`
5. `20260717130000_homepage_banner_public_read.sql`
6. `20260718120000_admin_dashboard_access.sql`
7. `20260719120000_simplified_storefront_admin.sql`
8. `20260720120000_add_editable_social_journal_content.sql`
9. `20260721120000_import_requested_spirits.sql`
10. `20260722120000_homepage_sections_and_stock_controls.sql`
11. `20260723120000_add_scheduled_product_discounts.sql`
12. `20260724120000_product_details_and_checkout_settings.sql`
13. `20260724130000_secure_checkout_payments_notifications.sql`
14. `20260724140000_admin_order_management.sql`
15. `20260724150000_simplify_admin_order_statuses.sql`
16. `20260725120000_google_delivery_locations.sql`
17. `20260726120000_live_admin_orders.sql`
18. `20260727120000_reconcile_current_storefront_schema.sql`

The first two schema uploads overlap. Read
[`MIGRATION_CONFLICT_AUDIT.md`](MIGRATION_CONFLICT_AUDIT.md) before applying
the reconciliation migration. Never manually rerun either core upload or the
legacy storefront seed.

For an **existing production project**, first run `supabase migration list
--linked` and preserve its output with the deployment record. If its history
does not match this repository, stop and reconcile the discrepancy; do not
blindly rerun old files. Apply only a new, reviewed migration after determining
the database state.

## Live database audit

1. Run `supabase migration list --linked` against production and compare it to
   the ordered list above.
2. In the production Supabase SQL editor, run
   [`LIVE_DATABASE_AUDIT.sql`](LIVE_DATABASE_AUDIT.sql). It is read-only.
3. Record the results in the deployment ticket. The audit must confirm:
   - `current_admin()`, `product_variants`, `store_settings`, `orders`, and
     `order_items` exist;
   - `order_items.variant_id` exists;
   - RLS is enabled and policies exist on the protected commerce/admin tables;
   - `category-images`, `product-images`, and `banner-images` are public;
   - expected public and admin Storage policies are present.

This repository has no production credentials and therefore cannot truthfully
assert the state of the live project. The SQL output is the required evidence.

## Production deployment checks

Vercel must use the repository root as its root directory (the root
`vercel.json` routing configuration) and have the following Production
environment variables from the same Supabase project:

- `NEXT_PUBLIC_SUPABASE_URL`
- exactly one of `NEXT_PUBLIC_SUPABASE_ANON_KEY` or
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

After redeployment, verify `/`, `/admin`, a product page, and `/checkout` on
the production URL. Confirm the public URL's project reference matches the
Supabase project's API URL. Never configure a service-role key in Vercel.
