'use client';

import { LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { createBrowserSupabase } from '@/lib/supabase-browser';

export function SignOutButton() {
  const supabase = useMemo(() => createBrowserSupabase(), []), router = useRouter();
  const [busy, setBusy] = useState(false);
  async function signOut() {
    if (!supabase) return;
    setBusy(true);
    await supabase.auth.signOut();
    router.replace('/login');
    router.refresh();
  }
  return <button type="button" onClick={() => void signOut()} disabled={busy} className="mt-6 inline-flex items-center gap-2 rounded-xl border border-red-200 px-5 py-3 font-black text-red-700 disabled:opacity-50"><LogOut size={18}/>{busy ? 'Signing out…' : 'Sign out'}</button>;
}
