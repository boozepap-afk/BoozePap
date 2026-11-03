import type { DbProduct } from './supabase';

// Listing cards and facets do not need rich descriptions, galleries or SEO copy.
export const CATALOG_SELECT = 'id,category_id,name,slug,abv,country,bottle_size,grape_variety,wine_type,sweetness,whisky_type,age_statement,beer_type,pack_size,product_format,gin_style,flavour,price,old_price,discount_starts_at,discount_ends_at,discount_label,stock,image_url,gallery_urls,is_top_seller,is_new_arrival,is_featured,is_active,updated_at,categories(name,slug),brands(name,country),product_variants(id,name,price,old_price,discount_starts_at,discount_ends_at,discount_label,stock,image_url,is_active)';
const SEARCH_SELECT = 'id,name,slug,description,bottle_size,price,image_url,gallery_urls,categories(name,slug),brands(name),product_variants(id,name,price,stock)';

type CatalogQuery = { categoryId?: string; ids?: readonly string[]; limit?: number; featured?: boolean; search?: boolean };
export async function readCatalog(url: string, key: string, query: CatalogQuery = {}, signal?: AbortSignal, fetcher: typeof fetch = fetch): Promise<DbProduct[]> {
  if (!url || !key || query.ids?.length === 0) return [];
  const rows: DbProduct[] = [];
  const limit = query.limit === undefined ? Infinity : Math.max(0, Math.floor(query.limit));
  for (let offset = 0; offset < limit;) {
    const pageSize = Math.min(1000, limit - offset);
    const endpoint = new URL('/rest/v1/products', url);
    endpoint.searchParams.set('select', query.search ? SEARCH_SELECT : CATALOG_SELECT);
    endpoint.searchParams.set('is_active', 'eq.true');
    endpoint.searchParams.set('order', 'updated_at.desc,id.asc');
    endpoint.searchParams.set('limit', String(pageSize));
    endpoint.searchParams.set('offset', String(offset));
    if (query.categoryId) endpoint.searchParams.set('category_id', `eq.${query.categoryId}`);
    if (query.ids) endpoint.searchParams.set('id', `in.(${query.ids.join(',')})`);
    if (query.featured) endpoint.searchParams.set('or', '(is_top_seller.eq.true,is_featured.eq.true)');
    const response = await fetcher(endpoint, { headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: 'no-store', signal });
    if (!response.ok) throw new Error(`Catalog read returned HTTP ${response.status}`);
    const page: DbProduct[] = await response.json();
    if (!Array.isArray(page)) throw new Error('Invalid catalog response');
    rows.push(...page);
    if (page.length < pageSize) break;
    offset += pageSize;
  }
  return rows;
}
