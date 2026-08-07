import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ProductRail } from '@/components/Site';
import { ProductPurchase } from '@/components/ProductPurchase';
import { ProductGallery } from '@/components/ProductGallery';
import { getProduct, getProducts, imageFor, money } from '@/lib/supabase';
import { absoluteUrl, breadcrumbSchema, JsonLd, plainText, truncate } from '@/lib/seo';
import { categoryCanonicalPath } from '@/lib/public-urls';
import sanitizeHtml from 'sanitize-html';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) return { title: 'Product Not Found', robots: { index: false, follow: false } };
  const category = (product.categories?.name || 'Alcohol').replace(/\b\w/g, (letter) => letter.toUpperCase());
  const title = product.seo_title || `${product.name} – ${category} Delivery Nairobi`;
  const description = truncate(product.seo_description || plainText(product.short_description || product.description) || `Order ${product.name} online from BoozePap for fast alcohol delivery across Nairobi.`);
  const url = `/product/${product.slug}`;
  const images = [...new Set([imageFor(product), ...(product.gallery_urls || [])])];
  return {
    title, description, alternates: { canonical: url },
    keywords: [`${product.name} Nairobi`, `${category} Delivery Nairobi`, 'Alcohol Delivery Nairobi', 'Liquor Delivery Nairobi'],
    openGraph: { title: `${title} | BoozePap`, description, url, type: 'website', images: images.map((image) => ({ url: image, alt: product.name })) },
    twitter: { card: 'summary_large_image', title: `${title} | BoozePap`, description, images: images.slice(0, 1) },
  };
}

export default async function Product({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ variant?: string }> }) {
  const { slug } = await params;
  const { variant: initialVariantId } = await searchParams;
  const [product, related] = await Promise.all([getProduct(slug), getProducts()]);
  if (!product) notFound();
  const images = [...new Set([imageFor(product), ...(product.gallery_urls || [])])].slice(0, 6);
  const textDescription = plainText(product.description || product.short_description);
  const description = sanitizeHtml(product.description || '', { allowedTags: ['p', 'br', 'strong', 'em', 'h2', 'h3', 'ul', 'ol', 'li', 'a'], allowedAttributes: { a: ['href', 'target', 'rel'] } });
  const categoryName = (product.categories?.name || 'Alcohol').replace(/\b\w/g, (letter) => letter.toUpperCase());
  const productUrl = `/product/${product.slug}`;
  const productSchema = {
    '@context': 'https://schema.org', '@type': 'Product', '@id': `${absoluteUrl(productUrl)}#product`,
    name: product.name, url: absoluteUrl(productUrl), description: textDescription, image: images,
    sku: product.sku || undefined, brand: product.brands?.name ? { '@type': 'Brand', name: product.brands.name } : undefined,
    category: categoryName,
    offers: {
      '@type': 'Offer', url: absoluteUrl(productUrl), price: Number(product.price).toFixed(2), priceCurrency: 'KES',
      availability: Number(product.stock || 0) > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      itemCondition: 'https://schema.org/NewCondition', seller: { '@id': 'https://boozepap.com/#organization' },
    },
  };
  const availability = (product.product_variants || []).some((variant) => variant.stock > 0) || (!product.product_variants?.length && Number(product.stock || 0) > 0);
  return <main className="mx-auto max-w-4xl px-4 py-4 sm:py-6">
    <JsonLd data={[productSchema, breadcrumbSchema([{ name: 'Home', url: '/' }, { name: categoryName, url: categoryCanonicalPath(product.categories?.slug || 'all') }, { name: product.name, url: productUrl }])]} />
    <section className="grid gap-4 rounded-2xl bg-white p-4 shadow-card md:grid-cols-[minmax(0,.9fr)_minmax(0,1.1fr)]"><ProductGallery images={images} name={`${product.name} – ${categoryName} delivery Nairobi`} /><div><p className="text-sm font-bold uppercase tracking-wide text-brand-orange">{product.brands?.name || 'BoozePap selection'}</p><h1 className="mt-1 text-2xl font-black text-brand-ink sm:text-3xl">{product.name}</h1><p className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-bold ${availability ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{availability ? 'Available' : 'Out of stock'}</p><ProductPurchase product={product} initialVariantId={initialVariantId} /></div></section>
    <section className="mt-4 grid gap-4 md:grid-cols-[1.4fr_1fr]"><article className="rounded-2xl bg-white p-4 shadow-card"><h2 className="text-lg font-black text-brand-ink">Description</h2><div className="mt-2 text-sm leading-6 text-neutral-700" dangerouslySetInnerHTML={{ __html: description || '<p>Product details will be added soon.</p>' }} /><h2 className="mt-4 text-lg font-black text-brand-ink">Taste notes</h2><p className="mt-2 text-sm leading-6 text-neutral-700">{product.tasting_notes || 'Tasting notes will be added by the BoozePap team.'}</p>{product.pairing_suggestions && <><h2 className="mt-4 text-lg font-black text-brand-ink">Pairing suggestions</h2><p className="mt-2 text-sm leading-6 text-neutral-700">{product.pairing_suggestions}</p></>}</article><dl className="grid grid-cols-2 content-start gap-x-4 gap-y-3 rounded-2xl bg-brand-soft p-4 text-sm"><dt className="font-bold">ABV</dt><dd>{product.abv != null ? `${product.abv}%` : 'Not specified'}</dd><dt className="font-bold">Country</dt><dd>{product.country || 'Not specified'}</dd><dt className="font-bold">Brand</dt><dd>{product.brands?.name || 'Not specified'}</dd><dt className="font-bold">Category</dt><dd>{categoryName}</dd><dt className="font-bold">Bottle size</dt><dd>{product.product_variants?.length ? product.product_variants.map((variant) => variant.name).join(', ') : product.bottle_size || 'Not specified'}</dd><dt className="font-bold">Availability</dt><dd>{availability ? 'Available' : 'Out of stock'}</dd></dl></section><ProductRail title="Customers also bought" products={related.filter((item) => item.id !== product.id)} href={categoryCanonicalPath(product.categories?.slug || 'all')} />
  </main>;
}
