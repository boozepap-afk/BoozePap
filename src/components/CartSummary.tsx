'use client';

import { useEffect, useState } from 'react';
import { money } from '@/lib/supabase';
type CartItem = { productId: string; variantId?: string; name: string; size?: string; price: number; quantity: number };
export function CartSummary() {
  const [items, setItems] = useState<CartItem[]>([]);
  useEffect(() => { try { setItems(JSON.parse(localStorage.getItem('chupahub-cart') || '[]')); } catch { setItems([]); } }, []);
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  return <div className="mt-5 space-y-3">{items.length ? items.map((item) => <div key={`${item.productId}-${item.variantId || 'base'}`} className="flex justify-between border-b border-orange-100 pb-2 text-sm"><span>{item.quantity} × {item.name}{item.size ? ` — ${item.size}` : ''}</span><strong>{money(item.price * item.quantity)}</strong></div>) : <p className="text-sm text-neutral-500">Your cart is empty. Choose a product size, then add it to cart.</p>}{items.length > 0 && <div className="flex justify-between text-lg font-black"><span>Products</span><span>{money(total)}</span></div>}</div>;
}
