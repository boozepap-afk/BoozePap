-- Make JSON checkout values adopt the live orders column types before insert.
-- This matters when status/payment_method are PostgreSQL enums: jsonb ->> returns
-- text, and PostgreSQL will not implicitly assign text to an enum column.
create or replace function public.create_checkout_order_atomic(order_payload jsonb, items_payload jsonb)
returns table(id uuid, order_number text, checkout_token uuid)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  typed_order public.orders;
  created public.orders;
begin
  if jsonb_typeof(items_payload) <> 'array' or jsonb_array_length(items_payload) = 0 then
    raise exception 'Checkout items must be a non-empty array';
  end if;

  -- PostgreSQL casts each JSON value to the actual live column type here. This
  -- avoids text-to-enum failures while remaining compatible with text columns.
  typed_order := jsonb_populate_record(null::public.orders, order_payload);

  insert into public.orders (
    customer_id, delivery_location_id, order_number, customer_name,
    customer_email, customer_phone, delivery_address, gps_lat, gps_lng,
    delivery_place_id, delivery_place_name, delivery_location_verified,
    delivery_instructions, gift_note, payment_method, payment_status, status,
    subtotal, delivery_fee, delivery_distance_km, discount_total, total
  ) values (
    typed_order.customer_id, typed_order.delivery_location_id,
    typed_order.order_number, typed_order.customer_name,
    typed_order.customer_email, typed_order.customer_phone,
    typed_order.delivery_address, typed_order.gps_lat, typed_order.gps_lng,
    typed_order.delivery_place_id, typed_order.delivery_place_name,
    coalesce(typed_order.delivery_location_verified, false),
    typed_order.delivery_instructions, typed_order.gift_note,
    typed_order.payment_method, typed_order.payment_status, typed_order.status,
    typed_order.subtotal, typed_order.delivery_fee,
    typed_order.delivery_distance_km, typed_order.discount_total,
    typed_order.total
  ) returning * into created;

  insert into public.order_items (
    order_id, product_id, variant_id, product_name, quantity, unit_price, line_total
  )
  select created.id, item.product_id, item.variant_id, item.product_name,
    item.quantity, item.unit_price, item.line_total
  from jsonb_to_recordset(items_payload) as item(
    product_id uuid, variant_id uuid, product_name text, quantity integer,
    unit_price numeric, line_total numeric
  );

  return query select created.id, created.order_number, created.checkout_token;
end;
$$;

revoke all on function public.create_checkout_order_atomic(jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.create_checkout_order_atomic(jsonb, jsonb)
  to service_role;

notify pgrst, 'reload schema';
