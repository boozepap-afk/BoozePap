export function effectivePrice(item: {
  price: number;
  old_price?: number;
  discount_starts_at?: string;
  discount_ends_at?: string;
}) {
  const now = Date.now();
  const price = Number(item.price);
  const oldPrice =
    item.old_price == null ? undefined : Number(item.old_price);

  const hasDiscount =
    oldPrice !== undefined &&
    Number.isFinite(oldPrice) &&
    oldPrice > price;

  const active =
    hasDiscount &&
    (!item.discount_starts_at ||
      Date.parse(item.discount_starts_at) <= now) &&
    (!item.discount_ends_at ||
      Date.parse(item.discount_ends_at) > now);

  return {
    price: hasDiscount && !active ? oldPrice! : price,
    oldPrice: active ? oldPrice : undefined,
    active,
  };
}
