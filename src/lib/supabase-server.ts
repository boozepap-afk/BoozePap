import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { authCookieNames, authCookieOptions, chunkAuthCookie, readChunkedAuthCookie } from '@/lib/supabase-auth-storage';
import { supabasePublicKey, supabaseUrl } from '@/lib/supabase';

export async function createServerSupabase() {
  if (!supabaseUrl || !supabasePublicKey) return null;
  const cookieStore = await cookies();
  return createClient(supabaseUrl, supabasePublicKey, {
    auth: {
      flowType: 'pkce',
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: true,
      storage: {
        getItem: (key) => readChunkedAuthCookie(key, cookieStore.getAll()),
        setItem: (key, value) => {
          const existing = cookieStore.getAll();
          authCookieNames(key, existing).forEach(name => cookieStore.set(name, '', { ...authCookieOptions, maxAge: 0 }));
          const chunks = chunkAuthCookie(key, value);
          chunks.forEach(cookie => cookieStore.set(cookie.name, cookie.value, authCookieOptions));
          console.info('[Supabase SSR] session cookie write', { cookieName: key, chunks: chunks.length });
        },
        removeItem: (key) => { authCookieNames(key, cookieStore.getAll()).forEach(name => cookieStore.set(name, '', { ...authCookieOptions, maxAge: 0 })); },
      },
    },
  });
}
