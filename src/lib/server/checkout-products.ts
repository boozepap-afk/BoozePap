import type { SupabaseClient } from '@supabase/supabase-js';
import type { CheckoutCartLine } from '@/lib/checkout-cart';

export type CheckoutItem = { product_id: string; variant_id: null; product_name: string; quantity: number; unit_price: number; line_total: number };
export type CheckoutProductFailure = { code: 'PRODUCT_UNAVAILABLE'; message: string; unavailableProductIds?: string[]; unavailableVariantIds?: string[] };

const log = (requestId: string, error: { code?: string; message?: string; details?: string; hint?: string }) => console.error('[Checkout] PRODUCT_VERIFICATION', { requestId, code: error.code, message: error.message, details: error.details, hint: error.hint });

/** Uses only production-confirmed products columns. Stock is not selected because
 * this schema has no stock column; availability is represented by published. */
export async function verifyCheckoutProducts(db: SupabaseClient, lines: CheckoutCartLine[], requestId: string) {
  const variantIds = lines.flatMap(line => line.variant_id ? [line.variant_id] : []);
  if (variantIds.length) return { items: null, subtotal: 0, failure: { code: 'PRODUCT_UNAVAILABLE', message: 'A selected product option is unavailable.', unavailableVariantIds: variantIds } satisfies CheckoutProductFailure, error: null };
  const ids = [...new Set(lines.map(line => line.product_id))];
  const result = await db.from('products').select('id,name,price,published').in('id', ids);
  if (result.error) { log(requestId, result.error); return { items: null, subtotal: 0, failure: null, error: result.error }; }
  const available = new Map((result.data || []).filter(product => product.published === true).map(product => [product.id, product]));
  const unavailableProductIds = ids.filter(id => !available.has(id));
  if (unavailableProductIds.length) return { items: null, subtotal: 0, failure: { code: 'PRODUCT_UNAVAILABLE', message: 'Some products are unavailable.', unavailableProductIds } satisfies CheckoutProductFailure, error: null };
  let subtotal = 0;
  const items: CheckoutItem[] = [];
  for (const line of lines) {
    const product = available.get(line.product_id)!;
    const price = Number(product.price);
    if (!Number.isFinite(price) || price < 0) return { items: null, subtotal: 0, failure: { code: 'PRODUCT_UNAVAILABLE', message: 'A product has invalid pricing.', unavailableProductIds: [line.product_id] } satisfies CheckoutProductFailure, error: null };
    const lineTotal = price * line.quantity;
    subtotal += lineTotal;
    items.push({ product_id: product.id, variant_id: null, product_name: product.name, quantity: line.quantity, unit_price: price, line_total: lineTotal });
  }
  return { items, subtotal, failure: null, error: null };
}
