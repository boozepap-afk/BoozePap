import type { MetadataRoute } from 'next';
import { absoluteUrl } from '@/lib/seo';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/account/', '/admin/', '/checkout/', '/cart/', '/auth/', '/api/', '/rider/'] },
    sitemap: [absoluteUrl('/sitemap.xml'), absoluteUrl('/sitemaps/pages.xml'), absoluteUrl('/sitemaps/categories.xml'), absoluteUrl('/sitemaps/products.xml')],
    host: absoluteUrl('/'),
  };
}
