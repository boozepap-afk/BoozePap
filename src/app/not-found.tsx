import type { Metadata } from 'next';
import Link from 'next/link';
import { JsonLd } from '@/lib/seo';

export const metadata: Metadata = { title: 'Page Not Found', description: 'The requested BoozePap page could not be found.', robots: { index: false, follow: true } };
export default function NotFound() { return <main className="mx-auto max-w-3xl px-4 py-20"><JsonLd data={{ '@context': 'https://schema.org', '@type': 'WebPage', name: 'Page Not Found', url: 'https://boozepap.com/404' }}/><section className="rounded-3xl bg-white p-8 text-center shadow-card"><p className="text-6xl font-black text-brand-orange">404</p><h1 className="mt-3 text-3xl font-black text-brand-ink">We could not find that page</h1><p className="mt-3 text-neutral-600">The address may have changed, or the product may no longer be available.</p><div className="mt-7 flex flex-wrap justify-center gap-3"><Link href="/shop" className="orange-gradient rounded-xl px-5 py-3 font-black text-white">Shop all drinks</Link><Link href="/" className="rounded-xl border border-orange-200 px-5 py-3 font-black text-brand-ink">Return home</Link></div></section></main>; }
