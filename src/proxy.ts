import { createClient } from '@supabase/supabase-js';
import { type NextRequest, NextResponse } from 'next/server';
import { authCookieNames, authCookieOptions, chunkAuthCookie, readChunkedAuthCookie } from '@/lib/supabase-auth-storage';
import { supabasePublicKey, supabaseUrl } from '@/lib/supabase';

export async function proxy(request: NextRequest) {
  // Next.js config redirects match paths case-insensitively, so declaring
  // `/Beer -> /beer` there also matches `/beer` and creates a redirect loop.
  // Compare the original pathname here to redirect only the legacy casing.
  const legacyCategoryPaths: Record<string, string> = {
    '/Beer': '/beer', '/Beers': '/beer',
    '/Wine': '/wine', '/Wines': '/wine',
    '/Gin': '/gin', '/Gins': '/gin',
  };
  const categoryDestination = legacyCategoryPaths[request.nextUrl.pathname];
  if (categoryDestination) return NextResponse.redirect(new URL(categoryDestination, request.url), 308);

  const response = NextResponse.next({ request });
  if (!supabaseUrl || !supabasePublicKey) return response;
  const supabase = createClient(supabaseUrl, supabasePublicKey, {
    auth: {
      flowType: 'pkce',
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: true,
      storage: {
        getItem: (key) => readChunkedAuthCookie(key, request.cookies.getAll()),
        setItem: (key, value) => {
          const existing = request.cookies.getAll();
          authCookieNames(key, existing).forEach(name => {
            request.cookies.delete(name);
            response.cookies.set(name, '', { ...authCookieOptions, maxAge: 0 });
          });
          chunkAuthCookie(key, value).forEach(cookie => {
            request.cookies.set(cookie.name, cookie.value);
            response.cookies.set(cookie.name, cookie.value, authCookieOptions);
          });
        },
        removeItem: (key) => {
          authCookieNames(key, request.cookies.getAll()).forEach(name => {
            request.cookies.delete(name);
            response.cookies.set(name, '', { ...authCookieOptions, maxAge: 0 });
          });
        },
      },
    },
  });
  await supabase.auth.getUser();
  return response;
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'] };
