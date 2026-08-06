import Link from 'next/link';
import { Heart } from 'lucide-react';

export default function WishlistPage() {
  return <main className="mx-auto max-w-3xl px-4 py-16"><section className="rounded-3xl bg-white p-8 text-center shadow-card"><Heart aria-hidden="true" className="mx-auto text-brand-orange" size={48}/><h1 className="mt-4 text-4xl font-black text-brand-ink">Your wishlist</h1><p className="mx-auto mt-3 max-w-lg text-neutral-600">You have not saved any products yet. Wishlist saving will appear here when it is available; until then, browse the full Chupa Hub catalogue.</p><Link href="/category/all" className="orange-gradient mt-7 inline-block rounded-xl px-6 py-3 font-black text-white">Shop all products</Link></section></main>;
}
