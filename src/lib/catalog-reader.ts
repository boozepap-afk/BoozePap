import type { DbProduct } from './supabase';

// Listing cards and facets do not need rich descriptions, galleries or SEO copy.
export const CATALOG_SELECT = 'id,category_id,name,slug,abv,country,bottle_size,grape_variety,wine_type,sweetness,whisky_type,age_statement,beer_type,pack_size,product_format,gin_style,flavour,price,old_price,discount_starts_at,discount_ends_at,discount_label,stock,image_url,gallery_urls,is_top_seller,is_new_arrival,is_featured,is_active,updated_at,categories(name,slug),brands(name,country),product_variants(id,name,price,old_price,discount_starts_at,discount_ends_at,discount_label,stock,image_url,is_active)';
const SEARCH_SELECT = 'id,name,slug,description,bottle_size,price,image_url,gallery_urls,categories(name,slug),brands(name),product_variants(id,name,price,stock)';

type RestError = { code?: string; message?: string };

// Older stores may not have every optional merchandising column. Use their
// existing rows without asking for a migration or serializing rich copy.
function projectRow(row: Record<string, unknown>, selection: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const field of selection.split(/,(?![^()]*\))/)) {
    const nestedAt = field.indexOf('(');
    const key = nestedAt < 0 ? field : field.slice(0, nestedAt);
    if (!(key in row)) continue;
    const value = row[key];
    if (nestedAt < 0 || value == null) result[key] = value;
    else {
      const nested = field.slice(nestedAt + 1, -1);
      result[key] = Array.isArray(value)
        ? value.map(item => projectRow(item as Record<string, unknown>, nested))
        : projectRow(value as Record<string, unknown>, nested);
    }
  }
  return result;
}

type CatalogQuery = { categoryId?: string; ids?: readonly string[]; limit?: number; featured?: boolean; search?: boolean };
export async function readCatalog(url: string, key: string, query: CatalogQuery = {}, signal?: AbortSignal, fetcher: typeof fetch = fetch): Promise<DbProduct[]> {
  if (!url || !key || query.ids?.length === 0) return [];
  const rows: DbProduct[] = [];
  const limit = query.limit === undefined ? Infinity : Math.max(0, Math.floor(query.limit));
  let useCompatibilitySelection = false;
  for (let offset = 0; offset < limit;) {
    const pageSize = Math.min(1000, limit - offset);
    const endpoint = new URL('/rest/v1/products', url);
    endpoint.searchParams.set('select', useCompatibilitySelection ? '*,categories(name,slug),brands(name,country),product_variants(*)' : query.search ? SEARCH_SELECT : CATALOG_SELECT);
    endpoint.searchParams.set('is_active', 'eq.true');
    endpoint.searchParams.set('order', 'updated_at.desc,id.asc');
    endpoint.searchParams.set('limit', String(pageSize));
    endpoint.searchParams.set('offset', String(offset));
    if (query.categoryId) endpoint.searchParams.set('category_id', `eq.${query.categoryId}`);
    if (query.ids) endpoint.searchParams.set('id', `in.(${query.ids.join(',')})`);
    if (query.featured) endpoint.searchParams.set('or', '(is_top_seller.eq.true,is_featured.eq.true)');
    const options = { headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: 'no-store' as const, signal };
    let response = await fetcher(endpoint, options);
    let compatibilityRead = useCompatibilitySelection;
    if (!response.ok) {
      const error = await response.json().catch(() => ({})) as RestError;
      // Retry only a missing-column error, once. Authentication, policy and
      // service failures must remain errors, never an empty successful result.
      if (response.status === 400 && ['42703', 'PGRST204'].includes(error.code || '')) {
        console.warn('[BoozePap catalog] Optional column unavailable; using compatible selection.', { code: error.code, message: error.message?.slice(0, 300) });
        endpoint.searchParams.set('select', '*,categories(name,slug),brands(name,country),product_variants(*)');
        response = await fetcher(endpoint, options);
        compatibilityRead = true;
        useCompatibilitySelection = true;
      } else {
        throw new Error(`Catalog read returned HTTP ${response.status}${error.code ? ` (${error.code})` : ''}: ${error.message?.slice(0, 300) || 'Supabase request failed'}`);
      }
    }
    if (!response.ok) {
      const error = await response.json().catch(() => ({})) as RestError;
      throw new Error(`Catalog compatibility read returned HTTP ${response.status}${error.code ? ` (${error.code})` : ''}: ${error.message?.slice(0, 300) || 'Supabase request failed'}`);
    }
    const page: DbProduct[] = await response.json();
    if (!Array.isArray(page)) throw new Error('Invalid catalog response');
    rows.push(...(compatibilityRead
      ? page.map(row => projectRow(row as unknown as Record<string, unknown>, query.search ? SEARCH_SELECT : CATALOG_SELECT) as DbProduct)
      : page));
    if (page.length < pageSize) break;
    offset += pageSize;
  }
  return rows;
}
