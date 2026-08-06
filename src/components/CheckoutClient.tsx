'use client';

import { useEffect, useMemo, useState } from 'react';
import { money, type CheckoutSettings, type DbDeliverySetting } from '@/lib/supabase';
import { LocationPicker, type DeliveryLocation, type MapsLoadState } from '@/components/LocationPicker';
import { updateCartQuantity } from '@/lib/cart';
import { createBrowserSupabase } from '@/lib/supabase-browser';

type CartItem = { productId: string; variantId?: string; name: string; size?: string; price: number; quantity: number; stock?: number };
type SavedAddress = { id: string; address: string; latitude?: number | null; longitude?: number | null; label?: string | null; apartment?: string | null; building?: string | null; delivery_instructions?: string | null; place_id?: string | null; place_name?: string | null; is_default?: boolean };
type CheckoutDraft = { name?: string; email?: string; phone?: string; address?: string; apartment?: string; building?: string; instructions?: string; coordinates?: DeliveryLocation | null; manualLocation?: boolean; gift?: string; payment?: string };
const checkoutDraftKey = 'chupahub-checkout-draft';
const checkoutAuthKey = 'chupahub-checkout-auth-pending';
const distanceKm = (a: number, b: number, c: number, d: number) => { const r = Math.PI / 180, x = (c - a) * r, y = (d - b) * r, h = Math.sin(x / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin(y / 2) ** 2; return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)); };
function deliveryFor(distance: number | null, bands: DbDeliverySetting[]) { if (distance == null) return null; return bands.find((band) => distance >= Number(band.min_distance_km) && (band.max_distance_km == null || distance <= Number(band.max_distance_km))) || bands.at(-1) || null; }

