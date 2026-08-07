'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Heart, MapPin as MapPinIcon, MessageCircle, Search, ShoppingBag, UserCircle } from 'lucide-react';
import { DbCategory, DbProduct, effectivePrice, imageFor, money, SiteContent } from '@/lib/supabase';
import { readCart, writeCart } from '@/lib/cart';
import { BrandLogo } from '@/components/BrandLogo';
import { SmartImage } from '@/components/SmartImage';

function animateProductToCart(source: HTMLButtonElement) {
  const image = source.parentElement?.querySelector('img'), cart = document.querySelector('[data-cart-icon]');
  if (!image || !cart || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const from = image.getBoundingClientRect(), to = cart.getBoundingClientRect(), clone = image.cloneNode(true) as HTMLImageElement;
  Object.assign(clone.style, { position: 'fixed', zIndex: '80', pointerEvents: 'none', objectFit: 'contain', left: `${from.left}px`, top: `${from.top}px`, width: `${from.width}px`, height: `${from.height}px`, transition: 'transform 600ms cubic-bezier(.2,.8,.2,1), opacity 600ms ease' });
  document.body.appendChild(clone);
  requestAnimationFrame(() => { clone.style.transform = `translate(${to.left - from.left}px, ${to.top - from.top}px) scale(.12)`; clone.style.opacity = '0.2'; });
  window.setTimeout(() => clone.remove(), 650);
}

function searchScore(product: DbProduct, query: string) {
  const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const name = product.name.toLowerCase();
  const searchable = `${name} ${product.brands?.name || ''} ${product.categories?.name || ''} ${product.description || ''} ${product.bottle_size || ''} ${(product.product_variants || []).map(variant => variant.name).join(' ')}`.toLowerCase();
  if (!words.every(word => searchable.includes(word))) return -1;
  return words.reduce((score, word) => score + (name.startsWith(word) ? 10 : name.split(/\s+/).some(part => part.startsWith(word)) ? 6 : name.includes(word) ? 3 : 1), 0);
}

export function Header({ content = {}, products = [] }: { content?: SiteContent; products?: DbProduct[] }) {
  const [cart, setCart] = useState<{ count: number; total: number }>({ count: 0, total: 0 }), [query, setQuery] = useState(''), [location, setLocation] = useState('Deliver to');
  const refresh = () => { try { const items = JSON.parse(localStorage.getItem('chupahub-cart') || '[]'); setCart({ count: items.reduce((n:number,item:{quantity?:number}) => n + Number(item.quantity || 0), 0), total: items.reduce((n:number,item:{quantity?:number;price?:number}) => n + Number(item.quantity || 0) * Number(item.price || 0), 0) }); setLocation(localStorage.getItem('chupahub-delivery-label') || 'Deliver to'); } catch { setCart({ count: 0, total: 0 }); } };
  useEffect(() => { refresh(); window.addEventListener('chupahub-cart-updated', refresh); window.addEventListener('chupahub-location-updated', refresh); return () => { window.removeEventListener('chupahub-cart-updated', refresh); window.removeEventListener('chupahub-location-updated', refresh); }; }, []);
  const primaryLinks = [['Shop','/shop'],['Beer','/beer'],['Wine','/wine'],['Whisky','/whisky'],['Gin','/gin'],['Vodka','/vodka'],['Offers','/offers'],['Track Order','/track-order'],['Contact','/contact']];
  const suggestions = query.trim().length < 1 ? [] : products.map(product => ({ product, score: searchScore(product, query) })).filter(result => result.score >= 0).sort((a, b) => b.score - a.score || a.product.name.localeCompare(b.product.name)).slice(0, 6).map(result => result.product);
  return <header className="brand-gradient sticky top-0 z-40">
    <div className="flex items-center justify-between gap-2 px-3 py-2 text-xs font-bold text-white sm:px-5"><span>{content.header_notice || 'FREE DELIVERY ON ORDERS OF KES 10,000 OR MORE'}</span><span className="hidden sm:inline">Reliable delivery · Drink responsibly — 18+ only</span></div>
    <div className="flex w-full flex-wrap items-center gap-3 px-3 py-3 sm:px-5">
      <Link href="/" className="flex shrink-0 items-center" aria-label="BoozePap home"><BrandLogo src={content.logo_url} /></Link>
      <Link href="/checkout" className="hidden max-w-40 truncate rounded-xl bg-orange-50 px-3 py-2 text-xs font-bold text-brand-ink lg:block"><MapPinIcon className="mr-1 inline text-brand-orange" size={15}/>{location}</Link>
      <div className="relative order-4 w-full md:order-none md:min-w-64 md:flex-1"><Search className="absolute left-3 top-3 text-brand-orange" size={20}/><input value={query} onChange={e=>setQuery(e.target.value)} className="w-full rounded-xl border-2 border-orange-100 bg-white py-2.5 pl-10 pr-4 text-sm outline-none focus:border-brand-orange" placeholder="Search products, brands and categories" aria-label="Search products"/>{suggestions.length > 0 && <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-xl border border-orange-100 bg-white shadow-card">{suggestions.map(p => <Link key={p.id} href={`/product/${p.slug}`} onClick={()=>setQuery('')} className="flex items-center gap-3 p-3 hover:bg-orange-50"><img src={imageFor(p)} alt="" className="h-10 w-10 object-contain"/><span className="min-w-0 flex-1"><b className="block truncate">{p.name}</b><small>{p.bottle_size || p.product_variants?.[0]?.name || 'Select size'} · {money(p.product_variants?.[0]?.price ?? p.price)}</small></span></Link>)}<Link href={`/category/all?q=${encodeURIComponent(query)}`} className="block border-t border-orange-100 p-3 text-sm font-black text-brand-orange">View all results</Link></div>}</div>
      <div className="ml-auto flex items-center gap-3 text-white"><a href="https://wa.me/" aria-label="Contact BoozePap on WhatsApp" className="hidden sm:block"><MessageCircle/></a><Link href="/account" aria-label="Account"><UserCircle/></Link><Link href="/wishlist" className="relative" aria-label="Wishlist"><Heart/><span className="absolute -right-2 -top-2 rounded-full bg-brand-ink px-1.5 text-[10px] font-black text-white">0</span></Link><Link href="/checkout" data-cart-icon className="relative flex items-center gap-1" aria-label="Cart"><ShoppingBag/><span className="absolute -right-2 -top-2 rounded-full bg-brand-ink px-1.5 text-[10px] font-black text-white">{cart.count}</span><span className="hidden text-xs font-black lg:inline">{money(cart.total)}</span></Link></div>
    </div>
    <nav aria-label="Primary navigation" className="flex w-full gap-1.5 overflow-x-auto border-t border-white/15 px-3 py-2 [scrollbar-width:none] sm:justify-center sm:px-5 [&::-webkit-scrollbar]:hidden">{primaryLinks.map(([label,href]) => <Link key={href} href={href} className="shrink-0 rounded-full border border-white/25 bg-white/95 px-3 py-1.5 text-xs font-semibold text-brand-ink shadow-sm transition hover:bg-orange-50 sm:px-3.5">{label}</Link>)}</nav>
  </header>;
}

export function Footer({ content = {}, products = [] }: { content?: SiteContent; products?: DbProduct[] }) {
  const socialLinks = [['Instagram', content.instagram_url], ['Facebook', content.facebook_url], ['TikTok', content.tiktok_url], ['WhatsApp', content.whatsapp_url]].filter(([, url]) => Boolean(url));
  return <footer className="brand-gradient mt-16 text-left text-white"><div className="w-full px-3 py-8 sm:px-5"><section><BrandLogo footer src={content.logo_url} /><p className="mt-4 max-w-sm text-sm leading-6 text-white/75">{content.footer_text || 'Premium drinks delivered responsibly across Nairobi.'}</p>{socialLinks.length > 0 && <div className="mt-5 flex flex-wrap gap-3">{socialLinks.map(([name,url]) => <a key={name} href={url} target="_blank" rel="noreferrer" className="rounded-full border border-white/20 px-3 py-1.5 text-sm font-bold hover:border-brand-ink hover:text-brand-ink">{name}</a>)}</div>}</section><div className="mt-10 grid gap-10 sm:grid-cols-2 lg:grid-cols-3"><nav aria-label="Shop"><h2 className="font-black text-brand-ink">{content.footer_shop_title || 'Shop'}</h2><div className="mt-4 grid gap-3 text-sm text-white/75"><Link href="/category/all">All products</Link><Link href="/category/wine">Wines</Link><Link href="/category/whisky">Whisky</Link><Link href="/collections/new-arrivals">New arrivals</Link></div></nav><nav aria-label="Customer help"><h2 className="font-black text-brand-ink">{content.footer_help_title || 'Customer care'}</h2><div className="mt-4 grid gap-3 text-sm text-white/75"><Link href="/about">About BoozePap</Link><Link href="/contact">Contact</Link><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link></div></nav><section><h2 className="font-black text-brand-ink">{content.footer_contact_title || 'Contact us'}</h2><div className="mt-4 space-y-3 text-sm text-white/75">{content.contact_phone && <a className="block" href={`tel:${content.contact_phone}`}>{content.contact_phone}</a>}{content.contact_email && <a className="block break-all" href={`mailto:${content.contact_email}`}>{content.contact_email}</a>}<p>Fast, responsible delivery · 18+ only</p></div></section></div></div><div className="border-t border-white/10 px-3 py-5 text-left text-xs text-white/55">{content.copyright_text || `© ${new Date().getFullYear()} BoozePap. Drink responsibly.`}</div></footer>;
}

export function Journal({ content = {} }: { content?: SiteContent }) {
  const title = content.journal_title || 'BoozePap Journal';
  const intro = content.journal_intro || 'Discover practical guides to choosing wine, whisky, beer and party drinks for every Nairobi occasion. Explore responsibly, compare styles and find the right bottle for your celebration.';
  return <section className="mx-auto max-w-5xl px-4 py-10"><div className="rounded-3xl border border-orange-100 bg-white p-6 shadow-card sm:p-8"><p className="font-bold uppercase tracking-[0.18em] text-brand-orange">Drink guides & ideas</p><h2 className="mt-2 text-3xl font-black text-brand-ink">{title}</h2><p className="mt-3 max-w-3xl leading-7 text-slate-700">{intro}</p><p className="mt-4 text-sm leading-6 text-slate-600">BoozePap helps Nairobi customers shop wine, whisky, gin, vodka, beer, mixers and snacks with clear product details and responsible delivery information.</p></div></section>;
}

export function SeoArticle({ content = {} }: { content?: SiteContent }) {
  const title = content.article_title || "BoozePap Deliveries – Kenya's Online Alcohol & Drinks Delivery Platform";
  const summary = content.article_summary || 'Discover wines, spirits, beers, champagne and mixers online with convenient BoozePap delivery.';
  const body = content.article_body || `BoozePap Deliveries is a fast, convenient online platform for ordering wines, spirits, beers, champagne, whisky, gin, vodka, tequila, rum, ciders, mixers, and other beverages for delivery across Kenya. Whether you're planning a celebration, stocking your home bar, or simply need a quick delivery, BoozePap makes ordering drinks online simple and reliable.

If you're familiar with delivery services and retailers such as Chupa Chap, Oaks & Corks, Greenspoon, Quickmart, The Bar KE, or other well-known shops in Kenya, BoozePap offers a convenient independent marketplace where you can discover a wide selection of drinks and have them delivered to your location.

Customers searching for terms such as:

• Chupa Chap
• Oaks & Corks
• Greenspoon
• Quickmart
• The Bar KE
• online alcohol delivery Kenya
• online drinks delivery Nairobi
• liquor delivery near me
• wine delivery Nairobi
• whisky delivery Kenya
• beer delivery
• champagne delivery
• gin delivery
• vodka delivery
• tequila delivery
• same-day alcohol delivery
• drinks delivery
• buy alcohol online
• buy wine online Kenya
• premium liquor store
• online liquor shop
• alcohol delivery service
• drinks delivered to your door

can use BoozePap to browse products, compare options, and order quickly from one easy-to-use platform.

Our goal is to make finding and ordering your favorite drinks as easy as ordering food online. Whether you're looking for premium whisky, fine wine, craft beer, champagne, spirits, or mixers, BoozePap provides a secure and convenient shopping experience with fast delivery and excellent customer service.

BoozePap Deliveries is designed for customers who want a trusted alternative when searching online for alcohol delivery services in Kenya. If you're comparing online liquor stores, wine delivery, beer delivery, or drink delivery services such as Chupa Chap, Oaks & Corks, Greenspoon, Quickmart, or The Bar KE, BoozePap is ready to help you find what you need.

Please note that BoozePap is an independent platform and is not affiliated with, endorsed by, or operated by Chupa Chap, Oaks & Corks, Greenspoon, Quickmart, The Bar KE, or other third-party brands referenced for comparison. All trademarks remain the property of their respective owners.

BoozePap Deliveries promotes responsible drinking and only serves customers who are of legal drinking age.`;
  const articles = content.articles?.filter(article => article.is_active !== false && article.title.trim() && article.body.trim()) || [];
  const visibleArticles = articles.length ? articles : [{ id: 'default', title, summary, body, is_active: true }];
  return <section className="mx-auto max-w-4xl space-y-3 px-4 pb-10">{visibleArticles.map(article => <details key={article.id} className="group rounded-2xl border border-orange-100 bg-white px-5 py-4 text-sm shadow-sm"><summary className="cursor-pointer list-none font-black text-brand-ink"><span className="text-brand-orange">Journal</span> · {article.title}<span className="float-right text-brand-orange group-open:hidden">Read article</span><span className="float-right hidden text-brand-orange group-open:inline">Close</span></summary>{article.summary && <p className="mt-2 text-neutral-500">{article.summary}</p>}<article className="mt-4 border-t border-orange-100 pt-4 leading-7 text-neutral-700"><h2 className="text-xl font-black text-brand-ink">{article.title}</h2><p className="mt-3 whitespace-pre-line">{article.body}</p></article></details>)}</section>;
}

export function CategoryGrid({ categories }: { categories: DbCategory[] }) {
  return <section className="mx-auto grid grid-cols-3 gap-2 px-3 py-4 sm:grid-cols-4 sm:px-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-12">{categories.map((category) => <Link href={`/category/${category.slug}`} key={category.id} className="group relative aspect-[4/3] overflow-hidden rounded-lg bg-neutral-100 shadow-sm ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:shadow-card"><SmartImage src={category.image_url || 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&w=700&q=80'} alt={`${category.name} category`} sizes="(max-width: 640px) 33vw, (max-width: 768px) 25vw, (max-width: 1024px) 17vw, (max-width: 1280px) 13vw, 9vw" className="transition duration-500 group-hover:scale-[1.03]" /><div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/75 to-transparent" /><div className="absolute inset-x-0 bottom-0 px-2 py-1.5 text-white"><h2 className="truncate text-[11px] font-semibold tracking-wide sm:text-xs">{category.name}</h2></div></Link>)}</section>;
}

export function ProductCard({ p }: { p: DbProduct }) {
  const [adding, setAdding] = useState(false);
  const variants = (p.product_variants || []).filter((variant) => variant.is_active !== false);
  const firstVariant = variants[0], pricing = effectivePrice(firstVariant || p), price = pricing.price, oldPrice = pricing.oldPrice;
  const discount = oldPrice ? Math.round((1 - price / oldPrice) * 100) : 0;
  const available = variants.length ? variants.some((variant) => Number(variant.stock) > 0) : Number(p.stock || 0) > 0;
  function add(event: React.MouseEvent<HTMLButtonElement>) { event.preventDefault(); event.stopPropagation(); if (!available || adding) return; setAdding(true); const cart = readCart(), variant = firstVariant, stock = variant?.stock ?? p.stock ?? 1; const current = cart.find((item) => item.productId === p.id && item.variantId === variant?.id), previousQuantity = current?.quantity ?? 0, nextQuantity = Math.min(previousQuantity + 1, stock); if (nextQuantity <= previousQuantity) { setAdding(false); return; } if (current) current.quantity = nextQuantity; else cart.push({ productId: p.id, variantId: variant?.id, name: p.name, size: variant?.name || p.bottle_size, price, image: imageFor(p), quantity: nextQuantity, stock }); const item = cart.find((entry) => entry.productId === p.id && entry.variantId === variant?.id)!; writeCart(cart, { item: { ...item }, quantityAdded: nextQuantity - previousQuantity }); animateProductToCart(event.currentTarget); window.setTimeout(() => setAdding(false), 600); }
  return <Link href={`/product/${p.slug}`} className="block min-w-0 rounded-2xl bg-white p-2 transition hover:-translate-y-1 hover:shadow-card"><div className="relative aspect-[4/5] overflow-hidden rounded-xl bg-white"><SmartImage src={imageFor(p)} alt={`${p.name} product image`} sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 20vw" fit="contain" className="p-1 transition-transform duration-300 hover:scale-[1.03]" /><button type="button" aria-label={`Add ${p.name} to cart`} onClick={add} className="absolute right-2 top-2 grid h-9 w-9 place-items-center rounded-full bg-brand-orange text-lg font-black text-white shadow-orange transition hover:scale-105 disabled:bg-neutral-300" disabled={!available || adding}>{adding ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-r-transparent"/> : available ? '+' : '×'}</button>{variants.length > 1 && <span className="absolute bottom-2 left-2 rounded-full bg-white/95 px-2 py-1 text-[10px] font-black text-brand-deep shadow-sm">{variants.length} sizes</span>}</div><div className="pt-3"><div className="flex flex-wrap items-center gap-2"><b className="rounded-md bg-brand-orange px-2 py-1 text-base leading-none text-white"><span className="text-[11px] text-white">KSh</span> {Number(price).toLocaleString('en-KE')}</b>{discount > 0 && <span className="text-xs font-black text-brand-deep">{discount}% off</span>}{oldPrice && <s className="text-sm text-neutral-500">{money(oldPrice)}</s>}</div><h3 className="mt-2 min-h-9 text-[13px] font-medium leading-tight text-brand-ink">{p.name}</h3><p className={`mt-0.5 text-[10px] uppercase tracking-wide ${available ? 'text-green-700' : 'text-red-600'}`}>{p.abv != null ? `${p.abv}% ABV` : 'ABV not specified'} · {available ? 'Available' : 'Out of stock'}</p></div></Link>;
}

/** A sellable bottle size is shown as its own catalog card while retaining the
 * parent product record for shared editorial information and inventory links. */
export function ProductVariantCard({ product, variant }: { product: DbProduct; variant: NonNullable<DbProduct['product_variants']>[number] }) {
  const [adding, setAdding] = useState(false);
  const pricing = effectivePrice(variant), oldPrice = pricing.oldPrice;
  const discount = oldPrice ? Math.round((1 - pricing.price / oldPrice) * 100) : 0;
  const available = Number(variant.stock) > 0;
  function add(event: React.MouseEvent<HTMLButtonElement>) { event.preventDefault(); event.stopPropagation(); if (!available || adding) return; setAdding(true); const cart = readCart(), current = cart.find(item => item.productId === product.id && item.variantId === variant.id), previousQuantity = current?.quantity ?? 0, nextQuantity = Math.min(previousQuantity + 1, variant.stock); if (nextQuantity <= previousQuantity) { setAdding(false); return; } if (current) current.quantity = nextQuantity; else cart.push({ productId: product.id, variantId: variant.id, name: product.name, size: variant.name, price: pricing.price, image: variant.image_url || imageFor(product), quantity: nextQuantity, stock: variant.stock }); const item = cart.find(entry => entry.productId === product.id && entry.variantId === variant.id)!; writeCart(cart, { item: { ...item }, quantityAdded: nextQuantity - previousQuantity }); animateProductToCart(event.currentTarget); window.setTimeout(() => setAdding(false), 600); }
  return <Link href={`/product/${product.slug}?variant=${encodeURIComponent(variant.id)}`} className="block min-w-0 rounded-2xl bg-white p-2 transition hover:-translate-y-1 hover:shadow-card"><div className="relative aspect-[4/5] overflow-hidden rounded-xl bg-white"><SmartImage src={variant.image_url || imageFor(product)} alt={`${product.name} ${variant.name} product image`} sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 20vw" fit="contain" className="p-1 transition-transform duration-300 hover:scale-[1.03]" /><button type="button" aria-label={`Add ${product.name} ${variant.name} to cart`} onClick={add} disabled={!available || adding} className="absolute right-2 top-2 grid h-9 w-9 place-items-center rounded-full bg-brand-orange text-lg font-black text-white shadow-orange transition hover:scale-105 disabled:bg-neutral-300">{adding ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-r-transparent"/> : available ? '+' : '×'}</button></div><div className="pt-3"><div className="flex flex-wrap items-center gap-2"><b className="rounded-md bg-brand-orange px-2 py-1 text-base leading-none text-white"><span className="text-[11px] text-white">KSh</span> {Number(pricing.price).toLocaleString('en-KE')}</b>{discount > 0 && <span className="text-xs font-black text-brand-deep">{discount}% off</span>}{oldPrice && <s className="text-sm text-neutral-500">{money(oldPrice)}</s>}</div><h3 className="mt-2 min-h-9 text-[13px] font-medium leading-tight text-brand-ink">{product.name}</h3><p className={`mt-0.5 text-[10px] uppercase tracking-wide ${available ? 'text-green-700' : 'text-red-600'}`}>{product.abv != null ? `${product.abv}% ABV` : 'ABV not specified'} · {available ? 'Available' : 'Out of stock'}</p></div></Link>;
}

function CatalogCards({ products, limit }: { products: DbProduct[]; limit?: number }) {
  return <>{products.flatMap((product) => {
    const activeVariants = (product.product_variants || []).filter((variant) => variant.is_active !== false);
    // Keep the parent card for the first/default offering, and surface every
    // additional bottle size as a separately clickable catalog product.
    return [<ProductCard key={product.id} p={product} />, ...activeVariants.slice(1).map((variant) => <ProductVariantCard key={variant.id} product={product} variant={variant} />)];
  }).slice(0, limit)}</>;
}

export function ProductRail({ title, products, href, limit = 8 }: { title: string; products: DbProduct[]; href: string; limit?: number }) {
  return <section className="mx-auto max-w-none overflow-hidden px-6 py-8"><div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-extrabold tracking-tight text-brand-ink">{title}</h2><Link href={href} className="font-bold text-brand-orange">View all {title}</Link></div><div className="product-rail-grid"><CatalogCards products={products} limit={limit} /></div></section>;
}
