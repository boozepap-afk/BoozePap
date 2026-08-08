import Link from 'next/link';
import type { Metadata } from 'next';
import { Journal, ProductRail, SeoArticle } from '@/components/Site';
import { HeroCarousel } from '@/components/HeroCarousel';
import { getBanners, getCategories, getHomepageSections, getProducts, getPromotions, getSiteContent, money } from '@/lib/supabase';
import { categoryCanonicalPath, stableCollectionSlug } from '@/lib/public-urls';
import { DEFAULT_DESCRIPTION } from '@/lib/seo';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const metadata: Metadata = {
  title: { absolute: 'BoozePap | Online Wines, Spirits & Alcohol Delivery Nairobi' },
  description: DEFAULT_DESCRIPTION,
  alternates: { canonical: 'https://boozepap.com/' },
  openGraph: { title: 'BoozePap | Online Wines, Spirits & Alcohol Delivery Nairobi', description: DEFAULT_DESCRIPTION, url: 'https://boozepap.com/', siteName: 'BoozePap', type: 'website', images: [{ url: '/boozepap-logo.svg', alt: 'BoozePap logo' }] },
  twitter: { card: 'summary', title: 'BoozePap | Online Wines, Spirits & Alcohol Delivery Nairobi', description: DEFAULT_DESCRIPTION, images: ['/boozepap-logo.svg'] },
};

export default async function Home() {
  const [categories, banners, products, promotions, content, configuredSections] = await Promise.all([
    getCategories(), getBanners(), getProducts(), getPromotions(), getSiteContent(), getHomepageSections(),
  ]);
  const topSellers = products.filter((product) => product.is_top_seller);
  const arrivals = products.filter((product) => product.is_new_arrival).sort((a, b) => Date.parse(b.updated_at || '') - Date.parse(a.updated_at || ''));
  const featured = products.filter((product) => product.is_featured);
  const wines = products.filter((product) => product.categories?.slug === 'wine');
  const editorialSections = (configuredSections.length ? configuredSections.map(section => {
    const heading = section.heading.toLowerCase();
    const selected = section.product_ids?.length
      ? section.product_ids.map(id => products.find(product => product.id === id)).filter((product): product is typeof products[number] => Boolean(product))
      : heading.includes('new arrival') ? arrivals
      : heading.includes('deal') || heading.includes('featured') || heading.includes('offer') ? featured
      : section.use_best_sellers || heading.includes('top seller') || heading.includes('best seller') ? topSellers
      : section.category_id ? products.filter(product => product.categories?.slug === section.categories?.slug)
      : products;
    return { title: section.heading, products: selected, href: `/collections/${stableCollectionSlug(section) || 'featured'}`, limit: section.item_limit };
  }) : [
    { title: 'Deals', products: featured, href: '/offers', limit: 8 },
    { title: 'Top Sellers', products: topSellers, href: '/collections/top-sellers', limit: 8 },
    { title: 'Wines We Love', products: wines, href: '/wine', limit: 8 },
    { title: 'New Arrivals', products: arrivals, href: '/collections/new-arrivals', limit: 8 },
    { title: 'Featured Products', products: featured, href: '/collections/featured', limit: 8 },
  ]).sort((a, b) => sectionPriority(a.title) - sectionPriority(b.title));
  const categorySections = categories.map((category, index) => {
    const matching = products.filter(product => product.category_id === category.id || product.categories?.slug === category.slug);
    return { title: category.name, products: rotate(matching, index), href: categoryCanonicalPath(category.slug), limit: 12 };
  }).filter(section => section.products.length > 0 && !editorialSections.some(existing => existing.title.toLowerCase() === section.title.toLowerCase()));
  const sections = [...editorialSections, ...categorySections];
  const promotionHref = (promotion: typeof promotions[number]) => promotion.button_url || '/offers';

  return <main>
    <HeroCarousel banners={banners} categories={categories} />
    {promotions.length > 0 && <section className="mx-auto grid max-w-none gap-3 px-4 pt-5 md:grid-cols-2">
      {promotions.map((promotion) => <Link key={promotion.id} href={promotionHref(promotion)} className="orange-gradient flex items-center justify-between rounded-2xl p-5 text-white shadow-orange">
        <div><p className="text-xs font-black uppercase tracking-widest">{promotion.badge_text || promotion.code || 'Promotion'}</p><h2 className="text-2xl font-black">{promotion.title}</h2><p className="mt-1 text-sm text-white/85">{promotion.description}</p></div>
        <div className="ml-4 shrink-0 rounded-full bg-white px-4 py-3 text-center font-black text-brand-deep">{promotion.discount_type === 'percent' ? `${promotion.discount_value}%` : money(promotion.discount_value)}</div>
      </Link>)}
    </section>}
    {sections.map((section, index) => <ProductRail key={`${section.title}-${index}`} {...section} />)}
    <Journal content={content} />
    <SeoArticle content={content} />
  </main>;
}

function rotate<T>(items: T[], offset: number) {
  if (items.length < 2) return items;
  const start = offset % items.length;
  return [...items.slice(start), ...items.slice(0, start)];
}

function sectionPriority(title: string) {
  const normalized = title.toLowerCase();
  if (normalized.includes('new arrival')) return 100;
  if (normalized.includes('top deal') || normalized.includes('featured') || normalized.includes('offer')) return 0;
  if (normalized.includes('top seller') || normalized.includes('best seller')) return 10;
  return 50;
}
