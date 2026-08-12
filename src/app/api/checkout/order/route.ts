import { NextRequest, NextResponse } from 'next/server';
import { kenyaPhone, requestStkPush } from '@/lib/server/mpesa';
import { getAdminSupabase } from '@/lib/server/supabase-admin';
import { effectivePrice } from '@/lib/supabase';
import { createServerSupabase } from '@/lib/supabase-server';
import { sendOrderEmail, type EmailOrder } from '@/lib/server/order-email';
import { CheckoutCartError, hasCheckoutStock, normalizeCheckoutCart, unavailableProductIds } from '@/lib/checkout-cart';
import { bandForDistance, deliveryDistanceKm, validCoordinates, type DeliveryBand } from '@/lib/server/delivery';

const failure = (code: string, message: string, status: number, extra: Record<string, unknown> = {}) => NextResponse.json({ error: { code, message }, ...extra }, { status });
const dbFailure = (operation: string, error: unknown) => { console.error(`[Checkout database] ${operation} failed`, error); return failure('DATABASE_UNAVAILABLE', 'Checkout is temporarily unavailable. Please try again.', 500); };

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { cart: unknown; customer?: { name?: string; email?: string; phone?: string; address?: string; latitude?: number; longitude?: number; placeId?: string; placeName?: string; locationVerified?: boolean; deliveryInstructions?: string; apartment?: string; building?: string }; paymentMethod?: 'mpesa'|'cash'|'pickup'; giftNote?: string };
    const { lines: cart, productIds: ids } = normalizeCheckoutCart(body.cart);
    const customer = body.customer;
    if (!customer?.name?.trim() || !customer.phone?.trim()) return failure('INVALID_CUSTOMER', 'Enter your name and phone number.', 400);
    if (!body.paymentMethod || !['mpesa','cash','pickup'].includes(body.paymentMethod)) return failure('INVALID_PAYMENT_METHOD', 'Unsupported payment method.', 400);
    const pickup = body.paymentMethod === 'pickup';
    if (!pickup && !customer.address?.trim()) return failure('INVALID_ADDRESS', 'Enter a delivery address.', 400);
    const verified = !pickup && customer.locationVerified === true;
    const latitude = Number(customer.latitude), longitude = Number(customer.longitude);
    if (verified && (!customer.placeId || !validCoordinates(latitude, longitude))) return failure('INVALID_LOCATION', 'Select your delivery location from the Google Maps suggestions.', 400);

    const db = getAdminSupabase();
    const auth = await createServerSupabase();
    const { data: authData } = auth ? await auth.auth.getUser() : { data: { user: null } };
    const { data: products, error: productsError } = await db.from('products').select('id,name,price,old_price,discount_starts_at,discount_ends_at,stock,is_active,track_inventory').in('id', ids);
    if (productsError) return dbFailure('products verification query', productsError);
    const missingIds = unavailableProductIds(ids, products || []);
    if (missingIds.length) return failure('PRODUCT_UNAVAILABLE', 'Some products are unavailable.', 409, { unavailableProductIds: missingIds });
    const { data: variants, error: variantsError } = await db.from('product_variants').select('id,product_id,name,price,old_price,discount_starts_at,discount_ends_at,stock,is_active').in('product_id', ids);
    if (variantsError) return dbFailure('product variants verification query', variantsError);

    let subtotal = 0, originalSubtotal = 0;
    const items: Array<{ product_id: string; variant_id: string | null; product_name: string; quantity: number; unit_price: number; line_total: number }> = [];
    for (const line of cart) {
      const product = products!.find(entry => entry.id === line.product_id)!;
      const variant = line.variant_id ? (variants || []).find(entry => entry.id === line.variant_id && entry.product_id === product.id) : null;
      if (line.variant_id && (!variant || !variant.is_active)) return failure('VARIANT_UNAVAILABLE', 'A selected product size is unavailable.', 409, { unavailableVariantIds: [line.variant_id] });
      const stockItem = variant ? { ...variant, track_inventory: product.track_inventory } : product;
      const pricing = effectivePrice(variant || product), price = Number(pricing.price), oldPrice = Number(pricing.oldPrice || price), quantity = Number(line.quantity);
      if (!Number.isInteger(quantity) || quantity < 1 || !Number.isFinite(price) || price < 0 || !Number.isFinite(oldPrice) || oldPrice < price) return failure('INVALID_PRODUCT_DATA', 'A product in your cart has invalid pricing.', 409);
      const name = variant ? `${product.name} — ${variant.name}` : product.name;
      if (!hasCheckoutStock(stockItem, quantity)) return failure('INSUFFICIENT_STOCK', `${name} does not have enough stock available.`, 409);
      subtotal += price * quantity; originalSubtotal += oldPrice * quantity;
      items.push({ product_id: product.id, variant_id: variant?.id || null, product_name: name, quantity, unit_price: price, line_total: price * quantity });
    }
    if (!Number.isFinite(subtotal) || subtotal < 0) return failure('INVALID_CART_TOTAL', 'The cart total is invalid.', 400);

    const { data: bands, error: bandsError } = await db.from('delivery_settings').select('id,name,min_distance_km,max_distance_km,fee,estimated_minutes_min,estimated_minutes_max').eq('is_active', true).order('sort_order');
    if (bandsError) return dbFailure('delivery settings query', bandsError);
    let distanceKm: number | null = null, band: DeliveryBand | null = null;
    if (!pickup && verified) {
      distanceKm = (await deliveryDistanceKm(latitude, longitude)).distanceKm;
      band = bandForDistance(distanceKm, (bands || []) as DeliveryBand[]);
      if (!band) return failure('OUTSIDE_DELIVERY_AREA', 'This location is outside our configured delivery area.', 422);
    } else if (!pickup) {
      band = ((bands || []) as DeliveryBand[]).at(-1) || null;
      if (!band) return failure('DELIVERY_SETTINGS_UNAVAILABLE', 'Delivery pricing is not configured.', 503);
    }
    const deliveryFee = pickup || subtotal >= 10000 ? 0 : Number(band?.fee);
    if (!Number.isFinite(deliveryFee) || deliveryFee < 0) return failure('INVALID_DELIVERY_FEE', 'Delivery pricing is temporarily unavailable.', 503);
    const total = subtotal + deliveryFee, orderNumber = `BP-${Date.now().toString(36).toUpperCase()}`;
    const paymentStatus = body.paymentMethod === 'mpesa' ? 'pending_payment' : body.paymentMethod === 'cash' ? 'cash_due' : 'pending';

    let customerId: string | null = null, deliveryLocationId: string | null = null;
    if (authData.user) {
      const { data: savedCustomer, error } = await db.from('customers').upsert({ user_id: authData.user.id, full_name: customer.name.trim(), email: customer.email?.trim() || authData.user.email || null, phone: customer.phone }, { onConflict: 'user_id' }).select('id').single();
      if (error) return dbFailure('customer upsert', error); customerId = savedCustomer?.id || null;
      if (customerId && !pickup) {
        const { data: existing, error: lookupError } = await db.from('delivery_locations').select('id').eq('customer_id', customerId).eq('address', customer.address!.trim()).maybeSingle();
        if (lookupError) return dbFailure('delivery location lookup', lookupError);
        if (existing) deliveryLocationId = existing.id;
        else {
          const { data: location, error: locationError } = await db.from('delivery_locations').insert({ customer_id: customerId, label: 'Saved from checkout', address: customer.address!.trim(), apartment: customer.apartment?.trim() || null, building: customer.building?.trim() || null, delivery_instructions: customer.deliveryInstructions?.trim() || null, latitude: verified ? latitude : null, longitude: verified ? longitude : null, place_id: customer.placeId || null, place_name: customer.placeName || null, is_default: false }).select('id').single();
          if (locationError) return dbFailure('delivery location insert', locationError); deliveryLocationId = location?.id || null;
        }
      }
    }

    const orderPayload = { customer_id: customerId, delivery_location_id: deliveryLocationId, order_number: orderNumber, customer_name: customer.name.trim(), customer_email: customer.email?.trim() || null, customer_phone: customer.phone, delivery_address: customer.address?.trim() || 'Store pickup', gps_lat: verified ? latitude : null, gps_lng: verified ? longitude : null, delivery_place_id: customer.placeId || null, delivery_place_name: customer.placeName || null, delivery_location_verified: verified, delivery_instructions: customer.deliveryInstructions?.trim() || null, gift_note: body.giftNote?.trim() || null, payment_method: body.paymentMethod, payment_status: paymentStatus, status: body.paymentMethod === 'mpesa' ? 'pending_payment' : 'pending', subtotal, delivery_fee: deliveryFee, delivery_distance_km: distanceKm == null ? null : Number(distanceKm.toFixed(2)), discount_total: originalSubtotal - subtotal, total };
    const { data: atomicRows, error: orderError } = await db.rpc('create_checkout_order_atomic', { order_payload: orderPayload, items_payload: items });
    const order = Array.isArray(atomicRows) ? atomicRows[0] : atomicRows;
    if (orderError || !order) return dbFailure('create_checkout_order_atomic RPC', orderError || new Error('RPC returned no order'));

    const orderLines = items.map(item => `${item.quantity} × ${item.product_name} — KES ${item.line_total.toLocaleString('en-KE')}`).join('\n');
    const summary = `Order ${order.order_number}\nCustomer: ${customer.name}\nPhone: ${customer.phone}\nAddress: ${customer.address}\nDistance: ${distanceKm == null ? 'unverified' : `${distanceKm.toFixed(2)} km`}\nDelivery: KES ${deliveryFee.toLocaleString('en-KE')}\nTotal: KES ${total.toLocaleString('en-KE')}\n\nProducts:\n${orderLines}`;
    const { error: notificationError } = await db.from('admin_notifications').insert({ order_id: order.id, kind: 'new_order', title: `New order ${order.order_number}`, body: summary });
    if (notificationError) console.error('[Checkout notification] admin notification failed after order creation', notificationError);
    const emailOrder: EmailOrder = { id: order.id, orderNumber: order.order_number, customerName: customer.name.trim(), customerEmail: customer.email?.trim() || null, customerPhone: customer.phone, deliveryAddress: customer.address?.trim() || 'Store pickup', paymentMethod: body.paymentMethod, subtotal, deliveryFee, total, estimatedDelivery: pickup ? 'Ready-time confirmation will follow' : band ? `${band.estimated_minutes_min}–${band.estimated_minutes_max} minutes` : 'Delivery estimate will follow', items: items.map(item => ({ name: item.product_name, quantity: item.quantity, unitPrice: item.unit_price, lineTotal: item.line_total })) };
    const emailTasks: Array<Promise<unknown>> = [];
    if (emailOrder.customerEmail) emailTasks.push(sendOrderEmail(db, emailOrder, 'placed', emailOrder.customerEmail));
    if (process.env.ADMIN_ORDER_EMAIL) emailTasks.push(sendOrderEmail(db, emailOrder, 'new_order_admin', process.env.ADMIN_ORDER_EMAIL));
    const emailResults = await Promise.allSettled(emailTasks);
    emailResults.forEach(result => { if (result.status === 'rejected') console.error('[Checkout email] failed after order creation', result.reason); });

    if (body.paymentMethod === 'mpesa') {
      const phone = kenyaPhone(customer.phone);
      try {
        const stk = await requestStkPush({ amount: total, phone, accountReference: order.order_number, description: 'BoozePap order' });
        const { error: paymentError } = await db.from('payments').insert({ order_id: order.id, provider: 'mpesa', status: 'pending', amount: total, phone_number: phone, merchant_request_id: stk.merchantRequestId, checkout_request_id: stk.checkoutRequestId });
        if (paymentError) console.error('[Checkout database] payment record insert failed', paymentError);
        return NextResponse.json({ orderNumber: order.order_number, checkoutToken: order.checkout_token, paymentStatus: 'pending_payment', distanceKm, deliveryFee, message: 'Check your phone and enter your M-Pesa PIN to complete payment.' });
      } catch (error) {
        console.error('[Checkout M-Pesa] request failed', error); await db.from('orders').update({ payment_status: 'failed' }).eq('id', order.id);
        return failure('MPESA_START_FAILED', 'M-Pesa could not start. Your order was saved; contact us or choose another payment method.', 502, { orderNumber: order.order_number, checkoutToken: order.checkout_token, paymentStatus: 'failed' });
      }
    }
    return NextResponse.json({ orderNumber: order.order_number, checkoutToken: order.checkout_token, paymentStatus, distanceKm, deliveryFee });
  } catch (error) {
    if (error instanceof CheckoutCartError) return failure('INVALID_CART', error.message, 400, { invalidCartIndexes: error.invalidIndexes });
    console.error('[Checkout] unexpected failure', error);
    return failure('CHECKOUT_FAILED', 'Unable to place your order right now. Please try again.', 500);
  }
}
