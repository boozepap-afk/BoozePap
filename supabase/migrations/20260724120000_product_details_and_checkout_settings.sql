-- Editable product-detail content and public checkout configuration.
-- Product facts remain on products; rich merchandising copy is stored in columns
-- so it can be safely edited in the existing administrator UI.
alter table public.products add column if not exists tasting_notes text;
alter table public.products add column if not exists pairing_suggestions text;

-- Keep the checkout configuration in the existing store_settings system rather
-- than introducing a second configuration table. Coordinates identify the shop
-- dispatch point used for an immediate distance estimate from the customer's pin.
insert into public.store_settings(key, value, description, is_public) values
('checkout', jsonb_build_object(
  'allow_cash', true,
  'allow_mpesa', true,
  'allow_card', true,
  'minimum_order', 0,
  'store_latitude', -1.286389,
  'store_longitude', 36.817223,
  'checkout_heading', 'Checkout',
  'delivery_address_label', 'Delivery address',
  'gift_notes_enabled', true,
  'coupons_enabled', true,
  'contact_phone', ''
), 'Customer checkout wording, payment methods and dispatch location', true)
on conflict (key) do nothing;
