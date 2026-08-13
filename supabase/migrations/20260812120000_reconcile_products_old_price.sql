-- Reconcile databases where products predates the storefront discount fields.
-- This migration is additive: existing products and prices remain untouched.
alter table public.products
  add column if not exists old_price numeric(12,2) null;

-- PostgreSQL CHECK constraints accept NULL, while rejecting negative values.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.products'::regclass
      and conname = 'products_old_price_nonnegative'
  ) then
    alter table public.products
      add constraint products_old_price_nonnegative
      check (old_price >= 0);
  end if;
end
$$;
