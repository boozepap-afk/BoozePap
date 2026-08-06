import { absoluteUrl } from '@/lib/seo';
import { getProducts, sitemapProducts } from '@/lib/supabase';
import { sitemapResponse, xmlSitemap } from '@/lib/sitemap-xml';

export async function GET(){const products=sitemapProducts(await getProducts());return sitemapResponse(xmlSitemap(products.map(product=>({loc:absoluteUrl(`/product/${product.slug}`),lastmod:product.updated_at}))))}
