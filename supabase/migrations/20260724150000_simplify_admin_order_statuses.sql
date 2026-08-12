-- Preserve existing rows while allowing the concise admin workflow names.
alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check (status in ('pending','awaiting_payment','paid','confirmed','preparing','ready_for_dispatch','dispatched','delivered','cancelled'));
