'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { type DbProduct, supabasePublicKey, supabaseUrl } from '@/lib/supabase';
import { fetchCatalogPrices, refreshCartPrices, type CatalogPrice } from '@/lib/catalog-pricing';
import { readCart, writeCart } from '@/lib/cart';

const LivePrices = createContext(new Map<string, CatalogPrice>());

export function LiveCatalogPrices({ children }: { children: ReactNode }) {
  const [prices, setPrices] = useState(new Map<string, CatalogPrice>());
  useEffect(() => {
    if (!supabaseUrl || !supabasePublicKey) return;
    const controller = new AbortController();
    let pending = false;
    const refresh = async () => {
      if (pending || document.visibilityState === 'hidden') return;
      pending = true;
      try {
        // Read Supabase directly instead of re-requesting possibly cached HTML.
        const rows = await fetchCatalogPrices(supabaseUrl, supabasePublicKey, controller.signal);
        if (controller.signal.aborted) return;
        const next = new Map(rows.map(row => [row.id, row]));
        setPrices(next);
        const cart = readCart(), updated = refreshCartPrices(cart, next);
        if (updated.some((item, index) => item !== cart[index])) writeCart(updated);
      } catch (error) {
        if (!controller.signal.aborted) console.error('[BoozePap prices] Live refresh failed; retaining displayed prices.', error);
      } finally { pending = false; }
    };
    void refresh();
    const interval = window.setInterval(() => void refresh(), 60_000);
    const onFocus = () => void refresh();
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      controller.abort(); window.clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, []);
  return <LivePrices.Provider value={prices}>{children}</LivePrices.Provider>;
}

export function useLiveProduct(product: DbProduct): DbProduct {
  const price = useContext(LivePrices).get(product.id);
  return price ? { ...product, ...price } : product;
}

export function useLiveProducts(products: DbProduct[]): DbProduct[] {
  const prices = useContext(LivePrices);
  return products.map(product => {
    const price = prices.get(product.id);
    return price ? { ...product, ...price } : product;
  });
}
