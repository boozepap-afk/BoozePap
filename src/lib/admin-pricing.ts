/** A manual price edit replaces any previous discount schedule. */
export function manualPriceUpdate(price: number) {
  if (!Number.isFinite(price) || price < 0) throw new Error('Enter a valid product price.');
  return { price, old_price: null, discount_starts_at: null, discount_ends_at: null, discount_label: null };
}

export function defaultPriceVariant<T extends { id: string; is_active?: boolean; sort_order?: number | null }>(variants: T[]): T | undefined {
  return variants.filter(variant => variant.is_active !== false)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.id.localeCompare(b.id))[0];
}
