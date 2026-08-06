'use client';

import { useMemo, useState } from 'react';
import { DbProduct, DbVariant, effectivePrice, money } from '@/lib/supabase';
import { readCart, writeCart } from '@/lib/cart';

export function ProductPurchase({ product, initialVariantId }: { product: DbProduct; initialVariantId?: string }) {
  const variants = useMemo(() => (product.product_variants || []).filter((variant) => variant.is_active !== false), [product.product_variants]);
  const [selectedId, setSelectedId] = useState(variants.some((variant) => variant.id === initialVariantId) ? initialVariantId || '' : variants[0]?.id || '');
  const [quantity, setQuantity] = useState(1);
  const selected = variants.find((variant) => variant.id === selectedId) as DbVariant | undefined;
  const pricing = effectivePrice(selected || product), price = pricing.price;
  const available = selected ? selected.stock > 0 : (product.stock || 0) > 0;
  const image = selected?.image_url || product.image_url || product.gallery_urls?.[0];

  const maxQuantity = selected ? selected.stock : Number(product.stock || 0);
  function addToCart() {
    if (!available) return;
    const cart = readCart();
    const existing = cart.find((item) => item.productId === product.id && item.variantId === selected?.id);
    const previousQuantity = existing?.quantity || 0;
    const nextQuantity = Math.min(previousQuantity + quantity, maxQuantity);
    if (existing) existing.quantity = nextQuantity;
    else cart.push({ productId: product.id, variantId: selected?.id, name: product.name, size: selected?.name, price, image, quantity: nextQuantity, stock: maxQuantity });
    const addedItem = existing || cart[cart.length - 1];
    writeCart(cart, { item: { ...addedItem }, quantityAdded: nextQuantity - previousQuantity });
  }

  return <div className="mt-4">
    {variants.length > 0 && <fieldset><legend className="text-sm font-black text-brand-ink">Available bottle sizes</legend><p className="mt-1 text-sm text-neutral-600">Choose a size before adding this product to your cart.</p><div className="mt-3 flex flex-wrap gap-2">{variants.map((variant) => { const optionPrice = effectivePrice(variant); return <button key={variant.id} type="button" onClick={() => { setSelectedId(variant.id); setQuantity(1); }} disabled={variant.stock <= 0} className={`rounded-xl border-2 px-4 py-3 text-left font-black transition ${selectedId === variant.id ? 'border-brand-orange bg-orange-50 text-brand-deep' : 'border-orange-100 bg-white text-neutral-700'} disabled:cursor-not-allowed disabled:opacity-45`}><span className="block">{variant.name}</span><span className="text-sm">{money(optionPrice.price)}</span>{variant.stock <= 0 && <span className="mt-1 block text-xs font-bold text-red-600">Out of stock</span>}</button>})}</div></fieldset>}
    <div className="mt-4 flex items-end justify-between gap-4"><div><p className="text-3xl font-black text-brand-deep">{money(price * quantity)}</p>{quantity > 1 && <p className="mt-1 text-sm text-neutral-500">{quantity} × {money(price)}</p>}{pricing.oldPrice && <p className="mt-1 text-sm text-neutral-500 line-through">{money(pricing.oldPrice * quantity)}</p>}</div><p className={`text-sm font-bold ${available ? 'text-green-700' : 'text-red-600'}`}>{available ? (maxQuantity <= (selected?.low_stock_threshold || product.low_stock_threshold || 5) ? 'Low stock' : 'Available now') : 'Currently unavailable'}</p></div>
    <div className="mt-4 flex items-center gap-3"><span className="text-sm font-black text-brand-ink">Quantity</span><div className="flex items-center rounded-xl border border-orange-200 bg-white"><button type="button" onClick={() => setQuantity((value) => Math.max(1, value - 1))} className="px-4 py-3 font-black" aria-label="Decrease quantity">−</button><span className="min-w-10 text-center font-black">{quantity}</span><button type="button" onClick={() => setQuantity((value) => Math.min(maxQuantity, value + 1))} className="px-4 py-3 font-black" aria-label="Increase quantity">+</button></div></div>
    <button type="button" onClick={addToCart} disabled={!available} className="orange-gradient mt-4 w-full rounded-xl px-6 py-3 font-black text-white shadow-orange disabled:cursor-not-allowed disabled:opacity-50">{available ? `Add ${quantity} ${selected?.name || 'product'} to cart` : 'Unavailable'}</button>
  </div>;
}
