import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/server/supabase-admin';
import { bandForDistance, deliveryDistanceKm, validCoordinates, type DeliveryBand } from '@/lib/server/delivery';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { latitude?: unknown; longitude?: unknown; subtotal?: unknown; paymentMethod?: unknown };
    const latitude = Number(body.latitude), longitude = Number(body.longitude), subtotal = Number(body.subtotal);
    if (!validCoordinates(latitude, longitude)) return NextResponse.json({ error: { code: 'INVALID_LOCATION', message: 'Select a valid delivery location.' } }, { status: 400 });
    if (!Number.isFinite(subtotal) || subtotal < 0) return NextResponse.json({ error: { code: 'INVALID_SUBTOTAL', message: 'The cart subtotal is invalid.' } }, { status: 400 });
    const db = getAdminSupabase();
    const { data, error } = await db.from('delivery_settings').select('id,name,min_distance_km,max_distance_km,fee,estimated_minutes_min,estimated_minutes_max').eq('is_active', true).order('sort_order');
    if (error) { console.error('[Checkout quote] delivery_settings query failed', error); return NextResponse.json({ error: { code: 'DELIVERY_SETTINGS_UNAVAILABLE', message: 'Delivery pricing is temporarily unavailable.' } }, { status: 503 }); }
    const distance = await deliveryDistanceKm(latitude, longitude), band = bandForDistance(distance.distanceKm, (data || []) as DeliveryBand[]);
    if (!band) return NextResponse.json({ error: { code: 'OUTSIDE_DELIVERY_AREA', message: 'This location is outside our configured delivery area.' } }, { status: 422 });
    const fee = body.paymentMethod === 'pickup' || subtotal >= 10000 ? 0 : Number(band.fee);
    if (!Number.isFinite(fee) || fee < 0) throw new Error('Configured delivery fee is invalid.');
    return NextResponse.json({ distanceKm: Number(distance.distanceKm.toFixed(2)), deliveryFee: fee, source: distance.source, band: band.name || null });
  } catch (error) {
    console.error('[Checkout quote] failed', error);
    return NextResponse.json({ error: { code: 'DELIVERY_QUOTE_FAILED', message: 'Unable to calculate delivery right now.' } }, { status: 500 });
  }
}
