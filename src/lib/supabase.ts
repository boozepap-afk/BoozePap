import { categoryImageFor } from '@/lib/category-images';

export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
export const supabasePublicKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';
export const hasSupabaseConfig = Boolean(supabaseUrl && supabasePublicKey);

export type DbCategory = { id: string; name: string; slug: string; parent_id?: string; icon?: string; image_url?: string; description?: string; color?: string; seo_title?: string; seo_description?: string; sort_order?: number; is_active?: boolean; updated_at?: string };
export type DbVariant = { id: string; name: string; sku?: string; option_values?: Record<string, string>; price: number; old_price?: number; discount_starts_at?: string; discount_ends_at?: string; discount_label?: string; stock: number; low_stock_threshold?: number; image_url?: string; is_active?: boolean };
export type DbBanner = { id: string; title: string; subtitle?: string | null; image_url: string; mobile_image_url?: string | null; badge_text?: string | null; button_label?: string | null; button_text?: string | null; button_url?: string | null; sort_order?: number | null; is_active?: boolean; starts_at?: string | null; ends_at?: string | null };
export type DbPromotion = { id: string; title: string; code?: string; description?: string; image_url?: string; badge_text?: string; button_label?: string; button_url?: string; discount_type: string; discount_value: number; sort_order?: number };
export type DbHomepageSection = { id: string; heading: string; category_id?: string | null; product_ids: string[]; use_best_sellers: boolean; item_limit: number; sort_order: number; rotation_enabled: boolean; destination_url?: string | null; is_active: boolean; updated_at?: string; categories?: { slug: string } | null };
export type DbDeliverySetting = { id: string; name: string; min_distance_km: number; max_distance_km?: number; fee: number; estimated_minutes_min: number; estimated_minutes_max: number };
export type DbProduct = {
  id: string; category_id?: string | null; name: string; slug: string; description?: string; short_description?: string; seo_title?: string; seo_description?: string; sku?: string; abv?: number; country?: string; bottle_size?: string; grape_variety?: string; wine_type?: string; sweetness?: string; whisky_type?: string; age_statement?: string; beer_type?: string; pack_size?: string; product_format?: string; gin_style?: string; flavour?: string;
  price: number; old_price?: number; discount_starts_at?: string; discount_ends_at?: string; discount_label?: string; currency?: string; stock?: number; low_stock_threshold?: number; image_url?: string; gallery_urls?: string[];
  tasting_notes?: string; pairing_suggestions?: string;
  is_top_seller?: boolean; is_new_arrival?: boolean; is_featured?: boolean; is_active?: boolean; updated_at?: string;
  categories?: { name: string; slug: string } | null; brands?: { name: string; country?: string } | null;
  product_variants?: DbVariant[];
};

type SupabaseFetchOptions = { cache?: RequestCache; resource?: string };

async function supabaseFetch<T>(path: string, options: SupabaseFetchOptions = {}): Promise<T[]> {
  if (!hasSupabaseConfig) {
    console.error('[BoozePap Supabase] Configuration is missing; returning an empty public result.', { resource: options.resource || path });
    return [];
  }
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
      headers: { apikey: supabasePublicKey, Authorization: `Bearer ${supabasePublicKey}` },
      ...(options.cache === 'no-store' ? { cache: 'no-store' as const } : { next: { revalidate: 5 } }),
    });
    if (!response.ok) {
      const details = (await response.text()).slice(0, 1000);
      const error = new Error(`Supabase ${options.resource || 'request'} failed with HTTP ${response.status}: ${details}`);
      console.error('[BoozePap Supabase]', error.message, { path, project: getSupabaseProjectRef() });
      return [];
    }
    return response.json();
  } catch (error) {
    console.error(`[BoozePap Supabase] ${options.resource || 'request'} failed`, { path, project: getSupabaseProjectRef(), error });
    return [];
  }
}

export function getSupabaseProjectRef() {
  try { return new URL(supabaseUrl).hostname.split('.')[0] || 'unknown'; } catch { return 'invalid-url'; }
}

export async function getCategories(): Promise<DbCategory[]> {
  const rows = await supabaseFetch<DbCategory>('categories?select=*&is_active=eq.true&order=sort_order.asc,name.asc', { cache: 'no-store', resource: 'public categories' });
  return rows.map(category => ({ ...category, image_url: categoryImageFor(category) }));
}

