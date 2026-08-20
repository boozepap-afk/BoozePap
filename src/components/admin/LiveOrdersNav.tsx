'use client';

import { ClipboardList, Truck } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createBrowserSupabase } from '@/lib/supabase-browser';
import { UNREVIEWED_ORDER_STATUSES } from '@/lib/order-status';

export function LiveOrdersNav() {
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const [count, setCount] = useState(0);
  const [dispatchCount, setDispatchCount] = useState(0);
  const refresh = useCallback(async () => {
    if (!supabase) return;
    const [{ count: total }, { count: ready }] = await Promise.all([
      supabase.from('orders').select('id', { count: 'exact', head: true }).in('status', [...UNREVIEWED_ORDER_STATUSES]),
      supabase.from('orders').select('id', { count: 'exact', head: true }).in('status', ['pending','paid','confirmed','preparing','ready_for_dispatch']),
    ]);
    setCount(total || 0);
    setDispatchCount(ready || 0);
  }, [supabase]);
  useEffect(() => {
    if (!supabase) return;
    void refresh();
    const channel = supabase.channel('admin-orders-nav').on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, refresh).subscribe();
    const poll = window.setInterval(() => void refresh(), 12000);
    return () => { window.clearInterval(poll); void supabase.removeChannel(channel); };
  }, [refresh, supabase]);
  return <><a href="/admin/orders" className="flex shrink-0 items-center gap-2 rounded-xl px-4 py-3 text-left font-bold hover:bg-orange-50 lg:mb-1 lg:w-full"><ClipboardList size={18}/>Orders{count > 0 && <span className="ml-auto rounded-full bg-red-600 px-2 py-0.5 text-xs text-white">{count}</span>}</a><a href="/admin/dispatch" className="flex shrink-0 items-center gap-2 rounded-xl px-4 py-3 text-left font-bold hover:bg-orange-50 lg:mb-1 lg:w-full"><Truck size={18}/>Dispatch{dispatchCount > 0 && <span className="ml-auto rounded-full bg-brand-orange px-2 py-0.5 text-xs text-white">{dispatchCount}</span>}</a></>;
}
