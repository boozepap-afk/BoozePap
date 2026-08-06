import { absoluteUrl } from '@/lib/seo';
import { seoPages } from '@/lib/seo-pages';
import { sitemapResponse, xmlSitemap } from '@/lib/sitemap-xml';
const support=['/','/about','/contact','/faq','/track-order','/search','/privacy','/terms'];
export async function GET(){const paths=[...new Set([...support,...Object.values(seoPages).map(page=>page.path)])];return sitemapResponse(xmlSitemap(paths.map(path=>({loc:absoluteUrl(path)}))))}
