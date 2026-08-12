import type { SupabaseClient } from '@supabase/supabase-js';
import { deliveryPricingFromRow } from '@/lib/server/delivery';

export async function getActiveDeliveryPricing(db: SupabaseClient, requestId: string) {
  // select('*') intentionally avoids asking PostgREST for columns absent from a
  // production schema; limit(1)+maybeSingle also tolerates multiple active rows.
  const { data, error } = await db.from('delivery_settings').select('*').eq('is_active', true).order('sort_order').limit(1).maybeSingle();
  if (error) {
    console.error('[Checkout quote] delivery_settings query failed', { requestId, code: error.code, message: error.message, details: error.details, hint: error.hint });
    return { pricing: null, error };
  }
  return { pricing: data ? deliveryPricingFromRow(data as Record<string, unknown>) : null, error: null };
}
