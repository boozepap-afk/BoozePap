'use client';

import { useEffect } from 'react';

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error('[Chupa Hub frontend] Rendering failed', error); }, [error]);
  return <main className="mx-auto max-w-2xl px-4 py-16"><section className="rounded-3xl border border-red-100 bg-white p-8 shadow-card"><p className="font-black uppercase tracking-widest text-red-600">Live content unavailable</p><h1 className="mt-2 text-3xl font-black text-brand-ink">We could not load Chupa Hub from Supabase.</h1><p className="mt-3 text-neutral-600">The error has been logged. Check the production Supabase URL, anon key, homepage banner SELECT policy, and Vercel environment assignment.</p>{error.digest && <p className="mt-3 font-mono text-xs text-neutral-500">Error reference: {error.digest}</p>}<button onClick={reset} className="orange-gradient mt-6 rounded-xl px-6 py-3 font-black text-white">Try again</button></section></main>;
}
