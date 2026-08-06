import { categoryCanonicalPath } from '@/lib/public-urls';
import { absoluteUrl } from '@/lib/seo';
import { getCategories, getProducts, sitemapProducts } from '@/lib/supabase';
import { sitemapResponse, xmlSitemap } from '@/lib/sitemap-xml';

export async function GET(){
  const [categories, allProducts] = await Promise.all([getCategories(), getProducts()]);
  const products = sitemapProducts(allProducts);
  const categoryUrls = [...new Map(categories.map(category => [categoryCanonicalPath(category.slug), category])).entries()].map(([path, category]) => ({ loc: absoluteUrl(path), lastmod: category.updated_at }));
  const collections = [
    ['top-sellers', products.filter(product => product.is_top_seller)],
    ['new-arrivals', products.filter(product => product.is_new_arrival)],
    ['featured', products.filter(product => product.is_featured)],
  ] as const;
  return sitemapResponse(xmlSitemap([...categoryUrls, ...collections.map(([slug, items]) => ({ loc: absoluteUrl(`/collections/${slug}`), lastmod: items.map(item => item.updated_at).filter(Boolean).sort().at(-1) }))]));
}
