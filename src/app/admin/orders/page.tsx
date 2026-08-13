'use client';

import Link from 'next/link';
import { Bell, Check, RefreshCw, Volume2, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createBrowserSupabase } from '@/lib/supabase-browser';
import { money } from '@/lib/supabase';
import { getCurrentAdmin } from '@/lib/admin-auth';
import { ORDER_STATUSES, ORDER_STATUS_TRANSITIONS, UNREVIEWED_ORDER_STATUSES, orderStatusLabel } from '@/lib/order-status';

type Order = {
  id: string; order_number?: string; created_at: string; updated_at?: string;
  customer_name?: string; customer_phone?: string; delivery_address?: string;
  payment_method: string; payment_status: string; delivery_fee: number; total: number;
  status: string; delivery_location_verified?: boolean; order_items?: { count: number }[];
};

type Connection = 'connecting' | 'live' | 'polling' | 'error';
const PAGE_SIZE = 20;
const unreviewedStatuses = new Set(UNREVIEWED_ORDER_STATUSES);
const statusOptions: readonly string[] = ORDER_STATUSES;
const transitions: Record<string, readonly string[]> = ORDER_STATUS_TRANSITIONS;
const statusLabel = (value: string) => orderStatusLabel(value as any);
const statusClass = (value: string) => ({ pending: 'bg-blue-100 text-blue-800', awaiting_payment: 'bg-amber-100 text-amber-800', paid: 'bg-blue-100 text-blue-800', confirmed: 'bg-indigo-100 text-indigo-800', preparing: 'bg-purple-100 text-purple-800', ready_for_dispatch: 'bg-orange-100 text-orange-800', dispatched: 'bg-orange-100 text-orange-800', delivered: 'bg-green-100 text-green-800', cancelled: 'bg-neutral-200 text-neutral-700' }[value] || 'bg-neutral-100 text-neutral-700');

