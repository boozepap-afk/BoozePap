'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { DbBanner } from '@/lib/supabase';
import type { DbCategory } from '@/lib/supabase';
import { SmartImage } from '@/components/SmartImage';
import { categoryCanonicalPath } from '@/lib/public-urls';

export function HeroCarousel({ banners, categories = [] }: { banners: DbBanner[]; categories?: DbCategory[] }) {
  const slides = banners.slice(0, 3);
  const [current, setCurrent] = useState(0), [paused, setPaused] = useState(false);
  useEffect(() => {
    if (slides.length < 2 || paused || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = window.setInterval(() => setCurrent(index => (index + 1) % slides.length), 3000);
    return () => window.clearInterval(timer);
  }, [slides.length, paused]);
  useEffect(() => { if (current >= slides.length) setCurrent(0); }, [slides.length, current]);
  const featuredCategories = categories.filter(category => !category.parent_id).slice(0, 6);
  if (!slides.length) return <section className="mx-auto mt-5 max-w-[1380px] rounded-xl border border-dashed border-neutral-300 bg-white p-10 text-center shadow-sm"><h1 className="text-2xl font-black text-brand-ink">Welcome to BoozePap</h1><p className="mt-2 text-neutral-600">Publish three homepage banners in the admin to start the rotating hero.</p></section>;
  const move = (direction: number) => setCurrent(index => (index + direction + slides.length) % slides.length);
  return <section className="mt-4 w-full px-4 sm:px-6">
    <div className="mb-3 hidden flex-wrap items-center justify-center gap-x-5 gap-y-2 border-y lg:justify-between border-neutral-200 bg-white px-2 py-2 text-[11px] font-bold text-neutral-700 sm:flex"><span>🚚 Delivery in as little as 30 minutes</span><span>★ Trusted by Nairobi customers</span><span>◷ Order whenever you need us</span><span>💳 Pay your preferred way</span><span>✓ Genuine products, guaranteed</span><Link href="/track-order" className="rounded-full border border-brand-orange px-3 py-1 text-brand-deep">Track your order</Link></div>
    <div className="grid items-stretch gap-4 md:grid-cols-[minmax(0,1.75fr)_minmax(310px,1fr)]">
    <div onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onTouchStart={() => setPaused(true)} onTouchEnd={() => setPaused(false)} aria-roledescription="carousel" aria-label="BoozePap promotions" className="relative overflow-hidden rounded-xl bg-neutral-100 shadow-card">
      <div className="relative aspect-[4/3] min-h-64 w-full sm:aspect-[16/7] lg:aspect-auto lg:h-full lg:min-h-[340px]">{slides.map((banner,index) => <article key={banner.id} aria-hidden={index !== current} className={`absolute inset-0 transition-opacity duration-700 ${index === current ? 'z-10 opacity-100' : 'pointer-events-none opacity-0'}`}><SmartImage src={banner.mobile_image_url || banner.image_url} alt={banner.title || 'BoozePap promotion'} sizes="(max-width: 1024px) 100vw, 65vw" priority={index === 0} quality={92} className="scale-[1.01]" /><div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/35 to-transparent"/><div className="absolute inset-y-0 left-0 flex max-w-lg flex-col justify-center p-7 text-white sm:p-10"><span className="w-fit rounded-full bg-white px-3 py-1 text-[10px] font-black uppercase tracking-wider text-brand-deep">Featured</span><h1 className="mt-4 text-3xl font-black leading-tight sm:text-4xl">{banner.title}</h1>{banner.subtitle&&<p className="mt-3 line-clamp-2 max-w-md text-sm text-white/90 sm:text-base">{banner.subtitle}</p>}{banner.button_url&&<Link href={banner.button_url} className="mt-6 w-fit rounded-full bg-white px-5 py-3 text-sm font-black text-brand-deep">{banner.button_label||'Shop now'}</Link>}</div></article>)}</div>
      {slides.length > 1 && <><button type="button" onClick={() => move(-1)} aria-label="Previous hero image" className="absolute left-3 top-1/2 z-20 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-brand-ink shadow-card"><ChevronLeft size={19}/></button><button type="button" onClick={() => move(1)} aria-label="Next hero image" className="absolute right-3 top-1/2 z-20 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-brand-ink shadow-card"><ChevronRight size={19}/></button><div className="absolute bottom-4 right-5 z-20 flex gap-2">{slides.map((banner,index) => <button key={banner.id} onClick={() => setCurrent(index)} aria-label={`Show hero image ${index + 1}`} className={`h-2.5 rounded-full shadow transition-all ${index === current ? 'w-7 bg-white' : 'w-2.5 bg-white/60'}`}/>)}</div></>}
    </div>
      <aside className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm"><h2 className="text-xl font-black text-brand-ink">What are you after?</h2><p className="mt-1 text-xs text-neutral-500">Browse our live drinks categories.</p><div className="mt-4 grid grid-cols-3 gap-2">{featuredCategories.map(category=><Link key={category.id} href={categoryCanonicalPath(category)} className="group relative min-h-24 overflow-hidden rounded-xl border border-neutral-200 text-center transition hover:border-brand-orange">{category.image_url?<SmartImage src={category.image_url} alt="" sizes="110px" className="transition duration-300 group-hover:scale-105"/>:<span aria-hidden="true" className="grid h-full min-h-24 place-items-center text-3xl">{category.icon||category.name.slice(0,1)}</span>}<span className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/90 to-transparent px-1.5 pb-2 pt-6 text-xs font-black text-white">{category.name}</span></Link>)}</div><Link href="/categories" className="mt-4 block rounded-full border-2 border-brand-orange px-4 py-2.5 text-center text-xs font-black text-brand-deep">Click for more categories →</Link></aside>
    </div>
  </section>;
}
