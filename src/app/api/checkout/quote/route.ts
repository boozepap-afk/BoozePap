import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { CheckoutCartError, normalizeCheckoutCart, unavailableProductIds } from '@/lib/checkout-cart';
import { getAdminSupabase } from '@/lib/server/supabase-admin';
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
    const db = getAdminSupabase();

    console.info('[Checkout quote] product verification started', { requestId, productCount: productIds.length });
    const { data: products, error: productsError } = await db.from('products').select('id,price,stock,is_active').in('id', productIds);
    if (productsError) {
      console.error('[Checkout quote] products query failed', { requestId, code: productsError.code, message: productsError.message, details: productsError.details, hint: productsError.hint });
      return safeError('PRODUCT_VERIFICATION_UNAVAILABLE', 'Unable to verify products right now.', 500, requestId);
    }
    const unavailable = unavailableProductIds(productIds, products || []);
    if (unavailable.length) return safeError('PRODUCT_UNAVAILABLE', 'Some products are unavailable.', 409, requestId, { unavailableProductIds: unavailable });
    const variantIds = lines.flatMap(line => line.variant_id ? [line.variant_id] : []);
    const { data: variants, error: variantsError } = variantIds.length
      ? await db.from('product_variants').select('id,product_id,price,stock,is_active').in('id', variantIds)
      : { data: [], error: null };
    if (variantsError) {
      console.error('[Checkout quote] variants query failed', { requestId, code: variantsError.code, message: variantsError.message, details: variantsError.details, hint: variantsError.hint });
      return safeError('PRODUCT_VERIFICATION_UNAVAILABLE', 'Unable to verify product sizes right now.', 500, requestId);
    }
    let subtotal = 0;
    for (const line of lines) {
      const product = products!.find(entry => entry.id === line.product_id)!;
      const variant = line.variant_id ? variants!.find(entry => entry.id === line.variant_id && entry.product_id === line.product_id && entry.is_active !== false) : null;
      if (line.variant_id && !variant) return safeError('PRODUCT_UNAVAILABLE', 'A selected product size is unavailable.', 409, requestId, { unavailableVariantIds: [line.variant_id] });
      const price = Number(variant?.price ?? product.price), stock = Number(variant?.stock ?? product.stock);
      if (!Number.isFinite(price) || price < 0 || !Number.isFinite(stock) || stock < line.quantity) return safeError('PRODUCT_UNAVAILABLE', 'A product is unavailable or has invalid pricing.', 409, requestId, { unavailableProductIds: [line.product_id] });
      subtotal += price * line.quantity;
    }

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
