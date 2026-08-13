-- Reconcile the live database with the columns used by both checkout routes.
-- This migration is additive and safe to run repeatedly.
create extension if not exists pgcrypto;

alter table public.orders
  add column if not exists order_number text,
  add column if not exists checkout_token uuid not null default gen_random_uuid(),
  add column if not exists customer_name text,
  add column if not exists customer_email text,
  add column if not exists customer_phone text,
  add column if not exists delivery_address text,
  add column if not exists gps_lat numeric(10,7),
  add column if not exists gps_lng numeric(10,7),
  add column if not exists delivery_place_id text,
  add column if not exists delivery_place_name text,
  add column if not exists delivery_location_verified boolean not null default false,
  add column if not exists delivery_instructions text,
  add column if not exists gift_note text,
  add column if not exists payment_method text not null default 'cash',
  add column if not exists payment_status text not null default 'pending',
  add column if not exists status text not null default 'pending',
  add column if not exists subtotal numeric(12,2) not null default 0,
  add column if not exists delivery_fee numeric(12,2) not null default 0,
  add column if not exists delivery_distance_km numeric(10,2),
  add column if not exists discount_total numeric(12,2) not null default 0,
  add column if not exists total numeric(12,2) not null default 0;

create unique index if not exists orders_order_number_key
  on public.orders(order_number) where order_number is not null;
create unique index if not exists orders_checkout_token_key
  on public.orders(checkout_token);

alter table public.order_items
  add column if not exists variant_id uuid,
  add column if not exists product_name text,
  add column if not exists quantity integer,
  add column if not exists unit_price numeric(12,2),
  add column if not exists line_total numeric(12,2);

alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check check (
  status in ('pending','awaiting_payment','paid','confirmed','preparing',
             'ready_for_dispatch','dispatched','delivered','cancelled')
);

alter table public.orders drop constraint if exists orders_payment_status_check;
alter table public.orders add constraint orders_payment_status_check check (
  payment_status in ('pending','pending_payment','paid','failed','cancelled',
                     'timed_out','refunded','cash_due')
);

create or replace function public.create_checkout_order_atomic(
  order_payload jsonb,
  items_payload jsonb
)
returns table(id uuid, order_number text, checkout_token uuid)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  created public.orders;
begin
  if jsonb_typeof(items_payload) <> 'array'
     or jsonb_array_length(items_payload) = 0 then
    raise exception 'Checkout items must be a non-empty array';
  end if;

  insert into public.orders (
    customer_id, delivery_location_id, order_number, customer_name,
    customer_email, customer_phone, delivery_address, gps_lat, gps_lng,
    delivery_place_id, delivery_place_name, delivery_location_verified,
    delivery_instructions, gift_note, payment_method, payment_status, status,
    subtotal, delivery_fee, delivery_distance_km, discount_total, total
  ) values (
    nullif(order_payload->>'customer_id','')::uuid,
    nullif(order_payload->>'delivery_location_id','')::uuid,
    order_payload->>'order_number', order_payload->>'customer_name',
    nullif(order_payload->>'customer_email',''), order_payload->>'customer_phone',
    order_payload->>'delivery_address', nullif(order_payload->>'gps_lat','')::numeric,
    nullif(order_payload->>'gps_lng','')::numeric,
    nullif(order_payload->>'delivery_place_id',''),
    nullif(order_payload->>'delivery_place_name',''),
    coalesce((order_payload->>'delivery_location_verified')::boolean, false),
    nullif(order_payload->>'delivery_instructions',''),
    nullif(order_payload->>'gift_note',''), order_payload->>'payment_method',
    order_payload->>'payment_status', order_payload->>'status',
    (order_payload->>'subtotal')::numeric,
    (order_payload->>'delivery_fee')::numeric,
    nullif(order_payload->>'delivery_distance_km','')::numeric,
    (order_payload->>'discount_total')::numeric,
    (order_payload->>'total')::numeric
  ) returning * into created;

  insert into public.order_items (
    order_id, product_id, variant_id, product_name, quantity, unit_price, line_total
  )
  select created.id, line.product_id, line.variant_id, line.product_name,
         line.quantity, line.unit_price, line.line_total
  from jsonb_to_recordset(items_payload) as line(
    product_id uuid, variant_id uuid, product_name text,
    quantity integer, unit_price numeric, line_total numeric
  );

  return query select created.id, created.order_number, created.checkout_token;
end;
$$;

revoke all on function public.create_checkout_order_atomic(jsonb,jsonb)
  from public, anon, authenticated;
grant execute on function public.create_checkout_order_atomic(jsonb,jsonb)
  to service_role;

notify pgrst, 'reload schema';
