import type { MetadataRoute } from 'next';
import { getCategories, getProducts, sitemapProducts } from '@/lib/supabase';
import { absoluteUrl } from '@/lib/seo';
import { seoPages } from '@/lib/seo-pages';
import { categoryCanonicalPath } from '@/lib/public-urls';

export const revalidate = 300;
const publicPages = ['/', ...Object.values(seoPages).map(page => page.path), '/search', '/collections/top-sellers', '/collections/new-arrivals', '/collections/featured', '/about', '/contact', '/faq', '/track-order', '/privacy', '/terms'];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [categories, allProducts] = await Promise.all([getCategories(), getProducts()]);
  const products = sitemapProducts(allProducts);
  const categoryEntries = [...new Map(categories.map(category => [categoryCanonicalPath(category.slug), category])).entries()];
  const collectionLastModified = (predicate: (product: typeof products[number]) => boolean) => products.filter(predicate).map(product => product.updated_at).filter(Boolean).sort().at(-1);
  return [
    ...[...new Set(publicPages)].map(path => ({ url: absoluteUrl(path) })),
    ...categoryEntries.filter(([path]) => !publicPages.includes(path)).map(([path, category]) => ({ url: absoluteUrl(path), ...(category.updated_at ? { lastModified: category.updated_at } : {}) })),
    { url: absoluteUrl('/collections/top-sellers'), ...(collectionLastModified(product => Boolean(product.is_top_seller)) ? { lastModified: collectionLastModified(product => Boolean(product.is_top_seller)) } : {}) },
    { url: absoluteUrl('/collections/new-arrivals'), ...(collectionLastModified(product => Boolean(product.is_new_arrival)) ? { lastModified: collectionLastModified(product => Boolean(product.is_new_arrival)) } : {}) },
    { url: absoluteUrl('/collections/featured'), ...(collectionLastModified(product => Boolean(product.is_featured)) ? { lastModified: collectionLastModified(product => Boolean(product.is_featured)) } : {}) },
    ...products.map(product => ({ url: absoluteUrl(`/product/${product.slug}`), ...(product.updated_at ? { lastModified: product.updated_at } : {}) })),
  ];
}
