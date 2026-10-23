import type { SupabaseClient } from '@supabase/supabase-js';

export function manualPriceFields(price: number) {
  if (!Number.isFinite(price) || price < 0) throw new Error('Enter a valid price of zero or more.');
  return { price, old_price: null, discount_starts_at: null, discount_ends_at: null, discount_label: null };
}

/** A returned row confirms that RLS allowed this particular size to be updated. */
export async function saveSizePrice(db: SupabaseClient, productId: string, variantId: string, price: number) {
  const fields = manualPriceFields(price);
  const { data, error } = await db.from('product_variants').update(fields)
    .eq('id', variantId).eq('product_id', productId).select('id,price').maybeSingle();
  if (error) throw error;
  if (!data || data.id !== variantId || Number(data.price) !== price) {
    throw new Error('Supabase did not confirm the new size price. Reload admin and try again.');
  }
  return Number(data.price);
}
