import type { DbProduct } from './supabase';
import type { CartItem } from './cart';

export type CatalogPrice = Pick<DbProduct, 'id' | 'price' | 'old_price' | 'discount_starts_at' | 'discount_ends_at' | 'stock' | 'product_variants'>;

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

export async function fetchCatalogPrices(url: string, publicKey: string, signal?: AbortSignal, fetcher: typeof fetch = fetch, productIds?: readonly string[]): Promise<CatalogPrice[]> {
  const prices: CatalogPrice[] = [];
  const pageSize = 1000;
  const ids = productIds === undefined ? undefined : [...new Set(productIds)].filter(id => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id));
  const groups: (string[] | undefined)[] = ids === undefined ? [undefined] : [];
  if (ids) for (let index = 0; index < ids.length; index += 100) groups.push(ids.slice(index, index + 100));
  for (const group of groups) {
    for (let offset = 0; ; offset += pageSize) {
      const endpoint = new URL('/rest/v1/products', url);
      endpoint.searchParams.set('select', 'id,price,old_price,discount_starts_at,discount_ends_at,stock,product_variants(id,name,price,old_price,discount_starts_at,discount_ends_at,discount_label,stock,low_stock_threshold,is_active,image_url)');
      endpoint.searchParams.set('is_active', 'eq.true');
      if (group) endpoint.searchParams.set('id', `in.(${group.join(',')})`);
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
      if (group || page.length < pageSize) break;
    }
  }
  return prices;
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
