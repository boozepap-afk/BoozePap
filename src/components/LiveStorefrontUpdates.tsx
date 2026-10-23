'use client';

import { useEffect, useRef, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ADMIN_CHANGE_KEY } from '@/lib/admin-sync';

/** Re-read all public content, including additions, removals, stock and settings. */
export function LiveStorefrontUpdates() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const lastRefresh = useRef(0);
  useEffect(() => {
    const refresh = () => {
      const focused = document.activeElement;
      const editing = focused instanceof HTMLElement && (focused.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(focused.tagName));
      if (pending || editing || document.visibilityState === 'hidden' || Date.now() - lastRefresh.current < 5000) return;
      lastRefresh.current = Date.now();
      startTransition(() => router.refresh());
    };
    const onStorage = (event: StorageEvent) => { if (event.key === ADMIN_CHANGE_KEY) refresh(); };
    const interval = window.setInterval(refresh, 30_000);
    window.addEventListener('focus', refresh);
    window.addEventListener('storage', onStorage);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('storage', onStorage);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [router, pending]);
  return null;
}
