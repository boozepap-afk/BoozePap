export const PRODUCT_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type CheckoutCartLine = { product_id: string; variant_id?: string; quantity: number };

export class CheckoutCartError extends Error {
  invalidIndexes: number[];
  constructor(message: string, invalidIndexes: number[] = []) { super(message); this.invalidIndexes = invalidIndexes; }
}

export function normalizeCheckoutCart(input: unknown): { lines: CheckoutCartLine[]; productIds: string[] } {
  if (!Array.isArray(input) || input.length === 0) throw new CheckoutCartError('Your cart is empty.');
  const invalidIndexes: number[] = [];
  const merged = new Map<string, CheckoutCartLine>();
  input.forEach((raw, index) => {
    const value = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
    const product_id = String(value.product_id || value.productId || '').trim().toLowerCase();
    const variantValue = value.variant_id || value.variantId;
    const variant_id = variantValue ? String(variantValue).trim().toLowerCase() : undefined;
    const quantity = Number(value.quantity);
    if (!PRODUCT_ID_PATTERN.test(product_id) || (variant_id && !PRODUCT_ID_PATTERN.test(variant_id)) || !Number.isInteger(quantity) || quantity < 1) { invalidIndexes.push(index); return; }
    const key = `${product_id}:${variant_id || ''}`, existing = merged.get(key);
    if (existing) existing.quantity += quantity;
    else merged.set(key, { product_id, variant_id, quantity });
  });
  if (invalidIndexes.length) throw new CheckoutCartError('Your cart contains a missing or malformed product ID or quantity.', invalidIndexes);
  const lines = [...merged.values()];
  return { lines, productIds: [...new Set(lines.map(line => line.product_id))] };
}

export function unavailableProductIds(requestedIds: string[], products: Array<{ id: string; is_active?: boolean | null }>) {
  const available = new Set(products.filter(product => product.is_active !== false).map(product => product.id));
  return requestedIds.filter(id => !available.has(id));
}

export function hasCheckoutStock(item: { stock?: number | null; track_inventory?: boolean | null }, quantity: number) {
  return item.track_inventory === false || item.stock == null || Number(item.stock) >= quantity;
}
