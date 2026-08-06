-- Preserve verified Google place data and clearly flag manual fallback orders.
alter table public.orders add column if not exists delivery_place_id text;
alter table public.orders add column if not exists delivery_place_name text;
alter table public.orders add column if not exists delivery_location_verified boolean not null default false;
alter table public.orders add column if not exists delivery_instructions text;
create index if not exists orders_location_verification_idx on public.orders(delivery_location_verified, created_at desc);
