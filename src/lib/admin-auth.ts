import type { SupabaseClient } from '@supabase/supabase-js';

export async function getCurrentAdmin(supabase: SupabaseClient) {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return { admin: null, error: userError };

  const { data: admin, error } = await supabase
    .from('admin_users')
    .select('user_id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle();

  return { admin, error };
}
