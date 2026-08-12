import type { SupabaseClient } from '@supabase/supabase-js';

type OrderResult = { id: string; order_number: string; checkout_token: string };

function logDatabaseError(stage: 'ORDER_INSERT' | 'ORDER_ITEMS_INSERT', operation: string, error: unknown) {
  const value = error as { code?: string; message?: string; details?: string; hint?: string } | null;
  console.error(`[Checkout] ${stage}`, { operation, code: value?.code, message: value?.message, details: value?.details, hint: value?.hint });
}

/** Prefer the transactional RPC. If production has not exposed that RPC yet,
 * use a compensating transaction: line failure immediately deletes the parent,
 * whose FK cascade removes any lines inserted by the same request. */
export async function createOrderWithItems(db: SupabaseClient, orderPayload: Record<string, unknown>, items: Array<Record<string, unknown>>) {
  const rpc = await db.rpc('create_checkout_order_atomic', { order_payload: orderPayload, items_payload: items });
  const rpcOrder = Array.isArray(rpc.data) ? rpc.data[0] : rpc.data;
  if (!rpc.error && rpcOrder) return { order: rpcOrder as OrderResult, error: null, method: 'rpc' as const };

  const rpcError = rpc.error as { code?: string; message?: string; details?: string; hint?: string } | null;
  // A deployed function can still fail because its cached definition predates
  // the live tables. Log the evidence and attempt the compatible insert path
  // for every RPC failure, not only PGRST202/missing-function failures.
  logDatabaseError('ORDER_INSERT', 'create_checkout_order_atomic RPC; trying compatible fallback', rpc.error);

  // delivery_distance_km is reporting-only and may be absent on an older live
  // schema. Do not make successful checkout depend on that optional column.
  const compatibleKeys = [
    'customer_id', 'delivery_location_id', 'order_number', 'customer_name', 'customer_email', 'customer_phone',
    'delivery_address', 'gps_lat', 'gps_lng', 'gift_note', 'payment_method', 'payment_status', 'status',
    'subtotal', 'delivery_fee', 'discount_total', 'total',
  ];
  const compatiblePayload = Object.fromEntries(compatibleKeys.filter(key => key in orderPayload).map(key => [key, orderPayload[key]]));
  const inserted = await db.from('orders').insert(compatiblePayload).select('id,order_number,checkout_token').single();
  if (inserted.error || !inserted.data) { logDatabaseError('ORDER_INSERT', 'fallback order insert', inserted.error); return { order: null, error: inserted.error, method: 'fallback' as const }; }
  const itemsResult = await db.from('order_items').insert(items.map(item => ({ ...item, order_id: inserted.data.id })));
  if (!itemsResult.error) return { order: inserted.data as OrderResult, error: null, method: 'fallback' as const };

  logDatabaseError('ORDER_ITEMS_INSERT', 'fallback order items insert', itemsResult.error);
  const rollback = await db.from('orders').delete().eq('id', inserted.data.id);
  if (rollback.error) logDatabaseError('ORDER_INSERT', 'fallback order rollback', rollback.error);
  return { order: null, error: itemsResult.error, method: 'fallback' as const };
}
