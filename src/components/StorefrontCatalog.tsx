'use client';

import { useEffect, useState } from 'react';
import { CatalogGrid } from '@/components/CatalogGrid';
import { CategoryCatalog } from '@/components/CategoryCatalog';
import { effectivePrice, supabasePublicKey, supabaseUrl, type DbProduct } from '@/lib/supabase';
import { readCatalog } from '@/lib/catalog-reader';

/** SSR has a small first page; the browser reads the remaining public catalogue
 * directly, keeping Worker CPU and HTML size independent of catalogue growth. */
export function StorefrontCatalog({ initialProducts, categoryId, title, slug, offers = false }: { initialProducts: DbProduct[]; categoryId?: string; title?: string; slug?: string; offers?: boolean }) {
  const [products, setProducts] = useState(initialProducts);
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if ((slug && slug !== 'all' && !categoryId) || !supabaseUrl || !supabasePublicKey) { setState('ready'); return; }
    const controller = new AbortController();
    setState('loading');
    readCatalog(supabaseUrl, supabasePublicKey, { categoryId }, controller.signal)
      .then(rows => { if (!controller.signal.aborted) { setProducts(rows); setState('ready'); } })
      .catch(() => { if (!controller.signal.aborted) setState('failed'); });
    return () => controller.abort();
  }, [categoryId, slug, attempt]);
  const visible = offers ? products.filter(product => effectivePrice(product).active || product.product_variants?.some(variant => effectivePrice(variant).active)) : products;
  return <>
    {state === 'loading' && <p role="status" className="px-4 py-2 text-sm text-neutral-500">Loading the full catalogue…</p>}
    {state === 'failed' && <p role="status" className="px-4 py-2 text-sm text-neutral-600">Could not load the remaining products. <button type="button" onClick={() => setAttempt(value => value + 1)} className="font-bold underline">Retry</button></p>}
    {title && slug ? <CategoryCatalog title={title} slug={slug} products={visible} /> : <CatalogGrid products={visible} className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5 xl:grid-cols-6" />}
    {state === 'ready' && !visible.length && !slug && <p className="p-6 text-neutral-600">No active products are currently available in this section.</p>}
  </>;
}
