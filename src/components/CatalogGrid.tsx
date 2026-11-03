'use client';

import { useMemo, useState } from 'react';
import type { DbProduct, DbVariant } from '@/lib/supabase';
import { ProductCard, ProductVariantCard } from '@/components/Site';

const PAGE_SIZE = 24;
/** Keep render work bounded while preserving access to every product and size. */
export function CatalogGrid({ products, resetKey = '', className = 'grid grid-cols-2 gap-3 py-5 sm:grid-cols-3 xl:grid-cols-4' }: { products: DbProduct[]; resetKey?: string; className?: string }) {
  const [page, setPage] = useState({ key: resetKey, count: PAGE_SIZE });
  const count = page.key === resetKey ? page.count : PAGE_SIZE;
  const offerings = useMemo(() => products.flatMap(product => [
    { product, variant: undefined as DbVariant | undefined },
    ...(product.product_variants || []).filter(variant => variant.is_active !== false).slice(1).map(variant => ({ product, variant })),
  ]), [products]);
  return <>
    <div className={className}>{offerings.slice(0, count).map(({ product, variant }) => variant
      ? <ProductVariantCard key={`${product.id}:${variant.id}`} product={product} variant={variant} />
      : <ProductCard key={product.id} p={product} />)}</div>
    {count < offerings.length && <div className="pb-6 text-center"><button type="button" onClick={() => setPage({ key: resetKey, count: count + PAGE_SIZE })} className="rounded-full border border-brand-orange px-6 py-3 text-sm font-bold text-brand-deep">Show more products ({Math.min(count, offerings.length)} of {offerings.length})</button></div>}
  </>;
}
