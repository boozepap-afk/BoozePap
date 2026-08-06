'use client';

import { ClipboardList } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createBrowserSupabase } from '@/lib/supabase-browser';

export function LiveOrdersNav() {
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const [count, setCount] = useState(0);
  const refresh = useCallback(async () => {
    if (!supabase) return;
    const { count: total } = await supabase.from('orders').select('id', { count: 'exact', head: true }).in('status', ['pending', 'pending_payment', 'paid']);
    setCount(total || 0);
  }, [supabase]);
  useEffect(() => {
    if (!supabase) return;
    void refresh();
    const channel = supabase.channel('admin-orders-nav').on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, refresh).subscribe();
    const poll = window.setInterval(() => void refresh(), 12000);
    return () => { window.clearInterval(poll); void supabase.removeChannel(channel); };
  }, [refresh, supabase]);
  return <a href="/admin/orders" className="flex shrink-0 items-center gap-2 rounded-xl px-4 py-3 text-left font-bold hover:bg-orange-50 lg:mb-1 lg:w-full"><ClipboardList size={18}/>Orders{count > 0 && <span className="ml-auto rounded-full bg-red-600 px-2 py-0.5 text-xs text-white">{count}</span>}</a>;
}
