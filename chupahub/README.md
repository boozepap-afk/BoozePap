# Chupa Hub

Chupa Hub is a Next.js storefront and authenticated admin dashboard backed exclusively by Supabase in production.

## Production architecture

- **Frontend and admin:** Next.js in `frontend/`, deployed to Vercel
- **Database and authentication:** Supabase Postgres and Supabase Auth
- **Images:** Supabase Storage (`category-images`, `product-images`, and `banner-images`)
- **Source of truth:** Supabase. The legacy `backend/` PHP application is retained for history only and is not used by the Next.js application.

The small dataset in `frontend/src/lib/data.ts` is only displayed when no Supabase environment variables are configured. Once Vercel has Supabase configuration, empty or deleted database records are not replaced with local data.

## Local development

```bash
cd frontend
cp .env.example .env.local
npm ci
npm run dev
```

Set `NEXT_PUBLIC_SUPABASE_URL` and either `NEXT_PUBLIC_SUPABASE_ANON_KEY` or `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Never add a service-role or secret key to Vercel's public variables.

## Supabase setup

See [`../supabase/MIGRATIONS.md`](../supabase/MIGRATIONS.md) for the only
authoritative migration order, the production migration-history audit, and the
required live-schema checks. Use the Supabase CLI to inspect history and apply
only pending migrations; never use old SQL files as a blind recovery procedure.

Create the Auth user in **Supabase Dashboard → Authentication → Users**, then grant that existing user admin access in the SQL editor:

```sql
insert into public.admin_users (user_id, email, role, is_active)
select id, email, 'admin', true from auth.users where email = 'YOUR_EMAIL@example.com'
on conflict (user_id) do update set email = excluded.email, role = 'admin', is_active = true;
```

The dashboard is available at `/admin`. Authentication uses the public browser key to establish a user session; every read, write, delete, and Storage upload is authorized server-side by Supabase RLS. No service-role key is used by the application.
