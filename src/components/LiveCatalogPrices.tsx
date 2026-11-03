'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { type DbProduct, supabasePublicKey, supabaseUrl } from '@/lib/supabase';
import { fetchCatalogPrices, refreshCartPrices, type CatalogPrice } from '@/lib/catalog-pricing';
import { readCart, writeCart } from '@/lib/cart';
import { ADMIN_CHANGE_KEY } from '@/lib/admin-sync';

const LivePrices = createContext({ prices: new Map<string, CatalogPrice>(), register: (_ids: string[]): (() => void) => () => {} });

export function LiveCatalogPrices({ children }: { children: ReactNode }) {
  const [prices, setPrices] = useState(new Map<string, CatalogPrice>());
  const watched = useRef(new Map<string, number>());
  const [revision, setRevision] = useState(0);
  const register = useCallback((ids: string[]) => {
    let changed = false;
    ids.forEach(id => { if (!watched.current.has(id)) changed = true; watched.current.set(id, (watched.current.get(id) || 0) + 1); });
    if (changed) setRevision(value => value + 1);
    return () => {
      let removed = false;
      ids.forEach(id => { const count = (watched.current.get(id) || 1) - 1; if (count) watched.current.set(id, count); else { watched.current.delete(id); removed = true; } });
      if (removed) setRevision(value => value + 1);
    };
  }, []);
  useEffect(() => {
    if (!supabaseUrl || !supabasePublicKey) return;
    const controller = new AbortController();
    let pending = false;
    const refresh = async () => {
      if (pending || document.visibilityState === 'hidden') return;
      pending = true;
      try {
        // Read Supabase directly instead of re-requesting possibly cached HTML.
        const ids = [...watched.current.keys(), ...readCart().map(item => item.productId)];
        const rows = await fetchCatalogPrices(supabaseUrl, supabasePublicKey, controller.signal, fetch, ids);
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
    const interval = window.setInterval(() => void refresh(), 30_000);
    const onFocus = () => void refresh();
    const onStorage = (event: StorageEvent) => { if (event.key === ADMIN_CHANGE_KEY) void refresh(); };
    window.addEventListener('chupahub-cart-updated', onFocus);
    window.addEventListener('focus', onFocus);
    window.addEventListener('storage', onStorage);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      controller.abort(); window.clearInterval(interval);
      window.removeEventListener('chupahub-cart-updated', onFocus);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('storage', onStorage);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [revision]);
  const context = useMemo(() => ({ prices, register }), [prices, register]);
  return <LivePrices.Provider value={context}>{children}</LivePrices.Provider>;
}

export function useLiveProduct(product: DbProduct): DbProduct {
  const { prices, register } = useContext(LivePrices);
  useEffect(() => register([product.id]), [register, product.id]);
  const price = prices.get(product.id);
  return price ? { ...product, ...price } : product;
}

export function useLiveProducts(products: DbProduct[]): DbProduct[] {
  const { prices, register } = useContext(LivePrices);
  const idsKey = products.map(product => product.id).join(',');
  useEffect(() => register(idsKey ? idsKey.split(',') : []), [register, idsKey]);
  return useMemo(() => products.map(product => {
    const price = prices.get(product.id);
    return price ? { ...product, ...price } : product;
  }), [products, prices]);
}
