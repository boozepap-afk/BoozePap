import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { authCookieNames, authCookieOptions, chunkAuthCookie, readChunkedAuthCookie } from './supabase-auth-storage';
import { supabasePublicKey, supabaseUrl } from './supabase';

// Database types can be generated and substituted here after linking the production project.
// Until then, authorization is enforced by Supabase RLS rather than client-side table typing.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let browserClient: SupabaseClient<any> | null | undefined;

function browserCookies() {
  return document.cookie.split('; ').filter(Boolean).map(entry => {
    const separator = entry.indexOf('=');
    return { name: entry.slice(0, separator), value: entry.slice(separator + 1) };
  });
}

function cookieSuffix() {
  return `Path=/; Max-Age=${authCookieOptions.maxAge}; SameSite=Lax${authCookieOptions.secure ? '; Secure' : ''}`;
}

export function createBrowserSupabase() {
  if (!supabaseUrl || !supabasePublicKey) return null;
  if (browserClient !== undefined) return browserClient;
  try {
    browserClient = createClient(supabaseUrl, supabasePublicKey, {
      auth: {
        flowType: 'pkce',
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        storage: {
          getItem: (key) => readChunkedAuthCookie(key, browserCookies()),
          setItem: (key, value) => {
            const existing = browserCookies();
            authCookieNames(key, existing).forEach(name => { document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax${authCookieOptions.secure ? '; Secure' : ''}`; });
            chunkAuthCookie(key, value).forEach(cookie => { document.cookie = `${cookie.name}=${cookie.value}; ${cookieSuffix()}`; });
          },
          removeItem: (key) => { authCookieNames(key, browserCookies()).forEach(name => { document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax${authCookieOptions.secure ? '; Secure' : ''}`; }); },
        },
      },
    });
  } catch (error) {
    console.error('[Chupa Hub Supabase] Browser client configuration is invalid.', error);
    browserClient = null;
  }
  return browserClient;
}
