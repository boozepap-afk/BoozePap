'use client';

import { useEffect, useRef, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ADMIN_CHANGE_KEY } from '@/lib/admin-sync';

/** Admin writes invalidate content; live prices and stock use direct Supabase reads. */
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
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('storage', onStorage);
    };
  }, [router, pending]);
  return null;
}
