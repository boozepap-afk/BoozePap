import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { CheckoutCartError, normalizeCheckoutCart } from '@/lib/checkout-cart';
import { verifyCheckoutProducts } from '@/lib/server/checkout-products';
import { getQuoteSupabase } from '@/lib/server/supabase-quote';
import { calculateDeliveryQuote, validCoordinates } from '@/lib/server/delivery';
import { getActiveDeliveryPricing } from '@/lib/server/delivery-settings';

const safeError = (code: string, message: string, status: number, requestId: string, extra = {}) => NextResponse.json({ error: { code, message, requestId }, ...extra }, { status });

export async function POST(request: NextRequest) {
  const requestId = randomUUID();
  try {
    const body = await request.json() as { latitude?: unknown; longitude?: unknown; cart?: unknown; locationVerified?: unknown };
    const latitude = Number(body.latitude), longitude = Number(body.longitude), locationVerified = body.locationVerified === true;
    console.info('[Checkout quote] validation started', { requestId, locationVerified, cartLines: Array.isArray(body.cart) ? body.cart.length : 0 });
    if (!validCoordinates(latitude, longitude)) return safeError('INVALID_LOCATION', 'Select a valid delivery location.', 400, requestId);
    const { lines, productIds } = normalizeCheckoutCart(body.cart);
    const db = getQuoteSupabase();
    if (!db) {
      console.error('[Checkout quote] public Supabase configuration is missing', { requestId, hasUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL), hasPublicKey: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) });
      return safeError('DELIVERY_CONFIGURATION_UNAVAILABLE', 'Delivery pricing is temporarily unavailable.', 503, requestId);
    }

    console.info('[Checkout quote] PRODUCT_VERIFICATION', { requestId, productCount: productIds.length });
    const verifiedProducts = await verifyCheckoutProducts(db, lines, requestId);
    if (verifiedProducts.error) return safeError('PRODUCT_VERIFICATION_UNAVAILABLE', 'Unable to verify products right now.', 500, requestId);
    if (verifiedProducts.failure) return safeError(verifiedProducts.failure.code, verifiedProducts.failure.message, 409, requestId, verifiedProducts.failure);
    const subtotal = verifiedProducts.subtotal;

    console.info('[Checkout quote] delivery settings query started', { requestId });
    const { pricing, error } = await getActiveDeliveryPricing(db, requestId);
    if (error || !pricing) return safeError('DELIVERY_CONFIGURATION_UNAVAILABLE', 'Delivery pricing is temporarily unavailable.', 503, requestId);
    console.info('[Checkout quote] distance calculation started', { requestId, latitude, longitude });
    const quote = await calculateDeliveryQuote(latitude, longitude, subtotal, locationVerified, pricing);
    if (!quote) return safeError('OUTSIDE_DELIVERY_AREA', 'This location is outside our delivery area.', 409, requestId);
    console.info('[Checkout quote] response constructed', { requestId, subtotal: quote.subtotal, distanceKm: quote.distanceKm, deliveryFee: quote.deliveryFee, total: quote.total });
    return NextResponse.json(quote);
  } catch (error) {
    if (error instanceof CheckoutCartError) return safeError('INVALID_CART', error.message, 400, requestId, { invalidCartIndexes: error.invalidIndexes });
    console.error('[Checkout quote] unexpected failure', { requestId, error });
    return safeError('DELIVERY_QUOTE_FAILED', 'Unable to calculate delivery right now.', 500, requestId);
  }
}
