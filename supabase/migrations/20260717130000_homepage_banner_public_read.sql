-- Ensure the production storefront can read active homepage banners through the anon key.
alter table public.homepage_banners enable row level security;
grant select on table public.homepage_banners to anon, authenticated;

drop policy if exists "Public read active banners" on public.homepage_banners;
create policy "Public read active banners"
on public.homepage_banners
for select
to anon, authenticated
using (is_active = true or public.is_admin());

comment on policy "Public read active banners" on public.homepage_banners is
  'Allows the public storefront to read active banners with the anon key; authenticated admins can also inspect inactive records.';
