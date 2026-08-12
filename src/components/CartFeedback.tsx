'use client';

import Link from 'next/link';
import { CheckCircle2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { type CartAddedDetail } from '@/lib/cart';
import { money, PRODUCT_IMAGE_PLACEHOLDER } from '@/lib/supabase';

export function CartFeedback() {
  const [detail, setDetail] = useState<CartAddedDetail | null>(null), [visible, setVisible] = useState(false);
  const closeTimer = useRef<number | null>(null);
  useEffect(() => { const added = (event: Event) => { if (!(event instanceof CustomEvent) || !event.detail?.item) return; setDetail(event.detail as CartAddedDetail); setVisible(true); if (closeTimer.current) window.clearTimeout(closeTimer.current); closeTimer.current = window.setTimeout(() => setVisible(false), 3000); const cart = document.querySelector('[data-cart-icon]'); cart?.classList.remove('cart-pulse'); requestAnimationFrame(() => cart?.classList.add('cart-pulse')); }; window.addEventListener('chupahub-cart-updated', added); return () => { window.removeEventListener('chupahub-cart-updated', added); if (closeTimer.current) window.clearTimeout(closeTimer.current); }; }, []);
  if (!detail) return null;
  return <aside role="status" aria-live="polite" className={`fixed inset-x-3 bottom-3 z-[70] rounded-xl border border-orange-100 bg-white p-3 shadow-2xl transition duration-300 sm:inset-x-auto sm:bottom-auto sm:right-4 sm:top-20 sm:w-80 ${visible ? 'translate-y-0 opacity-100 sm:translate-x-0' : 'pointer-events-none translate-y-6 opacity-0 sm:translate-x-8 sm:translate-y-0'}`}><button type="button" onClick={() => setVisible(false)} aria-label="Close cart notification" className="absolute right-2 top-2 rounded-full p-1 text-neutral-500 hover:bg-neutral-100"><X size={16}/></button><div className="flex items-center gap-2 text-sm text-green-700"><CheckCircle2 size={18}/><h2 className="font-black">Added to cart</h2></div><div className="mt-2 flex gap-2"><div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-white p-1 ring-1 ring-orange-100"><img src={detail.item.image || PRODUCT_IMAGE_PLACEHOLDER} alt="" className="h-full w-full object-contain"/></div><div className="min-w-0 flex-1 pr-5"><p className="truncate text-sm font-black text-brand-ink">{detail.item.name}{detail.item.size ? ` — ${detail.item.size}` : ''}</p><p className="mt-1 text-xs font-bold">+{detail.quantityAdded} · {money(detail.item.price)}</p></div></div><div className="mt-2 grid grid-cols-2 gap-2"><button type="button" onClick={() => setVisible(false)} className="rounded-lg border border-brand-orange px-2 py-2 text-xs font-black text-brand-orange">Keep shopping</button><Link href="/checkout" onClick={() => setVisible(false)} className="orange-gradient rounded-lg px-2 py-2 text-center text-xs font-black text-white">Checkout</Link></div></aside>;
}
