-- Additive reconciliation for every products field read by checkout.
alter table public.products
  add column if not exists old_price numeric(12,2) null,
  add column if not exists discount_starts_at timestamptz null,
  add column if not exists discount_ends_at timestamptz null,
  add column if not exists stock integer not null default 0,
  add column if not exists is_active boolean not null default true,
  add column if not exists track_inventory boolean not null default true;

alter table public.orders add column if not exists delivery_distance_km numeric(10,2) null;

-- Order and line creation is one PostgreSQL transaction: any line failure rolls
-- back the order insert. Only the server-side service role may execute it.
create or replace function public.create_checkout_order_atomic(order_payload jsonb, items_payload jsonb)
returns table(id uuid, order_number text, checkout_token uuid)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare created public.orders;
begin
  if jsonb_typeof(items_payload) <> 'array' or jsonb_array_length(items_payload) = 0 then
    raise exception 'Checkout items must be a non-empty array';
  end if;

  insert into public.orders (
    customer_id, delivery_location_id, order_number, customer_name, customer_email, customer_phone,
    delivery_address, gps_lat, gps_lng, delivery_place_id, delivery_place_name,
    delivery_location_verified, delivery_instructions, gift_note, payment_method, payment_status,
    status, subtotal, delivery_fee, delivery_distance_km, discount_total, total
  ) values (
    nullif(order_payload->>'customer_id','')::uuid, nullif(order_payload->>'delivery_location_id','')::uuid,
    order_payload->>'order_number', order_payload->>'customer_name', nullif(order_payload->>'customer_email',''),
    order_payload->>'customer_phone', order_payload->>'delivery_address', nullif(order_payload->>'gps_lat','')::numeric,
    nullif(order_payload->>'gps_lng','')::numeric, nullif(order_payload->>'delivery_place_id',''),
    nullif(order_payload->>'delivery_place_name',''), coalesce((order_payload->>'delivery_location_verified')::boolean,false),
    nullif(order_payload->>'delivery_instructions',''), nullif(order_payload->>'gift_note',''),
    order_payload->>'payment_method', order_payload->>'payment_status', order_payload->>'status',
    (order_payload->>'subtotal')::numeric, (order_payload->>'delivery_fee')::numeric,
    nullif(order_payload->>'delivery_distance_km','')::numeric, (order_payload->>'discount_total')::numeric,
    (order_payload->>'total')::numeric
  ) returning * into created;

  insert into public.order_items(order_id, product_id, variant_id, product_name, quantity, unit_price, line_total)
  select created.id, x.product_id, x.variant_id, x.product_name, x.quantity, x.unit_price, x.line_total
  from jsonb_to_recordset(items_payload) as x(product_id uuid, variant_id uuid, product_name text, quantity integer, unit_price numeric, line_total numeric);

  return query select created.id, created.order_number, created.checkout_token;
end;
$$;

revoke all on function public.create_checkout_order_atomic(jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.create_checkout_order_atomic(jsonb,jsonb) to service_role;

update public.store_settings
set value = value || jsonb_build_object('store_latitude', -1.293053, 'store_longitude', 36.787758)
where key = 'checkout';
