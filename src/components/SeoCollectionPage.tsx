import Link from 'next/link';
import { Suspense } from 'react';
import { CategoryCatalog } from '@/components/CategoryCatalog';
import { ProductCard, ProductVariantCard } from '@/components/Site';
import { breadcrumbSchema, JsonLd } from '@/lib/seo';
import { collectionSchema, type SeoPage, shopLinks } from '@/lib/seo-pages';
import { effectivePrice, getProducts, getProductsByCategory } from '@/lib/supabase';

export async function SeoCollectionPage({ page }: { page: SeoPage }) {
  const products = page.categorySlug ? await getProductsByCategory(page.categorySlug) : await getProducts();
  const visible = page.offers ? products.filter(product => effectivePrice(product).active || (product.product_variants || []).some(variant => effectivePrice(variant).active)) : products;
  if (page.categorySlug) {
    const categoryTitle = page.categorySlug.replaceAll('-', ' ').replace(/\b\w/g, letter => letter.toUpperCase());
    return <>
      <JsonLd data={[collectionSchema(page, visible.length), breadcrumbSchema([{ name: 'Home', url: '/' }, { name: page.heading, url: page.path }])]} />
      <Suspense fallback={<CatalogLoading title={categoryTitle} count={visible.length}/>}>
        <CategoryCatalog title={categoryTitle} slug={page.categorySlug} products={visible}/>
      </Suspense>
    </>;
  }
  return <main className="w-full px-4 py-8">
    <JsonLd data={[collectionSchema(page, visible.length), breadcrumbSchema([{ name: 'Home', url: '/' }, { name: page.heading, url: page.path }])]} />
    <nav aria-label="Breadcrumb" className="mb-4 text-sm text-neutral-600"><Link href="/">Home</Link><span aria-hidden="true"> / </span><span>{page.heading}</span></nav>
    <header className="rounded-3xl bg-white p-6 shadow-card"><p className="font-bold uppercase tracking-wide text-brand-orange">Shop BoozePap</p><h1 className="mt-1 text-4xl font-black text-brand-ink sm:text-5xl">{page.heading}</h1><p className="mt-3 max-w-3xl leading-7 text-neutral-600">{page.description}</p></header>
    <nav aria-label="Drink categories" className="mt-5 flex flex-wrap gap-2">{shopLinks.map(([label, href]) => <Link key={href} href={href} className={`rounded-full border px-4 py-2 text-sm font-bold ${href === page.path ? 'border-brand-orange bg-orange-50 text-brand-deep' : 'border-orange-100 bg-white text-brand-ink'}`}>{label}</Link>)}</nav>
    {visible.length ? <section aria-label={`${page.heading} products`} className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5 xl:grid-cols-6">{visible.flatMap(product => { const variants = (product.product_variants || []).filter(variant => variant.is_active !== false); return [<ProductCard key={product.id} p={product}/>, ...variants.slice(1).map(variant => <ProductVariantCard key={variant.id} product={product} variant={variant}/>)]; })}</section> : <p className="mt-6 rounded-2xl bg-white p-6 text-neutral-600">No active products are currently available in this section.</p>}
  </main>;
}

function CatalogLoading({ title, count }: { title: string; count: number }) {
  return <main className="min-h-[60vh] w-full bg-white px-3 py-5 sm:px-4"><div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]"><aside className="hidden h-96 animate-pulse rounded-xl border bg-white lg:block"/><section><div className="flex items-end justify-between border-b pb-4"><div><h1 className="text-2xl font-black text-brand-ink">{title}</h1><p className="mt-1 text-xs text-neutral-500">{count} {count === 1 ? 'product' : 'products'}</p></div><div className="h-10 w-40 animate-pulse rounded-lg bg-neutral-100"/></div><div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">{Array.from({length:Math.min(count || 4,8)},(_,index)=><div key={index} className="aspect-[4/5] animate-pulse rounded-xl bg-neutral-100"/>)}</div></section></div></main>;
}
