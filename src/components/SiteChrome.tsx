'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import type { DbCategory, DbProduct, SiteContent } from '@/lib/supabase';
import { Footer, Header } from '@/components/Site';
import { LiveCatalogPrices } from '@/components/LiveCatalogPrices';
import { LiveStorefrontUpdates } from '@/components/LiveStorefrontUpdates';

export function SiteChrome({ children, content, products, categories }: { children: ReactNode; content: SiteContent; products: DbProduct[]; categories: DbCategory[] }) {
  const pathname = usePathname();
  if (pathname.startsWith('/admin')) return children;
  return <LiveCatalogPrices><LiveStorefrontUpdates/><Header content={content} products={products} categories={categories} />{children}<Footer content={content} products={products} /></LiveCatalogPrices>;
}
