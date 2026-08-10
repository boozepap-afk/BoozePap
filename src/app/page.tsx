import Link from 'next/link';
import type { Metadata } from 'next';
import { Journal, ProductRail, SeoArticle } from '@/components/Site';
import { HeroCarousel } from '@/components/HeroCarousel';
import { getBanners, getCategories, getHomepageSections, getProducts, getPromotions, getSiteContent, getTopSellingProductIds, money } from '@/lib/supabase';
import { categoryCanonicalPath } from '@/lib/public-urls';
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
  const [categories, banners, products, promotions, content, configuredSections, topSellingIds] = await Promise.all([
    getCategories(), getBanners(), getProducts(), getPromotions(), getSiteContent(), getHomepageSections(), getTopSellingProductIds(24),
  ]);
  const topSelling = topSellingIds.map(id => products.find(product => product.id === id)).filter((product): product is typeof products[number] => Boolean(product));
  const sections = configuredSections.map(section => {
    const selected = section.use_best_sellers ? topSelling
      : section.product_ids?.length
      ? section.product_ids.map(id => products.find(product => product.id === id)).filter((product): product is typeof products[number] => Boolean(product))
      : section.category_id ? products.filter(product => product.category_id === section.category_id)
      : [];
    const category = categories.find(item => item.id === section.category_id);
    return { title: section.heading, products: selected, href: category ? categoryCanonicalPath(category) : section.destination_url || '/shop', limit: section.item_limit };
  });
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
