import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { CategoryCatalog } from '@/components/CategoryCatalog';
import { getCategories, getCategory, getProducts, getProductsByCategory } from '@/lib/supabase';
import { absoluteUrl, breadcrumbSchema, JsonLd, plainText, truncate } from '@/lib/seo';
import { categoryCanonicalPath } from '@/lib/public-urls';

export async function generateStaticParams() {
  const categories = await getCategories();
  return categories.map((category) => ({ slug: category.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCategory(slug);
  const name = category?.name || slug.replaceAll('-', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
  const title = category?.seo_title || `${name} Delivery Nairobi – Order Online`;
  const description = truncate(category?.seo_description || plainText(category?.description) || `Order ${name.toLowerCase()} online from BoozePap with fast, reliable ${name.toLowerCase()} delivery across Nairobi.`);
  const url = categoryCanonicalPath(slug);
  return {
    title, description, alternates: { canonical: url },
    keywords: [`${name} Delivery Nairobi`, `${name} online Nairobi`, 'Alcohol Delivery Nairobi', 'Liquor Delivery Nairobi'],
    openGraph: { title: `${title} | BoozePap`, description, url, type: 'website', images: category?.image_url ? [{ url: category.image_url, alt: `${name} delivery Nairobi` }] : undefined },
    twitter: { card: category?.image_url ? 'summary_large_image' : 'summary', title: `${title} | BoozePap`, description, images: category?.image_url ? [category.image_url] : undefined },
  };
}

export default async function Category({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const category = slug === 'all' ? null : await getCategory(slug);
  if (slug !== 'all' && !category) notFound();
  const list = slug === 'all' ? await getProducts() : await getProductsByCategory(slug, category!.id);
  const title = slug === 'all' ? 'All Products' : category?.name || slug.replaceAll('-', ' ');
  return <>
    <JsonLd data={[{ '@context': 'https://schema.org', '@type': 'CollectionPage', name: title, url: absoluteUrl(categoryCanonicalPath(slug)), numberOfItems: list.length }, breadcrumbSchema([{ name: 'Home', url: '/' }, { name: title, url: categoryCanonicalPath(slug) }])]} />
    <Suspense fallback={<CategoryCatalogFallback title={title} count={list.length}/>}>
      <CategoryCatalog title={title} slug={slug} products={list}/>
    </Suspense>
  </>;
}

function CategoryCatalogFallback({ title, count }: { title: string; count: number }) {
  return <main className="mx-auto min-h-[60vh] max-w-7xl bg-white px-3 py-5 sm:px-4"><div className="grid items-start gap-6 lg:grid-cols-[260px_minmax(0,1fr)]"><aside className="hidden h-96 animate-pulse rounded-xl border bg-white lg:block"/><section><div className="flex items-end justify-between border-b pb-4"><div><h1 className="text-2xl font-black capitalize text-brand-ink">{title}</h1><p className="mt-1 text-xs text-neutral-500">{count} {count === 1 ? 'product' : 'products'}</p></div><div className="h-10 w-40 animate-pulse rounded-lg bg-neutral-100"/></div><div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">{Array.from({ length: Math.min(count || 4, 8) }, (_, index) => <div key={index} className="aspect-[4/5] animate-pulse rounded-xl bg-neutral-100"/>)}</div></section></div></main>;
}
