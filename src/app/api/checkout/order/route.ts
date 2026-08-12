import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { kenyaPhone, requestStkPush } from '@/lib/server/mpesa';
import { getAdminSupabase } from '@/lib/server/supabase-admin';
import { createServerSupabase } from '@/lib/supabase-server';
import { sendOrderEmail, type EmailOrder } from '@/lib/server/order-email';
import { CheckoutCartError, hasCheckoutStock, normalizeCheckoutCart, unavailableProductIds } from '@/lib/checkout-cart';
import { calculateDeliveryQuote, validCoordinates, type DeliveryPricing } from '@/lib/server/delivery';
import { getActiveDeliveryPricing } from '@/lib/server/delivery-settings';
import { createOrderWithItems } from '@/lib/server/create-order';

const failure = (code: string, message: string, status: number, requestId: string, extra: Record<string, unknown> = {}) => NextResponse.json({ error: { code, message, requestId }, ...extra }, { status });

export async function POST(request: NextRequest) {
  const requestId = randomUUID();
  const fail = (code: string, message: string, status: number, extra: Record<string, unknown> = {}) => failure(code, message, status, requestId, extra);
  const dbFailure = (operation: string, error: unknown) => { const value = error as { code?: string; message?: string; details?: string; hint?: string } | null; console.error(`[Checkout database] ${operation} failed`, { requestId, code: value?.code, message: value?.message, details: value?.details, hint: value?.hint }); return fail('DATABASE_UNAVAILABLE', 'Checkout is temporarily unavailable. Please try again.', 500); };
  try {
    const body = await request.json() as { cart: unknown; customer?: { name?: string; email?: string; phone?: string; address?: string; latitude?: number; longitude?: number; placeId?: string; placeName?: string; locationVerified?: boolean; deliveryInstructions?: string; apartment?: string; building?: string }; paymentMethod?: 'mpesa'|'cash'|'pickup'; giftNote?: string };
    const { lines: cart, productIds: ids } = normalizeCheckoutCart(body.cart);
    const customer = body.customer;
    if (!customer?.name?.trim() || !customer.phone?.trim()) return fail('INVALID_CUSTOMER', 'Enter your name and phone number.', 400);
    if (!body.paymentMethod || !['mpesa','cash','pickup'].includes(body.paymentMethod)) return fail('INVALID_PAYMENT_METHOD', 'Unsupported payment method.', 400);
    const pickup = body.paymentMethod === 'pickup';
    if (!pickup && !customer.address?.trim()) return fail('INVALID_ADDRESS', 'Enter a delivery address.', 400);
    const verified = !pickup && customer.locationVerified === true;
    const latitude = Number(customer.latitude), longitude = Number(customer.longitude);
    if (verified && (!customer.placeId || !validCoordinates(latitude, longitude))) return fail('INVALID_LOCATION', 'Select your delivery location from the Google Maps suggestions.', 400);

    const db = getAdminSupabase();
    const auth = await createServerSupabase();
    const { data: authData } = auth ? await auth.auth.getUser() : { data: { user: null } };
    const { data: products, error: productsError } = await db.from('products').select('id,name,price,stock,is_active').in('id', ids);
    if (productsError) return dbFailure('products verification query', productsError);
    const missingIds = unavailableProductIds(ids, products || []);
    if (missingIds.length) return fail('PRODUCT_UNAVAILABLE', 'Some products are unavailable.', 409, { unavailableProductIds: missingIds });
    const { data: variants, error: variantsError } = await db.from('product_variants').select('id,product_id,name,price,stock,is_active').in('product_id', ids);
    if (variantsError) return dbFailure('product variants verification query', variantsError);

    let subtotal = 0;
    const items: Array<{ product_id: string; variant_id: string | null; product_name: string; quantity: number; unit_price: number; line_total: number }> = [];
    for (const line of cart) {
      const product = products!.find(entry => entry.id === line.product_id)!;
      const variant = line.variant_id ? (variants || []).find(entry => entry.id === line.variant_id && entry.product_id === product.id) : null;
      if (line.variant_id && (!variant || !variant.is_active)) return fail('VARIANT_UNAVAILABLE', 'A selected product size is unavailable.', 409, { unavailableVariantIds: [line.variant_id] });
      const stockItem = variant || product;
      const price = Number((variant || product).price), quantity = Number(line.quantity);
      if (!Number.isInteger(quantity) || quantity < 1 || !Number.isFinite(price) || price < 0) return fail('INVALID_PRODUCT_DATA', 'A product in your cart has invalid pricing.', 409);
      const name = variant ? `${product.name} — ${variant.name}` : product.name;
      if (!hasCheckoutStock(stockItem, quantity)) return fail('INSUFFICIENT_STOCK', `${name} does not have enough stock available.`, 409);
      subtotal += price * quantity;
      items.push({ product_id: product.id, variant_id: variant?.id || null, product_name: name, quantity, unit_price: price, line_total: price * quantity });
    }
    if (!Number.isFinite(subtotal) || subtotal < 0) return fail('INVALID_CART_TOTAL', 'The cart total is invalid.', 400);

    const { pricing, error: pricingError } = await getActiveDeliveryPricing(db, requestId);
    if (pricingError || !pricing) return fail('DELIVERY_CONFIGURATION_UNAVAILABLE', 'Delivery pricing is temporarily unavailable.', 503);
    let distanceKm: number | null = null, quotedDeliveryFee: number | null = null, estimatedTime = 'Delivery estimate will follow';
    if (!pickup && verified) {
      const quote = await calculateDeliveryQuote(latitude, longitude, subtotal, verified, pricing as DeliveryPricing);
      if (!quote) return fail('OUTSIDE_DELIVERY_AREA', 'This location is outside our configured delivery area.', 422);
      distanceKm = quote.distanceKm; quotedDeliveryFee = quote.deliveryFee; estimatedTime = quote.estimatedTime;
    }
    const deliveryFee = pickup ? 0 : quotedDeliveryFee ?? pricing.baseFee;
    if (!Number.isFinite(deliveryFee) || deliveryFee < 0) return fail('INVALID_DELIVERY_FEE', 'Delivery pricing is temporarily unavailable.', 503);
    const total = subtotal + deliveryFee, orderNumber = `BP-${Date.now().toString(36).toUpperCase()}`;
    const paymentStatus = body.paymentMethod === 'mpesa' ? 'pending_payment' : body.paymentMethod === 'cash' ? 'cash_due' : 'pending';

    let customerId: string | null = null, deliveryLocationId: string | null = null;
    if (authData.user) {
      const { data: savedCustomer, error } = await db.from('customers').upsert({ user_id: authData.user.id, full_name: customer.name.trim(), email: customer.email?.trim() || authData.user.email || null, phone: customer.phone }, { onConflict: 'user_id' }).select('id').single();
      if (error) console.error('[Checkout database] optional customer profile save failed', error);
      else customerId = savedCustomer?.id || null;
      if (customerId && !pickup) {
        const { data: existing, error: lookupError } = await db.from('delivery_locations').select('id').eq('customer_id', customerId).eq('address', customer.address!.trim()).maybeSingle();
        if (lookupError) console.error('[Checkout database] optional delivery location lookup failed', lookupError);
        if (existing) deliveryLocationId = existing.id;
        else if (!lookupError) {
          const { data: location, error: locationError } = await db.from('delivery_locations').insert({ customer_id: customerId, label: 'Saved from checkout', address: customer.address!.trim(), apartment: customer.apartment?.trim() || null, building: customer.building?.trim() || null, delivery_instructions: customer.deliveryInstructions?.trim() || null, latitude: verified ? latitude : null, longitude: verified ? longitude : null, place_id: customer.placeId || null, place_name: customer.placeName || null, is_default: false }).select('id').single();
          if (locationError) console.error('[Checkout database] optional delivery location insert failed', locationError);
          else deliveryLocationId = location?.id || null;
        }
      }
    }

    const orderPayload = { customer_id: customerId, delivery_location_id: deliveryLocationId, order_number: orderNumber, customer_name: customer.name.trim(), customer_email: customer.email?.trim() || null, customer_phone: customer.phone, delivery_address: customer.address?.trim() || 'Store pickup', gps_lat: verified ? latitude : null, gps_lng: verified ? longitude : null, delivery_place_id: customer.placeId || null, delivery_place_name: customer.placeName || null, delivery_location_verified: verified, delivery_instructions: customer.deliveryInstructions?.trim() || null, gift_note: body.giftNote?.trim() || null, payment_method: body.paymentMethod, payment_status: paymentStatus, status: body.paymentMethod === 'mpesa' ? 'pending_payment' : 'pending', subtotal, delivery_fee: deliveryFee, delivery_distance_km: distanceKm == null ? null : Number(distanceKm.toFixed(2)), discount_total: 0, total };
    const created = await createOrderWithItems(db, orderPayload, items);
    const order = created.order;
    if (created.error || !order) return dbFailure('order and items creation', created.error || new Error('Order creation returned no order'));

    const orderLines = items.map(item => `${item.quantity} × ${item.product_name} — KES ${item.line_total.toLocaleString('en-KE')}`).join('\n');
    const summary = `Order ${order.order_number}\nCustomer: ${customer.name}\nPhone: ${customer.phone}\nAddress: ${customer.address}\nDistance: ${distanceKm == null ? 'unverified' : `${distanceKm.toFixed(2)} km`}\nDelivery: KES ${deliveryFee.toLocaleString('en-KE')}\nTotal: KES ${total.toLocaleString('en-KE')}\n\nProducts:\n${orderLines}`;
    const { error: notificationError } = await db.from('admin_notifications').insert({ order_id: order.id, kind: 'new_order', title: `New order ${order.order_number}`, body: summary });
    if (notificationError) console.error('[Checkout notification] admin notification failed after order creation', notificationError);
    const emailOrder: EmailOrder = { id: order.id, orderNumber: order.order_number, customerName: customer.name.trim(), customerEmail: customer.email?.trim() || null, customerPhone: customer.phone, deliveryAddress: customer.address?.trim() || 'Store pickup', paymentMethod: body.paymentMethod, subtotal, deliveryFee, total, estimatedDelivery: pickup ? 'Ready-time confirmation will follow' : estimatedTime, items: items.map(item => ({ name: item.product_name, quantity: item.quantity, unitPrice: item.unit_price, lineTotal: item.line_total })) };
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
        return fail('MPESA_START_FAILED', 'M-Pesa could not start. Your order was saved; contact us or choose another payment method.', 502, { orderNumber: order.order_number, checkoutToken: order.checkout_token, paymentStatus: 'failed' });
      }
    }
    return NextResponse.json({ orderNumber: order.order_number, checkoutToken: order.checkout_token, paymentStatus, distanceKm, deliveryFee });
  } catch (error) {
    if (error instanceof CheckoutCartError) return fail('INVALID_CART', error.message, 400, { invalidCartIndexes: error.invalidIndexes });
    console.error('[Checkout] unexpected failure', error);
    return fail('CHECKOUT_FAILED', 'Unable to place your order right now. Please try again.', 500);
  }
}
