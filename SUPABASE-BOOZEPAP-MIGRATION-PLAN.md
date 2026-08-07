# Supabase BoozePap migration plan

## Scope and safety boundary

This document is a plan only. **No database reset, schema migration, table copy, or production Supabase change is part of the storefront rebrand.** The copied application continues to use the existing ChupaHub-compatible schema and the same environment-variable contract.

## Current application dependencies

Before connecting a BoozePap Supabase project, preserve and audit the existing objects described by the committed migrations in `supabase/migrations/`. The application currently depends on the established tables and relationships for:

- products, product variants, brands, categories, inventory and product images;
- homepage banners, homepage sections, promotions and editable store settings;
- customers, authentication-linked profiles, administrators and rewards;
- carts, checkout settings, delivery bands, orders and order items;
- discounts, scheduled pricing and order-management status updates;
- Supabase Storage buckets and their authenticated administrator policies.

The application queries in `src/lib/supabase.ts`, `src/lib/supabase-server.ts`, `src/lib/server/supabase-admin.ts`, and the admin routes/components are the compatibility contract. Existing table names, columns, functions, policies and storage paths must not be renamed merely for branding.

## Future connection procedure

1. **Inventory the target project.** Export a schema-only snapshot and list its migrations, tables, views, functions, triggers, RLS policies, storage buckets and Auth providers. Do not reset it.
2. **Compare migration history.** Compare the target project migration ledger with every migration under `supabase/migrations/`, in timestamp order. Resolve conflicts with new, forward-only, idempotent migrations; never edit an already-applied migration.
3. **Validate the schema contract.** Confirm all columns selected or written by the storefront, checkout and admin exist with compatible types, foreign keys and defaults. Do not add duplicate “BoozePap” versions of existing commerce tables.
4. **Preserve security.** Review RLS and Storage policies for anonymous catalog reads, authenticated customer access and administrator writes. Verify service-role credentials remain server-only.
5. **Move configuration, not code identifiers.** Point the copied deployment at the approved BoozePap project by setting the existing `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and server-side service-role environment variables. Keep existing local-storage keys and internal identifiers so returning carts and integrations remain compatible.
6. **Configure Auth.** Add `https://boozepap.com/auth/callback` and approved preview URLs to the Supabase redirect allow list. Verify Email and Google providers without creating a second authentication system.
7. **Verify Storage.** Confirm the existing product/banner bucket names and object paths expected by image upload code. Copy missing objects only through a separately approved, checksummed data-transfer procedure.
8. **Update editable content separately.** After backup and approval, update customer-visible `store_settings` values (store name, logo text, journal title and contact content) through the existing admin or a reviewed forward-only data statement. This is content maintenance, not a schema rename.
9. **Stage and test.** In a non-production preview connected to a safe target, test public catalog reads, sign-in, every admin CRUD flow, image upload/delete, discounts, homepage editing, cart, checkout, payment initiation/callback, order email, order management and delivery pricing.
10. **Cut over with rollback.** Take verified backups, record old environment values, schedule a controlled deployment, run smoke tests, and retain a rollback window. Never run `supabase db reset` against production.

## Required validation evidence

- Schema diff reviewed with no destructive or duplicate-table operations.
- RLS/policy review completed for public, authenticated and admin roles.
- Product/category/banner counts and representative records reconciled.
- Storage object counts and sampled checksums reconciled.
- Admin writes and storefront reads verified against the same records.
- Checkout creates an order and order items without mock or hardcoded catalog data.
- Auth callbacks, payment callbacks, email delivery and Maps restrictions use the BoozePap domain.

## Explicitly deferred

Production credentials, database changes, data transfer, migration execution, Supabase reset, Auth-provider changes and deployment cutover are deferred to a separately approved task.
