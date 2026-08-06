-- Preserve the existing orders table while supporting realtime admin refreshes.
alter table public.orders add column if not exists updated_at timestamptz not null default now();

-- Add orders to the existing Supabase Realtime publication exactly once.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'orders'
  ) then
    alter publication supabase_realtime add table public.orders;
  end if;
end $$;

-- Keep the established status values and allow the complete admin workflow.
alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check check (status in (
  'pending','pending_payment','paid','accepted','confirmed','processing','dispatched',
  'delivered','rejected','cancelled','packing','out_for_delivery','completed','refunded'
));