export default function OrdersPage() {
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const [orders, setOrders] = useState<Order[]>([]), [query, setQuery] = useState(''), [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true), [refreshing, setRefreshing] = useState(false), [error, setError] = useState('');
  const [connection, setConnection] = useState<Connection>('connecting'), [lastRefreshed, setLastRefreshed] = useState<Date | null>(null), [page, setPage] = useState(1);
  const [alertOrder, setAlertOrder] = useState<Order | null>(null), [highlighted, setHighlighted] = useState<Set<string>>(new Set()), [notice, setNotice] = useState('');
  const acknowledged = useRef<Set<string>>(new Set());
  const seenOrders = useRef<Set<string>>(new Set());

  const mergeOrder = useCallback((incoming: Order) => setOrders(current => [incoming, ...current.filter(order => order.id !== incoming.id)].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))), []);
  const load = useCallback(async (foreground = false) => {
    if (!supabase) { setError('Supabase is not configured.'); setLoading(false); return; }
    foreground ? setRefreshing(true) : undefined;
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) { setError('Sign in as an administrator to view orders.'); setLoading(false); setRefreshing(false); return; }
    const { admin, error: accessError } = await getCurrentAdmin(supabase);
    if (accessError || !admin) { setError(accessError?.message || 'Administrator access required.'); setLoading(false); setRefreshing(false); return; }
    const { data, error: requestError } = await supabase.from('orders').select('id,order_number,created_at,updated_at,customer_name,customer_phone,delivery_address,payment_method,payment_status,delivery_fee,total,status,delivery_location_verified,order_items(count)').order('created_at', { ascending: false }).limit(250);
    if (requestError) setError(requestError.message); else { setOrders((data || []) as Order[]); setError(''); setLastRefreshed(new Date()); }
    setLoading(false); setRefreshing(false);
  }, [supabase]);

  const fetchOrder = useCallback(async (id: string) => {
    if (!supabase) return null;
    const { data } = await supabase.from('orders').select('id,order_number,created_at,updated_at,customer_name,customer_phone,delivery_address,payment_method,payment_status,delivery_fee,total,status,delivery_location_verified,order_items(count)').eq('id', id).maybeSingle();
    return data as Order | null;
  }, [supabase]);

  const playAlert = useCallback(() => {
    try { const AudioContextClass = window.AudioContext; const context = new AudioContextClass(); const oscillator = context.createOscillator(), gain = context.createGain(); oscillator.frequency.setValueAtTime(880, context.currentTime); oscillator.frequency.exponentialRampToValueAtTime(660, context.currentTime + .22); gain.gain.setValueAtTime(.12, context.currentTime); gain.gain.exponentialRampToValueAtTime(.001, context.currentTime + .28); oscillator.connect(gain); gain.connect(context.destination); oscillator.start(); oscillator.stop(context.currentTime + .28); } catch { /* Browsers may require an earlier user gesture for sound. */ }
  }, []);

  const announce = useCallback((order: Order) => {
    if (acknowledged.current.has(order.id)) return;
    setAlertOrder(order); setHighlighted(current => new Set(current).add(order.id)); playAlert();
    window.setTimeout(() => setHighlighted(current => { const next = new Set(current); next.delete(order.id); return next; }), 8000);
  }, [playAlert]);

  useEffect(() => {
    if (!orders.length) return;
    if (!seenOrders.current.size) { seenOrders.current = new Set(orders.map(order => order.id)); return; }
    const incoming = orders.filter(order => !seenOrders.current.has(order.id));
    incoming.forEach(order => { seenOrders.current.add(order.id); announce(order); });
  }, [announce, orders]);

  useEffect(() => { try { acknowledged.current = new Set(JSON.parse(localStorage.getItem('chupahub-acknowledged-orders') || '[]')); } catch { acknowledged.current = new Set(); } void load(); }, [load]);
  useEffect(() => {
    if (!supabase) return;
    setConnection('connecting');
    const channel = supabase.channel('admin-live-orders').on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, async payload => {
      if (payload.eventType === 'DELETE') { const id = String((payload.old as { id?: string }).id || ''); setOrders(current => current.filter(order => order.id !== id)); return; }
      const id = String((payload.new as { id?: string }).id || ''); if (!id) return;
      const order = await fetchOrder(id); if (!order) return; mergeOrder(order); setLastRefreshed(new Date());
    }).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'order_items' }, async payload => {
      const orderId = String((payload.new as { order_id?: string }).order_id || ''); if (!orderId) return;
      const order = await fetchOrder(orderId); if (!order) return; mergeOrder(order); setLastRefreshed(new Date());
    }).subscribe(state => { if (state === 'SUBSCRIBED') setConnection('live'); else if (state === 'CHANNEL_ERROR' || state === 'TIMED_OUT') setConnection('polling'); else if (state === 'CLOSED') setConnection('error'); });
    const poll = window.setInterval(() => void load(true), 12000);
    const visible = () => { if (document.visibilityState === 'visible') void load(true); };
    document.addEventListener('visibilitychange', visible);
    return () => { window.clearInterval(poll); document.removeEventListener('visibilitychange', visible); void supabase.removeChannel(channel); };
  }, [announce, fetchOrder, load, mergeOrder, supabase]);

  function acknowledge(id: string) { acknowledged.current.add(id); localStorage.setItem('chupahub-acknowledged-orders', JSON.stringify([...acknowledged.current].slice(-500))); setAlertOrder(current => current?.id === id ? null : current); }
  async function changeStatus(order: Order, nextStatus: string) {
    if ((nextStatus === 'cancelled') && !window.confirm(`${'Cancel'} order ${order.order_number || order.id}?`)) return;
    if (!supabase) return; setNotice(''); setError('');
    const { data: { session } } = await supabase.auth.getSession();
    const response = await fetch(`/api/admin/orders/${order.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` }, body: JSON.stringify({ status: nextStatus }) });
    const result = await response.json();
    if (!response.ok) { setError(result.error || 'Unable to update order.'); return; }
    const updated = await fetchOrder(order.id); if (updated) mergeOrder(updated);
    setNotice(`Order ${order.order_number || order.id} updated to ${statusLabel(nextStatus)}.`); window.setTimeout(() => setNotice(''), 4000);
  }

  const filtered = orders.filter(order => {
    const matchesStatus = !status || order.status === status || (status === 'pending' && ['awaiting_payment', 'paid'].includes(order.status));
    return matchesStatus && `${order.order_number || ''} ${order.customer_name || ''} ${order.customer_phone || ''}`.toLowerCase().includes(query.toLowerCase());
  });
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)), visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const unreviewed = orders.filter(order => unreviewedStatuses.has(order.status as any) && !acknowledged.current.has(order.id)).length;
  useEffect(() => setPage(1), [query, status]);

  return <main className="mx-auto max-w-7xl p-3 sm:p-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-bold uppercase text-brand-orange">Admin</p><div className="flex items-center gap-3"><h1 className="text-3xl font-black text-brand-ink">Orders</h1>{unreviewed > 0 && <span className="rounded-full bg-red-600 px-2.5 py-1 text-xs font-black text-white">{unreviewed} new</span>}</div></div><div className="flex items-center gap-2"><span className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-black ${connection === 'live' ? 'bg-green-100 text-green-800' : connection === 'error' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}`}><span className={`h-2 w-2 rounded-full ${connection === 'live' ? 'animate-pulse bg-green-600' : 'bg-current'}`}/>{connection === 'live' ? 'Live' : connection === 'connecting' ? 'Connecting…' : 'Polling backup'}</span><button onClick={() => void load(true)} disabled={refreshing} className="inline-flex items-center gap-2 rounded-xl border bg-white px-4 py-2 font-bold"><RefreshCw size={17} className={refreshing ? 'animate-spin' : ''}/>Refresh</button><Link href="/admin" className="rounded-xl border bg-white px-4 py-2 font-bold">Admin</Link></div></div>
    <p className="mt-2 text-xs text-neutral-500">Last refreshed: {lastRefreshed ? lastRefreshed.toLocaleTimeString() : 'waiting for first refresh'}</p>
    {notice && <p className="mt-4 rounded-xl bg-green-50 p-3 font-bold text-green-800"><Check className="mr-2 inline" size={18}/>{notice}</p>}
    {alertOrder && <aside role="alert" className="fixed inset-x-3 bottom-3 z-50 rounded-2xl border-2 border-brand-orange bg-white p-4 shadow-2xl sm:inset-x-auto sm:bottom-auto sm:right-5 sm:top-5 sm:w-96"><button onClick={() => acknowledge(alertOrder.id)} className="absolute right-3 top-3" aria-label="Acknowledge new order"><X/></button><div className="flex items-center gap-2 text-brand-orange"><Bell/><b>New order received</b><Volume2 size={16}/></div><p className="mt-2 font-black">#{alertOrder.order_number || alertOrder.id.slice(0, 8)}</p><p>{alertOrder.customer_name || 'Guest'} · {money(alertOrder.total)}</p><div className="mt-3 flex gap-2"><Link href={`/admin/orders/${alertOrder.id}`} className="rounded-xl bg-brand-orange px-4 py-2 font-black text-white">Open order</Link><button onClick={() => acknowledge(alertOrder.id)} className="rounded-xl border px-4 py-2 font-bold">Acknowledge</button></div></aside>}
    <div className="mt-5 flex flex-wrap gap-3"><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search order, customer or phone" className="min-w-64 flex-1 rounded-xl border bg-white p-3"/><select value={status} onChange={event => setStatus(event.target.value)} className="rounded-xl border bg-white p-3"><option value="">All statuses</option>{statusOptions.map(value => <option key={value} value={value}>{statusLabel(value)}</option>)}</select></div>
    {loading ? <p className="mt-8">Loading orders…</p> : error ? <div className="mt-8 rounded-xl bg-red-50 p-4 text-red-700"><b>Orders could not be refreshed.</b><p>{error}</p><button onClick={() => void load(true)} className="mt-3 rounded-lg border border-red-300 px-3 py-2 font-bold">Try again</button></div> : !visible.length ? <p className="mt-8 rounded-xl bg-white p-6 shadow-card">No orders match these filters.</p> : <div className="mt-5 overflow-x-auto rounded-2xl bg-white shadow-card"><table className="w-full text-left text-sm"><thead className="bg-brand-soft"><tr>{['Order','Date','Customer','Phone','Address','Products','Payment','Delivery','Total','Status','Update'].map(label => <th key={label} className="p-3">{label}</th>)}</tr></thead><tbody>{visible.map(order => <tr key={order.id} className={`border-t transition-colors duration-700 ${highlighted.has(order.id) ? 'bg-orange-100' : ''}`}><td className="p-3 font-bold"><Link className="text-brand-orange" href={`/admin/orders/${order.id}`}>{order.order_number || order.id.slice(0,8)}</Link></td><td className="whitespace-nowrap p-3">{new Date(order.created_at).toLocaleString()}</td><td className="p-3">{order.customer_name || 'Guest'}</td><td className="p-3"><a href={`tel:${order.customer_phone || ''}`}>{order.customer_phone || '—'}</a></td><td className="max-w-48 truncate p-3">{order.delivery_address || '—'}{order.delivery_location_verified === false && <small className="block font-bold text-red-600">Location not verified</small>}</td><td className="p-3">{order.order_items?.[0]?.count || 0}</td><td className="p-3">{order.payment_method}<br/><small>{order.payment_status}</small></td><td className="p-3">{money(order.delivery_fee)}</td><td className="p-3 font-bold">{money(order.total)}</td><td className="p-3"><span className={`rounded-full px-2 py-1 text-xs font-black capitalize ${statusClass(order.status)}`}>{statusLabel(order.status)}</span></td><td className="p-3"><select aria-label={`Update order ${order.order_number || order.id}`} value="" onChange={event => event.target.value && void changeStatus(order, event.target.value)} className="rounded-lg border bg-white p-2" disabled={!transitions[order.status]?.length}><option value="">{transitions[order.status]?.length ? 'Change status…' : 'No actions'}</option>{(transitions[order.status] || []).map(value => <option key={value} value={value}>{statusLabel(value)}</option>)}</select></td></tr>)}</tbody></table></div>}
    {pages > 1 && <div className="mt-5 flex items-center justify-center gap-3"><button disabled={page === 1} onClick={() => setPage(value => value - 1)} className="rounded-xl border bg-white px-4 py-2 disabled:opacity-40">Previous</button><span>Page {page} of {pages}</span><button disabled={page === pages} onClick={() => setPage(value => value + 1)} className="rounded-xl border bg-white px-4 py-2 disabled:opacity-40">Next</button></div>}
  </main>;
}
