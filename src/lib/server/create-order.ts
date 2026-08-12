import type { SupabaseClient } from '@supabase/supabase-js';

type OrderResult = { id: string; order_number: string; checkout_token: string };

function logDatabaseError(operation: string, error: unknown) {
  const value = error as { code?: string; message?: string; details?: string; hint?: string } | null;
  console.error(`[Checkout database] ${operation} failed`, { code: value?.code, message: value?.message, details: value?.details, hint: value?.hint });
}

/** Prefer the transactional RPC. If production has not exposed that RPC yet,
 * use a compensating transaction: line failure immediately deletes the parent,
 * whose FK cascade removes any lines inserted by the same request. */
export async function createOrderWithItems(db: SupabaseClient, orderPayload: Record<string, unknown>, items: Array<Record<string, unknown>>) {
  const rpc = await db.rpc('create_checkout_order_atomic', { order_payload: orderPayload, items_payload: items });
  const rpcOrder = Array.isArray(rpc.data) ? rpc.data[0] : rpc.data;
  if (!rpc.error && rpcOrder) return { order: rpcOrder as OrderResult, error: null, method: 'rpc' as const };

  const rpcError = rpc.error as { code?: string; message?: string } | null;
  const rpcUnavailable = rpcError?.code === 'PGRST202' || rpcError?.code === '42883' || /function .* does not exist|schema cache/i.test(rpcError?.message || '');
  if (!rpcUnavailable) { logDatabaseError('create_checkout_order_atomic RPC', rpc.error); return { order: null, error: rpc.error, method: 'rpc' as const }; }
  console.warn('[Checkout database] atomic RPC unavailable; using rollback-safe insert fallback', { code: rpcError?.code, message: rpcError?.message });

  // delivery_distance_km is reporting-only and may be absent on an older live
  // schema. Do not make successful checkout depend on that optional column.
  const { delivery_distance_km: _distance, ...compatiblePayload } = orderPayload;
  void _distance;
  const inserted = await db.from('orders').insert(compatiblePayload).select('id,order_number,checkout_token').single();
  if (inserted.error || !inserted.data) { logDatabaseError('fallback order insert', inserted.error); return { order: null, error: inserted.error, method: 'fallback' as const }; }
  const itemsResult = await db.from('order_items').insert(items.map(item => ({ ...item, order_id: inserted.data.id })));
  if (!itemsResult.error) return { order: inserted.data as OrderResult, error: null, method: 'fallback' as const };

  logDatabaseError('fallback order items insert', itemsResult.error);
  const rollback = await db.from('orders').delete().eq('id', inserted.data.id);
  if (rollback.error) logDatabaseError('fallback order rollback', rollback.error);
  return { order: null, error: itemsResult.error, method: 'fallback' as const };
}
