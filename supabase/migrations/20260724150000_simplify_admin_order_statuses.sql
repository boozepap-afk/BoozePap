-- Preserve existing rows while allowing the concise admin workflow names.
alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check check (status in ('pending','pending_payment','accepted','confirmed','processing','dispatched','delivered','paid','packing','out_for_delivery','completed','rejected','cancelled','refunded'));