export function CheckoutClient({ settings, bands }: { settings: CheckoutSettings; bands: DbDeliverySetting[] }) {
  const [items, setItems] = useState<CartItem[]>([]), [name, setName] = useState(''), [email, setEmail] = useState(''), [phone, setPhone] = useState(''), [address, setAddress] = useState(''), [apartment, setApartment] = useState(''), [building, setBuilding] = useState(''), [instructions, setInstructions] = useState(''), [manualLocation, setManualLocation] = useState(false), [gift, setGift] = useState(''), [payment, setPayment] = useState('mpesa'), [notice, setNotice] = useState(''), [error, setError] = useState(''), [submitting, setSubmitting] = useState(false), [signedIn, setSignedIn] = useState(false), [authError, setAuthError] = useState('');
  const [coordinates, setCoordinates] = useState<DeliveryLocation | null>(null);
  const [mapsLoadState, setMapsLoadState] = useState<MapsLoadState>('loading');
  const [draftLoaded, setDraftLoaded] = useState(false), [profileLoaded, setProfileLoaded] = useState(false), [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]), [savedAddressId, setSavedAddressId] = useState(''), [welcome, setWelcome] = useState('');
  useEffect(() => { const refreshCart = () => { try { setItems(JSON.parse(localStorage.getItem('chupahub-cart') || '[]')); } catch { setItems([]); } }; refreshCart(); window.addEventListener('chupahub-cart-updated', refreshCart); return () => window.removeEventListener('chupahub-cart-updated', refreshCart); }, []);
  useEffect(() => {
    try {
      const draft = JSON.parse(localStorage.getItem(checkoutDraftKey) || '{}') as CheckoutDraft;
      setName(draft.name || ''); setEmail(draft.email || ''); setPhone(draft.phone || ''); setAddress(draft.address || ''); setApartment(draft.apartment || ''); setBuilding(draft.building || ''); setInstructions(draft.instructions || ''); setCoordinates(draft.coordinates || null); setManualLocation(Boolean(draft.manualLocation)); setGift(draft.gift || ''); setPayment(draft.payment || 'mpesa');
    } catch { localStorage.removeItem(checkoutDraftKey); }
    setDraftLoaded(true);
  }, []);
  useEffect(() => {
    if (!draftLoaded) return;
    const draft: CheckoutDraft = { name, email, phone, address, apartment, building, instructions, coordinates, manualLocation, gift, payment };
    localStorage.setItem(checkoutDraftKey, JSON.stringify(draft));
  }, [draftLoaded, name, email, phone, address, apartment, building, instructions, coordinates, manualLocation, gift, payment]);
  useEffect(() => {
    const supabase = createBrowserSupabase();
    if (!supabase) return;
    let active = true;
    const applySavedAddress = (saved: SavedAddress, force = false) => {
      const fill = (setter: (value: string | ((current: string) => string)) => void, value?: string | null) => setter(current => force ? value || '' : current || value || '');
      fill(setAddress, saved.address); fill(setApartment, saved.apartment); fill(setBuilding, saved.building); fill(setInstructions, saved.delivery_instructions);
      if (saved.latitude != null && saved.longitude != null) setCoordinates(current => force || !current ? { latitude: Number(saved.latitude), longitude: Number(saved.longitude), placeId: saved.place_id || undefined, placeName: saved.place_name || saved.label || saved.address, verified: Boolean(saved.place_id) } : current);
      else if (force) setCoordinates(null);
    };
    const applyUser = async (user: { id?: string; email?: string; user_metadata?: Record<string, unknown> } | null) => {
      setSignedIn(Boolean(user));
      if (!user) { setProfileLoaded(true); return; }
      const metadata = user.user_metadata || {};
      const { data: profile } = await supabase.from('customers').select('*').eq('user_id', String(user.id || '')).maybeSingle();
      if (!active) return;
      const fullName = profile?.full_name ?? metadata.full_name ?? metadata.name ?? '';
      const customerEmail = profile?.email ?? user.email ?? '';
      const avatarUrl = profile?.avatar_url ?? metadata.avatar_url ?? metadata.picture ?? '';
      void avatarUrl;
      setName(current => current || String(fullName)); setEmail(current => current || String(customerEmail)); setPhone(current => current || String(profile?.phone ?? metadata.phone ?? metadata.phone_number ?? ''));
      if (profile?.id) {
        const { data: locations } = await supabase.from('delivery_locations').select('id,address,latitude,longitude,label,apartment,building,delivery_instructions,place_id,place_name,is_default').eq('customer_id', profile.id).order('is_default', { ascending: false }).order('updated_at', { ascending: false });
        if (!active) return;
        const available = (locations || []) as SavedAddress[];
        setSavedAddresses(available);
        const defaultAddress = available.find(location => location.is_default) || available[0];
        if (defaultAddress) { setSavedAddressId(defaultAddress.id); applySavedAddress(defaultAddress); }
      }
      setProfileLoaded(true);
      if (sessionStorage.getItem(checkoutAuthKey) === '1') {
        sessionStorage.removeItem(checkoutAuthKey);
        setWelcome('Welcome back. We filled in your saved details.');
        window.setTimeout(() => setWelcome(''), 5000);
      }
    };
    void supabase.auth.getUser().then(({ data }) => void applyUser(data.user));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => void applyUser(session?.user || null));
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, []);
  async function continueWithGoogle() {
    const supabase = createBrowserSupabase();
    if (!supabase) return setAuthError('Customer login is not configured.');
    setAuthError('');
    const draft: CheckoutDraft = { name, email, phone, address, apartment, building, instructions, coordinates, manualLocation, gift, payment };
    localStorage.setItem(checkoutDraftKey, JSON.stringify(draft));
    sessionStorage.setItem(checkoutAuthKey, '1');
    const next = '/checkout';
    const { error: oauthError } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`, scopes: 'openid email profile' } });
    if (oauthError) { sessionStorage.removeItem(checkoutAuthKey); setAuthError(oauthError.message); }
  }
  function chooseSavedAddress(id: string) {
    setSavedAddressId(id);
    const saved = savedAddresses.find(location => location.id === id);
    if (!saved) return;
    setAddress(saved.address || ''); setApartment(saved.apartment || ''); setBuilding(saved.building || ''); setInstructions(saved.delivery_instructions || '');
    setCoordinates(saved.latitude != null && saved.longitude != null ? { latitude: Number(saved.latitude), longitude: Number(saved.longitude), placeId: saved.place_id || undefined, placeName: saved.place_name || saved.label || saved.address, verified: Boolean(saved.place_id) } : null);
  }
  const productTotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0); const km = coordinates ? distanceKm(Number(settings.store_latitude ?? -1.286389), Number(settings.store_longitude ?? 36.817223), coordinates.latitude, coordinates.longitude) : null; const band = useMemo(() => manualLocation ? bands.at(-1) || null : deliveryFor(km, bands), [manualLocation, km, bands]); const freeDelivery = productTotal >= 10000; const delivery = payment === 'pickup' || freeDelivery ? 0 : Number(band?.fee || 0);
  const methods = [{ id: 'mpesa', label: 'M-Pesa', on: settings.allow_mpesa !== false }, { id: 'cash', label: 'Cash on delivery', on: settings.allow_cash !== false }, { id: 'pickup', label: 'Store pickup', on: true }].filter((method) => method.on);
  function changeQuantity(item: CartItem, next: number) { if (next <= 0 && !window.confirm(`Remove ${item.name} from your cart?`)) return; updateCartQuantity(item.productId, item.variantId, next); setItems(read => next <= 0 ? read.filter((entry) => !(entry.productId === item.productId && entry.variantId === item.variantId)) : read.map((entry) => entry.productId === item.productId && entry.variantId === item.variantId ? { ...entry, quantity: Math.min(next, entry.stock || next) } : entry)); }
  async function placeOrder() { if (!items.length || !name || !phone || (!address && payment !== 'pickup') || (!coordinates && !manualLocation && payment !== 'pickup')) { setError('Please select your delivery location from the Google Maps suggestions, or choose manual entry if Maps is unavailable.'); return; } setSubmitting(true); setError(''); setNotice(''); try { const response = await fetch('/api/checkout/order', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cart: items.map(({ productId, variantId, quantity }) => ({ productId, variantId, quantity })), customer: { name, email, phone, address: address || 'Store pickup', latitude: coordinates?.latitude ?? 0, longitude: coordinates?.longitude ?? 0, placeId: coordinates?.placeId, placeName: coordinates?.placeName, locationVerified: Boolean(coordinates?.verified), deliveryInstructions: instructions, apartment, building }, paymentMethod: payment, giftNote: gift }) }); const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Unable to place order.'); localStorage.removeItem('chupahub-cart'); window.dispatchEvent(new Event('chupahub-cart-updated')); setNotice(result.paymentStatus === 'pending_payment' ? `${result.message} Order ${result.orderNumber} is pending payment.` : `Order ${result.orderNumber} has been received. We will notify you about delivery.`); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to place order.'); } finally { setSubmitting(false); } }
  return <main className="mx-auto grid max-w-6xl gap-6 px-4 py-8 lg:grid-cols-3"><section className="rounded-3xl bg-white p-6 shadow-card lg:col-span-2"><p className="font-bold uppercase tracking-wide text-brand-orange">Secure Chupa Hub checkout</p><h1 className="text-4xl font-black text-brand-ink">{settings.checkout_heading || 'Checkout'}</h1>{welcome&&<p role="status" className="mt-4 rounded-xl bg-green-50 p-3 font-bold text-green-800">{welcome}</p>}{!signedIn && <div className="mt-5 rounded-2xl border border-orange-100 bg-orange-50 p-4"><p className="text-sm text-neutral-700"><strong>Returning customer?</strong> Sign in to fill your account details, or continue below as a guest.</p><button type="button" onClick={() => void continueWithGoogle()} className="mt-3 rounded-xl border-2 border-orange-200 bg-white px-4 py-2.5 text-sm font-black text-brand-ink">Continue with Google</button>{authError && <p role="alert" className="mt-2 text-sm font-bold text-red-700">{authError}</p>}</div>}{signedIn&&profileLoaded&&(!phone||(!address&&payment!=='pickup'))&&<p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm font-bold text-amber-900">Please add the missing {![phone,address].filter(Boolean).length?'phone number and delivery address':!phone?'phone number':'delivery address'} before placing your order.</p>}{savedAddresses.length>1&&<label className="mt-5 block font-black">Choose another saved address<select value={savedAddressId} onChange={event=>chooseSavedAddress(event.target.value)} className="mt-2 w-full rounded-xl border border-orange-200 bg-white p-3 font-normal">{savedAddresses.map(saved=><option key={saved.id} value={saved.id}>{saved.label||saved.address}</option>)}</select></label>}<div className="mt-7 grid gap-5 sm:grid-cols-2"><label className="font-black">Full name<input value={name} onChange={e => setName(e.target.value)} className="mt-2 w-full rounded-xl border border-orange-200 p-3 font-normal" autoComplete="name" /></label><label className="font-black">Phone / M-Pesa number<input value={phone} onChange={e => setPhone(e.target.value)} className="mt-2 w-full rounded-xl border border-orange-200 p-3 font-normal" placeholder="0712345678" inputMode="tel" autoComplete="tel" /></label><label className="font-black sm:col-span-2">Email for your receipt <span className="font-normal text-neutral-500">(optional)</span><input value={email} onChange={e => setEmail(e.target.value)} className="mt-2 w-full rounded-xl border border-orange-200 p-3 font-normal" type="email" autoComplete="email" /></label><div className="sm:col-span-2"><LocationPicker address={address} onAddress={setAddress} value={coordinates} onChange={setCoordinates} onLoadState={setMapsLoadState}/></div><label className="font-black">Building <span className="font-normal text-neutral-500">(optional)</span><input value={building} onChange={event=>setBuilding(event.target.value)} className="mt-2 w-full rounded-xl border border-orange-200 p-3 font-normal" autoComplete="address-line2"/></label><label className="font-black">Apartment / unit <span className="font-normal text-neutral-500">(optional)</span><input value={apartment} onChange={event=>setApartment(event.target.value)} className="mt-2 w-full rounded-xl border border-orange-200 p-3 font-normal"/></label><div className="sm:col-span-2"><label className="block font-black">Delivery instructions <span className="font-normal text-neutral-500">(optional)</span><input value={instructions} onChange={event=>setInstructions(event.target.value)} className="mt-2 w-full rounded-xl border border-orange-200 p-3 font-normal" placeholder="Gate B, third floor, apartment 12"/></label>{(mapsLoadState === 'error' || mapsLoadState === 'autocomplete-error') && <label className="mt-3 flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={manualLocation} onChange={event=>{setManualLocation(event.target.checked);if(event.target.checked)setCoordinates(null)}}/>{mapsLoadState === 'error' ? 'Google Maps is unavailable' : 'Address lookup is unavailable'} — use my typed address and mark it unverified</label>}</div></div><div className="mt-6"><p className="font-black">Payment method</p><div className="mt-3 flex flex-wrap gap-3">{methods.map((method) => <button key={method.id} type="button" onClick={() => setPayment(method.id)} className={`rounded-xl border-2 px-4 py-3 font-bold ${payment === method.id ? 'border-brand-orange bg-orange-50 text-brand-deep' : 'border-orange-100'}`}>{method.label}</button>)}</div></div>{settings.gift_notes_enabled !== false && <label className="mt-6 block font-black">Gift note<textarea value={gift} onChange={e => setGift(e.target.value)} className="mt-2 min-h-20 w-full rounded-xl border border-orange-200 p-3 font-normal" /></label>}{error && <p className="mt-5 rounded-xl bg-red-50 p-3 font-bold text-red-700">{error}</p>}{notice && <p className="mt-5 rounded-xl bg-green-50 p-3 font-bold text-green-800">{notice}</p>}</section><aside className="h-fit rounded-3xl bg-white p-6 shadow-card lg:sticky lg:top-5"><h2 className="text-xl font-black text-brand-deep">Your order</h2><div className="mt-4 space-y-3">{items.map((item) => <div key={`${item.productId}-${item.variantId || 'base'}`} className="border-b border-orange-100 pb-3 text-sm"><div className="flex justify-between gap-4"><span>{item.name}{item.size ? ` — ${item.size}` : ''}</span><strong>{money(item.price * item.quantity)}</strong></div><div className="mt-2 flex items-center gap-2"><button type="button" onClick={() => changeQuantity(item, item.quantity - 1)} className="rounded border px-2 font-black">−</button><b>{item.quantity}</b><button type="button" onClick={() => changeQuantity(item, item.quantity + 1)} disabled={item.stock != null && item.quantity >= item.stock} className="rounded border px-2 font-black disabled:opacity-40">+</button><button type="button" onClick={() => changeQuantity(item, 0)} className="ml-auto text-xs font-bold text-red-600">Remove</button></div></div>)}</div><div className="mt-5 space-y-3 border-t border-orange-100 pt-4"><p className="flex justify-between"><span>Products</span><strong>{money(productTotal)}</strong></p><p className="flex justify-between"><span>Delivery fee</span><strong>{payment === 'pickup' || freeDelivery ? 'FREE' : km == null && !manualLocation ? 'Set location' : money(delivery)}</strong></p>{!freeDelivery && productTotal > 0 && <p className="text-xs font-bold text-brand-orange">Add {money(10000 - productTotal)} more to get free delivery.</p>}<p className="flex justify-between"><span>Discount</span><strong>{money(0)}</strong></p><p className="flex justify-between border-t border-orange-100 pt-3 text-xl font-black text-brand-deep"><span>Total</span><span>{money(productTotal + delivery)}</span></p></div><button type="button" onClick={placeOrder} disabled={!items.length || submitting} className="orange-gradient mt-6 w-full rounded-xl py-4 font-black text-white shadow-orange disabled:opacity-50">{submitting ? 'Creating order…' : payment === 'mpesa' ? 'Pay with M-Pesa' : 'Place order'}</button></aside></main>;
}
