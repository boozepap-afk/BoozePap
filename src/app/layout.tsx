import type { Metadata } from 'next';
import './globals.css';
import { CartFeedback } from '@/components/CartFeedback';
import { AgeVerification } from '@/components/AgeVerification';
import { SiteChrome } from '@/components/SiteChrome';
import { getCategories, getProducts, getSiteContent } from '@/lib/supabase';
import { withStrongProductCategoryImages } from '@/lib/category-images';
import { businessGraph, DEFAULT_DESCRIPTION, JsonLd, SITE_NAME, SITE_URL } from '@/lib/seo';

const baseMetadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'BoozePap | Online Wines, Spirits & Alcohol Delivery Nairobi',
    template: '%s | BoozePap',
  },
  description: DEFAULT_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    'Alcohol Delivery Nairobi',
    'Online Alcohol Delivery',
    'Drinks Delivery Kenya',
    'Liquor Delivery Nairobi',
    'Wine Delivery Nairobi',
    'Whisky Delivery Nairobi',
    'Gin Delivery Nairobi',
    'Beer Delivery Nairobi',
    'Chupa Chap alternative',
    'Oaks & Corks alternative',
    'Greenspoon alternative',
    'Quickmart alternative',
  ],
  alternates: { canonical: '/' },
  openGraph: {
    title: 'BoozePap | Online Wines, Spirits & Alcohol Delivery Nairobi',
    description: DEFAULT_DESCRIPTION,
    type: 'website', url: SITE_URL, siteName: SITE_NAME, locale: 'en_KE',
  },
  twitter: { card: 'summary', title: 'BoozePap | Online Wines, Spirits & Alcohol Delivery Nairobi', description: DEFAULT_DESCRIPTION },
  icons: {
    icon: [{ url: '/boozepap-icon.svg', type: 'image/svg+xml', sizes: 'any' }],
    shortcut: '/boozepap-icon.svg',
  },
  manifest: '/site.webmanifest',
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 } },
};

export async function generateMetadata(): Promise<Metadata> {
  const content = await getSiteContent();
  return {
    ...baseMetadata,
    openGraph: { ...baseMetadata.openGraph, images: [{ url: content.logo_url || '/boozepap-logo.svg', alt: 'BoozePap logo' }] },
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [content, products, rawCategories] = await Promise.all([getSiteContent(), getProducts(), getCategories()]);
  const categories = withStrongProductCategoryImages(rawCategories, products);
  // Header search needs identifiers, searchable text, images and prices only.
  // Do not serialize galleries, tasting notes or variant metadata on every route.
  const searchProducts = products.map(product => ({
    id: product.id, name: product.name, slug: product.slug,
    description: product.description, bottle_size: product.bottle_size,
    image_url: product.image_url || product.gallery_urls?.[0], price: product.price,
    categories: product.categories, brands: product.brands,
    product_variants: product.product_variants?.map(variant => ({
      id: variant.id, name: variant.name, price: variant.price, stock: variant.stock,
    })),
  }));
  return (
    <html lang="en">
      <head />
      <body className="app-shell min-h-screen">
        <AgeVerification />
        <CartFeedback />
        <JsonLd data={businessGraph([content.instagram_url || '', content.facebook_url || '', content.tiktok_url || ''], content.logo_url)} />
        <SiteChrome content={content} products={searchProducts} categories={categories}>{children}</SiteChrome>
      </body>
    </html>
  );
}
