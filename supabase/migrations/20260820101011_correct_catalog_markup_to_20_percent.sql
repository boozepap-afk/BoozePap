-- Prices were previously raised by 25%. Multiplying by 0.96 changes that
-- increase to 20% of the original price: 1.25 * 0.96 = 1.20.
update public.products
set
  price = round(price * 0.96),
  old_price = case when old_price is null then null else round(old_price * 0.96, 0) end,
  updated_at = now()
where price is not null;
