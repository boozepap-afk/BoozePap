import type { Metadata } from 'next';
import './globals.css';
import { CartFeedback } from '@/components/CartFeedback';
import { AgeVerification } from '@/components/AgeVerification';
import { SiteChrome } from '@/components/SiteChrome';
import { getProducts, getSiteContent } from '@/lib/supabase';
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
  const [content, products] = await Promise.all([getSiteContent(), getProducts()]);
  return (
    <html lang="en">
      <head />
      <body className="app-shell min-h-screen">
        <AgeVerification />
        <CartFeedback />
        <JsonLd data={businessGraph([content.instagram_url || '', content.facebook_url || '', content.tiktok_url || ''], content.logo_url)} />
        <SiteChrome content={content} products={products}>{children}</SiteChrome>
      </body>
    </html>
  );
}
