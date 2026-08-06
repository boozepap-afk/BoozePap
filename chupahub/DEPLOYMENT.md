# Chupa Hub deployment checklist

## 1. Audit and apply Supabase migrations

Follow the single source of truth in [`../supabase/MIGRATIONS.md`](../supabase/MIGRATIONS.md).
Use `supabase migration list --linked` to audit production migration history
before applying pending migrations with `supabase db push`; do not manually
rerun historical SQL files.

## 2. Create the first administrator

Create the user in **Authentication → Users**, then run:

```sql
insert into public.admin_users (user_id, email, role, is_active)
select id, email, 'admin', true from auth.users where email = 'YOUR_EMAIL@example.com'
on conflict (user_id) do update set email = excluded.email, role = 'admin', is_active = true;
```

## 3. Configure Vercel

Import the repository with the Vercel root directory set to the repository root. Add:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`, or `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Do **not** add a Supabase service-role or secret key. Build with `npm run build` and deploy.

## 4. Verify production

1. Open `/` and confirm categories, banners, promotions, top sellers, new arrivals, and featured products appear.
2. Open `/admin`, sign in, and confirm the account is recognized as an administrator.
3. Upload one test category, product, or banner image and save the record.
4. Edit its price/title/active status and allow up to 30 seconds for storefront revalidation.
5. Confirm Customers, Orders, and Order items are readable and update a test order/payment status.

## Legacy backend

`chupahub/backend` is not part of the Vercel deployment and must not be configured as a second data source. It is retained only to avoid deleting historical repository files.

## Admin and checkout scope

The supported admin is the simple catalog/content administration interface. The
checkout page is not yet connected to an order-creation transaction, so do not
enable payment collection until the order persistence work described in
`supabase/MIGRATIONS.md` is complete.
