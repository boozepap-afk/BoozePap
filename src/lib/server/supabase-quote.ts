import { createClient } from '@supabase/supabase-js';

/** Quote reads only RLS-protected public catalogue/pricing data. It must not
 * depend on the service-role secret used later to save an order. */
export function getQuoteSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}
