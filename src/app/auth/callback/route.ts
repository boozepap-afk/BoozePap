import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const oauthError = requestUrl.searchParams.get('error');
  const oauthErrorDescription = requestUrl.searchParams.get('error_description');
  const requestedNext = requestUrl.searchParams.get('next');
  const safeNext = requestedNext && /^\/(?!\/)[^\\\r\n]*$/.test(requestedNext) ? requestedNext : '/account';

  console.info('[OAuth callback] reached', {
    path: requestUrl.pathname,
    codePresent: Boolean(code),
    errorPresent: Boolean(oauthError),
    errorDescriptionPresent: Boolean(oauthErrorDescription),
    nextPresent: requestUrl.searchParams.has('next'),
  });

  if (oauthError) {
    console.error('[OAuth callback] provider error', { oauthError, oauthErrorDescription });
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(oauthErrorDescription || oauthError)}`, requestUrl.origin));
  }

  if (!code) {
    console.error('[OAuth callback] missing code', { url: requestUrl.pathname, searchParams: Array.from(requestUrl.searchParams.keys()) });
    return NextResponse.redirect(new URL('/login?error=Google+did+not+return+an+authorization+code', requestUrl.origin));
  }

  const supabase = await createServerSupabase();
  if (!supabase) return NextResponse.redirect(new URL('/login?error=Customer+login+is+not+configured', requestUrl.origin));

  console.info('[OAuth callback] exchange started');
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    console.error('[OAuth callback] exchangeCodeForSession failed', {
      name: error.name,
      message: error.message,
      status: error.status,
      code: error.code,
    });
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error.message)}`, requestUrl.origin));
  }

  console.info('[OAuth callback] session established', {
    hasSession: Boolean(data.session),
    hasUser: Boolean(data.user),
    userId: data.user?.id ?? null,
  });

  const forwardedHost = request.headers.get('x-forwarded-host');
  const destination = process.env.NODE_ENV === 'development'
    ? `${requestUrl.origin}${safeNext}`
    : forwardedHost
      ? `https://${forwardedHost}${safeNext}`
      : `${requestUrl.origin}${safeNext}`;
  console.info('[OAuth callback] final redirect', { destination });
  return NextResponse.redirect(destination);
}