export async function getCategory(slug: string): Promise<DbCategory | null> {
  const rows = await supabaseFetch<DbCategory>(`categories?select=*&is_active=eq.true&slug=eq.${encodeURIComponent(slug)}&limit=1`, { cache: 'no-store', resource: 'public category' });
  return rows[0] ? { ...rows[0], image_url: categoryImageFor(rows[0]) } : null;
}

export async function getBanners(): Promise<DbBanner[]> {
  const rows = await supabaseFetch<DbBanner>('homepage_banners?select=*&is_active=eq.true&order=sort_order.asc,created_at.desc', {
    cache: 'no-store', resource: 'public homepage banners',
  });
  const now = Date.now();
  const activeRows = rows.filter((row) => (!row.starts_at || Date.parse(row.starts_at) <= now) && (!row.ends_at || Date.parse(row.ends_at) >= now));
  console.info('[BoozePap banners] Supabase synchronization complete', { project: getSupabaseProjectRef(), fetched: rows.length, visible: activeRows.length });
  return activeRows;
}

export async function getPromotions(): Promise<DbPromotion[]> {
  const rows = await supabaseFetch<DbPromotion & { starts_at?: string; ends_at?: string }>('promotions?select=*&is_active=eq.true&order=sort_order.asc,created_at.desc', { cache: 'no-store', resource: 'public promotions' });
  const now = Date.now();
  return rows.filter((row) => (!row.starts_at || Date.parse(row.starts_at) <= now) && (!row.ends_at || Date.parse(row.ends_at) >= now));
}

export async function getDeliverySettings(): Promise<DbDeliverySetting[]> {
  return supabaseFetch<DbDeliverySetting>('delivery_settings?select=*&is_active=eq.true&order=sort_order.asc', { cache: 'no-store', resource: 'public delivery settings' });
}

export type CheckoutSettings = {
  allow_cash?: boolean; allow_mpesa?: boolean; allow_card?: boolean; minimum_order?: number;
  store_latitude?: number; store_longitude?: number; checkout_heading?: string;
  delivery_address_label?: string; gift_notes_enabled?: boolean; coupons_enabled?: boolean; contact_phone?: string;
};
export async function getCheckoutSettings(): Promise<CheckoutSettings> {
  const rows = await supabaseFetch<{ value: CheckoutSettings }>('store_settings?select=value&key=eq.checkout&is_public=eq.true&limit=1', { cache: 'no-store', resource: 'public checkout settings' });
  return rows[0]?.value || {};
}

export async function getProducts(): Promise<DbProduct[]> {
  const products = await supabaseFetch<DbProduct>('products?select=*,categories(name,slug),brands(name,country),product_variants(*)&is_active=eq.true&order=updated_at.desc,created_at.desc', { cache: 'no-store', resource: 'public products and relationships' });
  console.info('[BoozePap products] Storefront fetch complete', { project: getSupabaseProjectRef(), fetched: products.length });
  return products;
}

export async function getHomepageSections(): Promise<DbHomepageSection[]> {
  return supabaseFetch<DbHomepageSection>('homepage_product_sections?select=*,categories(slug)&is_active=eq.true&order=sort_order.asc,created_at.asc', { cache: 'no-store', resource: 'public homepage product sections' });
}

export async function getHomepageSection(id: string): Promise<DbHomepageSection | null> {
  const rows = await supabaseFetch<DbHomepageSection>(`homepage_product_sections?select=*,categories(slug)&id=eq.${encodeURIComponent(id)}&is_active=eq.true&limit=1`, { cache: 'no-store', resource: 'public homepage product section' });
  return rows[0] || null;
}

export async function getTopSellingProductIds(limit = 24): Promise<string[]> {
  const rows = await supabaseFetch<{ product_id: string }>(`rpc/homepage_top_selling_product_ids?result_limit=${Math.max(1, Math.min(limit, 24))}`, { cache: 'no-store', resource: 'homepage top-selling products' });
  return rows.map(row => row.product_id);
}

export async function getProductsByCategory(slug: string, categoryId?: string): Promise<DbProduct[]> {
  // Use the exact same public result as Shop All, then filter it locally. This
  // avoids PostgREST relationship/filter differences hiding correctly assigned
  // products while retaining the category saved on the product row.
  const [products, category] = await Promise.all([
    getProducts(),
    categoryId ? Promise.resolve(null) : getCategory(slug),
  ]);
  const id = categoryId || category?.id;
  return products.filter(product => product.category_id === id || product.categories?.slug === slug);
}

