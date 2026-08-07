'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import type { DbProduct, SiteContent } from '@/lib/supabase';
import { Footer, Header } from '@/components/Site';

export function SiteChrome({ children, content, products }: { children: ReactNode; content: SiteContent; products: DbProduct[] }) {
  const pathname = usePathname();
  if (pathname.startsWith('/admin')) return children;
  return <><Header content={content} products={products} />{children}<Footer content={content} products={products} /></>;
}
