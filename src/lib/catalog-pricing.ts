import type { DbProduct } from './supabase';
import type { CartItem } from './cart';

export type CatalogPrice = Pick<DbProduct, 'id' | 'price' | 'old_price' | 'discount_starts_at' | 'discount_ends_at' | 'product_variants'>;

export function effectivePrice(item: { price: number; old_price?: number; discount_starts_at?: string; discount_ends_at?: string }) {
  const now = Date.now();
  const price = Number(item.price);
  const oldPrice = item.old_price == null ? undefined : Number(item.old_price);
  const hasDiscount = oldPrice !== undefined && Number.isFinite(oldPrice) && oldPrice > price;
  const active = hasDiscount && (!item.discount_starts_at || Date.parse(item.discount_starts_at) <= now) && (!item.discount_ends_at || Date.parse(item.discount_ends_at) > now);
  // Only a valid scheduled discount may restore its original price. A stale
  // comparison price must never override the current Supabase price.
  return { price: hasDiscount && !active ? oldPrice! : price, oldPrice: active ? oldPrice : undefined, active };
}

export async function fetchCatalogPrices(url: string, publicKey: string, signal?: AbortSignal, fetcher: typeof fetch = fetch): Promise<CatalogPrice[]> {
  const prices: CatalogPrice[] = [];
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const endpoint = new URL('/rest/v1/products', url);
    endpoint.searchParams.set('select', 'id,price,old_price,discount_starts_at,discount_ends_at,product_variants(*)');
    endpoint.searchParams.set('product_variants.order', 'sort_order.asc,id.asc');
    endpoint.searchParams.set('is_active', 'eq.true');
    endpoint.searchParams.set('order', 'id.asc');
    endpoint.searchParams.set('limit', String(pageSize));
    endpoint.searchParams.set('offset', String(offset));
    const response = await fetcher(endpoint, {
      headers: { apikey: publicKey, Authorization: `Bearer ${publicKey}` },
      cache: 'no-store', signal,
    });
    if (!response.ok) throw new Error(`Live catalog prices returned HTTP ${response.status}`);
    const page = await response.json() as CatalogPrice[];
    if (!Array.isArray(page)) throw new Error('Invalid live catalog prices response');
    prices.push(...page);
    if (page.length < pageSize) return prices;
  }
}

export function refreshCartPrices(items: CartItem[], prices: Map<string, CatalogPrice>): CartItem[] {
  return items.map(item => {
    const product = prices.get(item.productId);
    const offering = item.variantId ? product?.product_variants?.find(variant => variant.id === item.variantId) : product;
    if (!offering) return item;
    const price = Number(effectivePrice(offering).price);
    return Number.isFinite(price) && price >= 0 && price !== item.price ? { ...item, price } : item;
  });
}