export async function getProduct(slug: string): Promise<DbProduct | null> {
  const rows = await supabaseFetch<DbProduct>(`products?select=*,categories(name,slug),brands(name,country),product_variants(*)&is_active=eq.true&slug=eq.${encodeURIComponent(slug)}&limit=1`, { cache: 'no-store', resource: 'public product detail' });
  return rows[0] || null;
}

const testProductSlugs = new Set(['jospeh', 'jose-b', 'jose']);
const validPublicSlug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Sitemap entries are deliberately stricter than storefront visibility. A
 * product must be complete enough to be a useful, indexable landing page. */
export function isSitemapProduct(product: DbProduct, duplicateSlugs?: ReadonlySet<string>) {
  const slug = product.slug?.trim().toLowerCase();
  const hasInventory = Number.isFinite(Number(product.stock)) || (product.product_variants || []).some(variant => Number.isFinite(Number(variant.stock)));
  return product.is_active !== false && Boolean(slug) && validPublicSlug.test(slug) && !testProductSlugs.has(slug) && !duplicateSlugs?.has(slug)
    && Boolean(product.name?.trim() && product.name.trim().length >= 3) && Number.isFinite(Number(product.price)) && Number(product.price) > 0
    && Boolean((product.description || product.short_description || '').trim()) && Boolean(product.image_url || product.gallery_urls?.length) && hasInventory;
}

export function sitemapProducts(products: DbProduct[]) {
  const counts = new Map<string, number>();
  products.forEach(product => counts.set(product.slug?.trim().toLowerCase(), (counts.get(product.slug?.trim().toLowerCase()) || 0) + 1));
  const duplicates = new Set([...counts].filter(([, count]) => count > 1).map(([slug]) => slug));
  return products.filter(product => isSitemapProduct(product, duplicates));
}


export type SiteContent = {
  about?: string; privacy?: string; terms?: string; logo_url?: string; contact_phone?: string; contact_email?: string; header_notice?: string; footer_text?: string;
  footer_shop_title?: string; footer_help_title?: string; footer_contact_title?: string; copyright_text?: string;
  instagram_url?: string; facebook_url?: string; tiktok_url?: string; whatsapp_url?: string;
  journal_title?: string; journal_intro?: string; article_title?: string; article_summary?: string; article_body?: string;
  articles?: Array<{ id: string; title: string; summary: string; body: string; is_active: boolean }>;
  brand_partners?: Array<{ id: string; name: string; image_url: string }>;
};

function customerFacingBoozePapContent(content: SiteContent): SiteContent {
  const rebrand = (value?: string) => value?.replace(/Chupa\s*Hub/gi, 'BoozePap');
  return {
    ...content,
    about: rebrand(content.about), privacy: rebrand(content.privacy), terms: rebrand(content.terms),
    header_notice: rebrand(content.header_notice), footer_text: rebrand(content.footer_text), copyright_text: rebrand(content.copyright_text),
    journal_title: rebrand(content.journal_title), journal_intro: rebrand(content.journal_intro),
    article_title: rebrand(content.article_title), article_summary: rebrand(content.article_summary), article_body: rebrand(content.article_body),
    articles: content.articles?.map(article => ({ ...article, title: rebrand(article.title) || '', summary: rebrand(article.summary) || '', body: rebrand(article.body) || '' })),
  };
}

export async function getSiteContent(): Promise<SiteContent> {
  const rows = await supabaseFetch<{ value: SiteContent }>('store_settings?select=value&key=eq.site_content&is_public=eq.true&limit=1', { cache: 'no-store', resource: 'public website settings' });
  return customerFacingBoozePapContent(rows[0]?.value || {});
}

export const money = (value: number) => `KES ${Number(value).toLocaleString('en-KE')}`;
export function effectivePrice(item: { price: number; old_price?: number; discount_starts_at?: string; discount_ends_at?: string }) { const now = Date.now(), active = Boolean(item.old_price && item.old_price > item.price && (!item.discount_starts_at || Date.parse(item.discount_starts_at) <= now) && (!item.discount_ends_at || Date.parse(item.discount_ends_at) > now)); return { price: active ? item.price : item.old_price || item.price, oldPrice: active ? item.old_price : undefined, active }; }
export const imageFor = (product: DbProduct) => product.image_url || product.gallery_urls?.[0] || '/placeholder-product.png';
