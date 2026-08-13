-- Repair the order-status constraint without replacing the table or touching orders.
-- Earlier migration text omitted the required CHECK keyword.
alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check check (status in (
  'pending',
  'awaiting_payment',
  'paid',
  'confirmed',
  'preparing',
  'ready_for_dispatch',
  'dispatched',
  'delivered',
  'cancelled'
));

notify pgrst, 'reload schema';
