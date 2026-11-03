'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import type { DbCategory, SiteContent } from '@/lib/supabase';
import { Footer, Header } from '@/components/Site';
import { LiveCatalogPrices } from '@/components/LiveCatalogPrices';
import { LiveStorefrontUpdates } from '@/components/LiveStorefrontUpdates';

export function SiteChrome({ children, content, categories }: { children: ReactNode; content: SiteContent; categories: DbCategory[] }) {
  const pathname = usePathname();
  if (pathname.startsWith('/admin')) return children;
  return <LiveCatalogPrices><LiveStorefrontUpdates/><Header content={content} categories={categories} />{children}<Footer content={content} /></LiveCatalogPrices>;
}
