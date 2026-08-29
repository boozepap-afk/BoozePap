import type { DbCategory, DbProduct } from '@/lib/supabase';

const DEFAULT_CATEGORY_IMAGE = 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&w=900&q=85';

/** Curated cover artwork used whenever an administrator has not uploaded category artwork. */
export const categoryImages: Record<string, string> = {
  wine: 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?auto=format&fit=crop&w=900&q=85',
  gin: 'https://images.unsplash.com/photo-1551538827-9c037cb4f32a?auto=format&fit=crop&w=900&q=85',
  whisky: 'https://images.unsplash.com/photo-1569529465841-dfecdab7503b?auto=format&fit=crop&w=900&q=85',
  whiskey: 'https://images.unsplash.com/photo-1569529465841-dfecdab7503b?auto=format&fit=crop&w=900&q=85',
  vodka: 'https://images.unsplash.com/photo-1605270012917-bf157c5a9541?auto=format&fit=crop&w=900&q=85',
  beer: 'https://images.unsplash.com/photo-1608270586620-248524c67de9?auto=format&fit=crop&w=900&q=85',
  brandy: 'https://images.unsplash.com/photo-1614313511387-1436a4480ebb?auto=format&fit=crop&w=900&q=85',
  tequila: 'https://images.unsplash.com/photo-1563223771-375783ee91ad?auto=format&fit=crop&w=900&q=85',
  rum: 'https://images.unsplash.com/photo-1582819509237-d5b75c4c3b0d?auto=format&fit=crop&w=900&q=85',
  liqueur: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?auto=format&fit=crop&w=900&q=85',
  sparkling: 'https://images.unsplash.com/photo-1567696911980-2eed69a46042?auto=format&fit=crop&w=900&q=85',
  champagne: 'https://images.unsplash.com/photo-1567696911980-2eed69a46042?auto=format&fit=crop&w=900&q=85',
  mixers: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=900&q=85',
  'soft-drinks': 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=900&q=85',
  snacks: 'https://images.unsplash.com/photo-1621939514649-280e2ee25f60?auto=format&fit=crop&w=900&q=85',
  spirits: 'https://images.unsplash.com/photo-1569529465841-dfecdab7503b?auto=format&fit=crop&w=900&q=85',
  cider: 'https://images.unsplash.com/photo-1569529465841-dfecdab7503b?auto=format&fit=crop&w=900&q=85',
  ciders: 'https://images.unsplash.com/photo-1569529465841-dfecdab7503b?auto=format&fit=crop&w=900&q=85',
  jinro: 'https://images.unsplash.com/photo-1569529465841-dfecdab7503b?auto=format&fit=crop&w=900&q=85',
};

export function categoryImageFor(category: { slug: string; image_url?: string | null }) {
  return category.image_url || categoryImages[category.slug] || DEFAULT_CATEGORY_IMAGE;
}

function productArtwork(product: DbProduct) {
  return product.image_url || product.gallery_urls?.find(Boolean) || product.product_variants?.find(variant => variant.image_url)?.image_url;
}

/** Use the strongest real product photo in each category as its storefront
 * artwork. Featured/top-selling and in-stock products are preferred, while the
 * administrator's category image remains the fallback when no product photo is
 * available. */
export function withStrongProductCategoryImages(categories: DbCategory[], products: DbProduct[]) {
  return categories.map(category => {
    const candidates = products
      .filter(product => product.category_id === category.id || product.categories?.slug === category.slug)
      .filter(product => Boolean(productArtwork(product)))
      .sort((a, b) => {
        const score = (product: DbProduct) =>
          (product.is_top_seller ? 100 : 0) +
          (product.is_featured ? 80 : 0) +
          (Number(product.stock || 0) > 0 || product.product_variants?.some(variant => Number(variant.stock) > 0) ? 20 : 0);
        return score(b) - score(a) || a.name.localeCompare(b.name);
      });
    return { ...category, image_url: candidates.length ? productArtwork(candidates[0]) : categoryImageFor(category) };
  });
}
