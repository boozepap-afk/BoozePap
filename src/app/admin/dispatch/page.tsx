'use client';

import Link from 'next/link';
import { Truck, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createBrowserSupabase } from '@/lib/supabase-browser';
import { getCurrentAdmin } from '@/lib/admin-auth';
import { money, PRODUCT_IMAGE_PLACEHOLDER } from '@/lib/supabase';

type Item = { id: string; product_id?: string | null; product_name: string; quantity: number; unit_price: number };
type DispatchOrder = { id: string; order_number?: string; customer_name?: string; customer_phone?: string; customer_email?: string; delivery_address?: string; total: number; status: string; order_items?: Item[] };
type RiderDraft = { riderName: string; riderPhone: string; deliveryNote: string; trackingUrl: string };
const emptyDraft: RiderDraft = { riderName: '', riderPhone: '', deliveryNote: '', trackingUrl: '' };

export default function DispatchPage() {
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const [orders, setOrders] = useState<DispatchOrder[]>([]);
  const [images, setImages] = useState<Record<string, string>>({});
  const [drafts, setDrafts] = useState<Record<string, RiderDraft>>({});
  const [picked, setPicked] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(''), [error, setError] = useState(''), [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    if (!supabase) return;
    setLoading(true); setError('');
    const { admin, error: accessError } = await getCurrentAdmin(supabase);
    if (accessError || !admin) { setError(accessError?.message || 'Administrator access required.'); setLoading(false); return; }
    const { data, error: orderError } = await supabase.from('orders').select('id,order_number,customer_name,customer_phone,customer_email,delivery_address,total,status,order_items(id,product_id,product_name,quantity,unit_price)').in('status', ['pending','paid','confirmed','preparing','ready_for_dispatch']).order('created_at', { ascending: true });
    if (orderError) { setError(orderError.message); setLoading(false); return; }
    const ready = (data || []) as DispatchOrder[];
    setOrders(ready);
    const productIds = [...new Set(ready.flatMap(order => order.order_items || []).map(item => item.product_id).filter(Boolean))] as string[];
    if (productIds.length) {
      const { data: products } = await supabase.from('products').select('id,image_url').in('id', productIds);
      setImages(Object.fromEntries((products || []).map(product => [product.id, product.image_url || PRODUCT_IMAGE_PLACEHOLDER])));
    } else setImages({});
    setLoading(false);
  }, [supabase]);

  useEffect(() => { void load(); }, [load]);

  function update(orderId: string, key: keyof RiderDraft, value: string) {
    setDrafts(current => ({ ...current, [orderId]: { ...(current[orderId] || emptyDraft), [key]: value } }));
  }

  function togglePicked(orderId: string, itemId: string) {
    setPicked(current => { const selected = new Set(current[orderId] || []); selected.has(itemId) ? selected.delete(itemId) : selected.add(itemId); return { ...current, [orderId]: [...selected] }; });
  }

  async function dispatch(order: DispatchOrder) {
    if (!supabase) return;
    const draft = drafts[order.id] || emptyDraft;
    const itemIds = (order.order_items || []).map(item => item.id);
    if (!itemIds.length || !itemIds.every(id => (picked[order.id] || []).includes(id))) { setError('Tick every product to confirm it has been picked before dispatching.'); return; }
    if (!draft.riderName.trim() || !draft.riderPhone.trim()) { setError('Enter the rider name and phone number before dispatching.'); return; }
    if (!window.confirm(`Dispatch ${order.order_number || order.id} with ${draft.riderName.trim()}?`)) return;
    setBusy(order.id); setError(''); setNotice('');
    const { data: { session } } = await supabase.auth.getSession();
    const response = await fetch(`/api/admin/orders/${order.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` }, body: JSON.stringify({ status: 'dispatched', riderName: draft.riderName.trim(), riderPhone: draft.riderPhone.trim(), deliveryNote: draft.deliveryNote.trim(), trackingUrl: draft.trackingUrl.trim() }) });
    const result = await response.json();
    if (!response.ok) setError(result.error || 'Unable to dispatch this order.');
    else { setNotice(`${order.order_number || 'Order'} dispatched successfully. The customer notification is being processed.`); setDrafts(current => { const next = { ...current }; delete next[order.id]; return next; }); setPicked(current => { const next = { ...current }; delete next[order.id]; return next; }); await load(); }
    setBusy('');
  }

  return <main className="mx-auto max-w-6xl p-3 sm:p-6">
    <header className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-black uppercase text-brand-orange">Admin</p><h1 className="flex items-center gap-2 text-3xl font-black text-brand-ink"><Truck/>Dispatch</h1><p className="mt-1 text-sm text-neutral-600">Two steps only: tick every picked product, then add the rider and dispatch.</p></div><div className="flex gap-2"><button onClick={() => void load()} className="inline-flex items-center gap-2 rounded-xl border bg-white px-4 py-2 font-bold"><RefreshCw size={17}/>Refresh</button><Link href="/admin" className="rounded-xl border bg-white px-4 py-2 font-bold">Admin</Link><Link href="/admin/orders" className="rounded-xl bg-brand-ink px-4 py-2 font-bold text-white">All orders</Link></div></header>
    {error && <p className="mt-5 rounded-xl bg-red-50 p-4 font-bold text-red-700">{error}</p>}{notice && <p className="mt-5 rounded-xl bg-green-50 p-4 font-bold text-green-800">{notice}</p>}
    {loading ? <p className="mt-8">Loading dispatch orders…</p> : !orders.length ? <div className="mt-8 rounded-2xl bg-white p-8 text-center shadow-card"><Truck className="mx-auto text-brand-orange"/><h2 className="mt-3 text-xl font-black">No orders waiting for dispatch</h2><p className="text-neutral-600">New cash orders and paid M-Pesa orders will appear here automatically.</p></div> : <div className="mt-6 space-y-5">{orders.map(order => { const draft = drafts[order.id] || emptyDraft, selected = picked[order.id] || [], allPicked = Boolean(order.order_items?.length) && (order.order_items || []).every(item => selected.includes(item.id)); return <article key={order.id} className="overflow-hidden rounded-2xl bg-white shadow-card"><div className="flex flex-wrap items-start justify-between gap-3 bg-brand-soft p-5"><div><p className="text-xs font-black uppercase text-brand-orange">Waiting for dispatch</p><h2 className="text-2xl font-black">{order.order_number || order.id}</h2><p>{order.customer_name || 'Guest'} · <a className="font-bold text-brand-orange" href={`tel:${order.customer_phone || ''}`}>{order.customer_phone || 'No phone'}</a></p><p className="mt-1 text-sm text-neutral-600">{order.delivery_address || 'No delivery address'}</p></div><b className="text-xl">{money(order.total)}</b></div><div className="grid gap-5 p-5 lg:grid-cols-[1fr_1.15fr]"><section><p className="text-xs font-black uppercase text-brand-orange">Step 1</p><h3 className="text-xl font-black">Tick products being sold</h3><div className="mt-3 space-y-2">{(order.order_items || []).map(item => <label key={item.id} className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 p-2 ${selected.includes(item.id)?'border-green-500 bg-green-50':'border-neutral-200'}`}><input type="checkbox" checked={selected.includes(item.id)} onChange={() => togglePicked(order.id,item.id)} className="h-6 w-6 accent-green-600"/><img src={images[item.product_id || ''] || PRODUCT_IMAGE_PLACEHOLDER} alt="" className="h-16 w-16 shrink-0 rounded-lg bg-white object-contain p-1"/><div className="min-w-0 flex-1"><b className="block truncate">{item.product_name}</b><small>{item.quantity} × {money(item.unit_price)}</small></div></label>)}</div>{allPicked&&<p className="mt-3 font-black text-green-700">✓ All products checked</p>}</section><section className="rounded-2xl border-2 border-brand-orange/30 bg-orange-50 p-4"><p className="text-xs font-black uppercase text-brand-orange">Step 2</p><h3 className="text-xl font-black">Add rider and dispatch</h3><div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="text-sm font-bold">Rider name<input value={draft.riderName} onChange={event => update(order.id, 'riderName', event.target.value)} className="mt-1 w-full rounded-xl border bg-white p-3 font-normal" placeholder="Enter rider name"/></label><label className="text-sm font-bold">Rider phone<input value={draft.riderPhone} onChange={event => update(order.id, 'riderPhone', event.target.value)} className="mt-1 w-full rounded-xl border bg-white p-3 font-normal" placeholder="0712 345 678" inputMode="tel"/></label><label className="text-sm font-bold">Delivery note<input value={draft.deliveryNote} onChange={event => update(order.id, 'deliveryNote', event.target.value)} className="mt-1 w-full rounded-xl border bg-white p-3 font-normal" placeholder="Optional instructions"/></label><label className="text-sm font-bold">Tracking URL<input value={draft.trackingUrl} onChange={event => update(order.id, 'trackingUrl', event.target.value)} className="mt-1 w-full rounded-xl border bg-white p-3 font-normal" placeholder="Optional tracking link"/></label></div><button onClick={() => void dispatch(order)} disabled={busy === order.id || !allPicked} className="mt-4 w-full rounded-xl bg-brand-orange px-5 py-3 font-black text-white disabled:opacity-40">{busy === order.id ? 'Dispatching…' : allPicked ? 'Dispatch order' : 'Tick all products first'}</button></section></div></article>})}</div>}
  </main>;
}
