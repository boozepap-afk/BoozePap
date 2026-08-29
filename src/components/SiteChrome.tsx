'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import type { DbCategory, DbProduct, SiteContent } from '@/lib/supabase';
import { Footer, Header } from '@/components/Site';

export function SiteChrome({ children, content, products, categories }: { children: ReactNode; content: SiteContent; products: DbProduct[]; categories: DbCategory[] }) {
  const pathname = usePathname();
  if (pathname.startsWith('/admin')) return children;
  return <><Header content={content} products={products} categories={categories} />{children}<Footer content={content} products={products} /></>;
}
