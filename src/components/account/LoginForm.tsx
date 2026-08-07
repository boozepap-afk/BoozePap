'use client';

import { useEffect, useMemo, useState } from 'react';
import { createBrowserSupabase } from '@/lib/supabase-browser';

export function LoginForm({ initialError }: { initialError?: string }) {
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const [loading, setLoading] = useState(false), [error, setError] = useState<string | null>(initialError || null);

  useEffect(() => {
    setLoading(false);
    setError(initialError || null);
  }, [initialError]);

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);

    try {
      if (!supabase) throw new Error('Customer login is not configured. Check the public Supabase environment variables.');
      const callbackUrl = `${window.location.origin}/auth/callback?next=/account`;

      console.info('[Google OAuth] starting', {
        callbackUrl,
        origin: window.location.origin,
      });

      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: callbackUrl,
          scopes: 'openid email profile',
          skipBrowserRedirect: true,
        },
      });

      console.info('[Google OAuth] Supabase response', {
        hasUrl: Boolean(data?.url),
        error: oauthError ? {
          name: oauthError.name,
          message: oauthError.message,
          status: oauthError.status,
        } : null,
      });

      if (oauthError) throw oauthError;
      if (!data?.url) throw new Error('Supabase did not return a Google authorization URL.');

      window.location.assign(data.url);
    } catch (loginError) {
      console.error('[Google OAuth] failed', loginError);
      setError(loginError instanceof Error ? loginError.message : 'Google sign-in could not be started.');
      setLoading(false);
    }
  };

  return <section className="relative rounded-3xl bg-white p-6 shadow-card sm:p-8"><p className="font-bold uppercase tracking-wide text-brand-orange">Customer account</p><h1 className="mt-2 text-3xl font-black text-brand-ink">Sign in to BoozePap</h1><p className="mt-2 text-neutral-600">Use your Google account to reuse your customer details at checkout.</p><button type="button" onClick={() => void handleGoogleLogin()} disabled={loading} className="relative z-10 mt-7 flex w-full items-center justify-center gap-3 rounded-xl border-2 border-orange-200 bg-white px-4 py-3 font-black text-brand-ink hover:bg-orange-50 disabled:cursor-wait disabled:opacity-50"><span aria-hidden="true" className="grid h-7 w-7 place-items-center rounded-full bg-white text-lg font-black text-blue-600 shadow">G</span>{loading ? 'Opening Google…' : 'Continue with Google'}</button>{error && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}<p className="mt-5 text-xs leading-5 text-neutral-500">Signing in is optional. You can continue shopping and complete checkout as a guest.</p></section>;
}
