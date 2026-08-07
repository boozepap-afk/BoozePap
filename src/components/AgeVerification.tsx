'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { BrandLogo } from '@/components/BrandLogo';

const AGE_VERIFIED_KEY = 'chupahub-age-verified';

export function AgeVerification() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    if (!pathname.startsWith('/admin') && localStorage.getItem(AGE_VERIFIED_KEY) !== 'true') setVisible(true);
  }, [pathname]);

  if (!visible || pathname.startsWith('/admin')) return null;

  function confirm() {
    localStorage.setItem(AGE_VERIFIED_KEY, 'true');
    setVisible(false);
  }

  return <div className="fixed inset-0 z-[100] grid place-items-center bg-black/80 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="age-title">
    <section className="w-full max-w-md overflow-hidden rounded-2xl bg-white text-center shadow-2xl">
      <div className="bg-brand-ink px-6 py-5"><div className="flex justify-center"><BrandLogo /></div></div>
      <div className="p-6 sm:p-8">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full border-2 border-brand-gold text-2xl font-black text-brand-deep">18+</div>
        <h1 id="age-title" className="mt-5 text-2xl font-black text-brand-ink">Are you of legal drinking age?</h1>
        {denied ? <><p className="mt-3 text-sm leading-6 text-neutral-600">You must be 18 years or older to visit BoozePap. Please return when you are of legal drinking age.</p><button type="button" onClick={()=>setDenied(false)} className="mt-6 text-sm font-bold text-brand-deep underline">Go back</button></> : <>
          <p className="mt-3 text-sm leading-6 text-neutral-600">You must be at least 18 years old to enter this website. Please enjoy responsibly.</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2"><button type="button" onClick={confirm} autoFocus className="rounded-lg bg-brand-deep px-5 py-3 font-black text-white transition hover:bg-brand-orange">Yes, I am 18+</button><button type="button" onClick={()=>setDenied(true)} className="rounded-lg border border-neutral-300 px-5 py-3 font-bold text-brand-ink hover:bg-brand-soft">No, I am under 18</button></div>
        </>}
        <p className="mt-6 text-[11px] text-neutral-500">By entering, you agree to our terms and confirm that you meet the legal drinking age in Kenya.</p>
      </div>
    </section>
  </div>;
}
