'use client';

import { useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { SlidersHorizontal, X } from 'lucide-react';
import { ProductCard, ProductVariantCard } from '@/components/Site';
import type { DbProduct } from '@/lib/supabase';

type FacetKey = 'wine_type'|'grape_variety'|'country'|'abv'|'price'|'bottle_size'|'sweetness'|'brand'|'whisky_type'|'age_statement'|'beer_type'|'pack_size'|'product_format'|'gin_style'|'flavour';
type Facet = { key: FacetKey; label: string };
const common: Facet[] = [{key:'country',label:'Country of origin'},{key:'brand',label:'Brand'},{key:'abv',label:'Alcohol percentage / ABV'},{key:'bottle_size',label:'Bottle size'},{key:'price',label:'Price'}];
const configs: Record<string, Facet[]> = {
  wine: [{key:'wine_type',label:'Wine type'},{key:'grape_variety',label:'Grape variety'},...common.slice(0,1),{key:'abv',label:'Alcohol percentage / ABV'},{key:'price',label:'Price'},{key:'bottle_size',label:'Bottle size'},{key:'sweetness',label:'Sweetness'},{key:'brand',label:'Brand'}],
  whisky: [{key:'country',label:'Country of origin'},{key:'brand',label:'Brand'},{key:'whisky_type',label:'Whisky type'},{key:'age_statement',label:'Age statement'},...common.slice(2)],
  beer: [{key:'brand',label:'Brand'},{key:'beer_type',label:'Beer type'},{key:'country',label:'Country of origin'},{key:'pack_size',label:'Pack size'},{key:'product_format',label:'Bottle or can'},{key:'abv',label:'ABV'},{key:'price',label:'Price'}],
  gin: [{key:'brand',label:'Brand'},{key:'country',label:'Country of origin'},{key:'gin_style',label:'Gin style'},{key:'flavour',label:'Flavour'},...common.slice(2)],
  vodka: [{key:'brand',label:'Brand'},{key:'country',label:'Country of origin'},{key:'flavour',label:'Flavour'},...common.slice(2)],
};
const abvRanges = [['Under 5%','0','5'],['5%–10%','5','10'],['10%–12%','10','12'],['12%–13%','12','13'],['13%–14%','13','14'],['14% and above','14','999']];
const priceRanges = [['Under KES 1,000','0','1000'],['KES 1,000–2,000','1000','2000'],['KES 2,000–3,000','2000','3000'],['KES 3,000–5,000','3000','5000'],['KES 5,000–10,000','5000','10000'],['Above KES 10,000','10000','999999999']];
const wineOptions: Partial<Record<FacetKey, string[]>> = {
  wine_type: ['Red Wine','White Wine','Rosé Wine','Sparkling Wine','Champagne','Dessert Wine'],
  grape_variety: ['Cabernet Sauvignon','Sauvignon Blanc','Chardonnay','Merlot','Pinot Noir','Shiraz / Syrah','Malbec','Chenin Blanc','Riesling','Pinot Grigio','Tempranillo','Grenache'],
  country: ['Argentina','Australia','Austria','Brazil','Bulgaria','Canada','Chile','China','Croatia','France','Georgia','Germany','Greece','Hungary','India','Israel','Italy','Japan','Kenya','Lebanon','Mexico','Moldova','New Zealand','Portugal','Romania','Slovenia','South Africa','Spain','United Kingdom','United States','Uruguay'],
  bottle_size: ['187ml','375ml','500ml','750ml','1L','1.5L'],
  sweetness: ['Dry','Semi-dry','Semi-sweet','Sweet'],
};
const COLLAPSED_OPTION_COUNT = 6;

function value(product: DbProduct, key: FacetKey) {
  if (key === 'brand') return product.brands?.name || '';
  return String(product[key as keyof DbProduct] || '').trim();
}
function matchesRange(number: number, encoded: string) { const [min,max] = encoded.split('-').map(Number); return number >= min && number < max; }

export function CategoryCatalog({ title, slug, products }: { title: string; slug: string; products: DbProduct[] }) {
  const router = useRouter(), pathname = usePathname(), params = useSearchParams();
  const [drawer,setDrawer] = useState(false), [expanded,setExpanded] = useState<Partial<Record<FacetKey,boolean>>>({});
  const facets = configs[slug] || common;
  const selected = (key: FacetKey) => params.getAll(key);
  const minPrice = params.get('min_price') || '', maxPrice = params.get('max_price') || '';
  const update = (key: string, next: string[]) => { const copy = new URLSearchParams(params.toString()); copy.delete(key); next.forEach(item => copy.append(key,item)); copy.delete('page'); router.replace(`${pathname}${copy.size ? `?${copy}` : ''}`, { scroll: false }); };
  const toggle = (key: FacetKey, option: string) => { const values = selected(key); update(key, values.includes(option) ? values.filter(item => item !== option) : [...values,option]); };
  const productMatches = (product: DbProduct, ignored?: FacetKey) => facets.every(({key}) => {
    if (key === ignored) return true;
    const choices = selected(key); if (!choices.length) return true;
    if (key === 'abv') return choices.some(range => matchesRange(Number(product.abv || 0),range));
    if (key === 'price') return choices.some(range => matchesRange(Number(product.price),range));
    return choices.includes(value(product,key));
  }) && (!minPrice || product.price >= Number(minPrice)) && (!maxPrice || product.price <= Number(maxPrice));
  const filtered = useMemo(() => products.filter(product => productMatches(product)), [products, params.toString()]);
  const sorted = [...filtered].sort((a,b) => params.get('sort') === 'price-asc' ? a.price-b.price : params.get('sort') === 'price-desc' ? b.price-a.price : a.name.localeCompare(b.name));
  const options = (key: FacetKey) => {
    const ranges = key === 'abv' ? abvRanges : key === 'price' ? priceRanges : null;
    if (ranges) return ranges.map(([label,min,max]) => ({ label, value:`${min}-${max}`, count:products.filter(p => productMatches(p,key) && matchesRange(Number(key === 'abv' ? p.abv || 0 : p.price),`${min}-${max}`)).length })).filter(x=>x.count);
    const available = products.map(p=>value(p,key)).filter(Boolean);
    const seeded = slug === 'wine' ? wineOptions[key] || [] : [];
    return [...new Set([...seeded,...available])].sort().map(option => ({label:option,value:option,count:products.filter(p=>productMatches(p,key)&&value(p,key)===option).length})).filter(option => seeded.includes(option.value) || option.count > 0);
  };
  const active = facets.flatMap(f=>selected(f.key).map(v=>({key:f.key,value:v,label:options(f.key).find(o=>o.value===v)?.label||v})));
  const clear = () => router.replace(pathname,{scroll:false});
  const sidebar = <div className="flex h-full flex-col bg-white"><div className="flex items-center justify-between border-b px-3 py-2.5"><h2 className="text-sm font-black text-brand-ink">Filters</h2><button className="lg:hidden" onClick={()=>setDrawer(false)} aria-label="Close filters"><X size={18}/></button></div><div className="flex-1 overflow-y-auto px-3 pb-20">{facets.map(facet => { const facetOptions=options(facet.key), visible=expanded[facet.key]?facetOptions:facetOptions.slice(0,COLLAPSED_OPTION_COUNT); return <details key={facet.key} open className="border-b border-neutral-100 py-2.5"><summary className="cursor-pointer text-xs font-bold text-brand-ink">{facet.label}</summary><div className="mt-2 space-y-1.5">{visible.map(option=><label key={option.value} className={`flex cursor-pointer items-center gap-2 text-[11px] ${option.count?'text-neutral-700':'text-neutral-400'}`}><input type="checkbox" checked={selected(facet.key).includes(option.value)} onChange={()=>toggle(facet.key,option.value)} className="h-3.5 w-3.5 accent-brand-orange"/><span className="min-w-0 flex-1 truncate" title={option.label}>{option.label}</span><span className="text-[10px] text-neutral-400">{option.count}</span></label>)}</div>{facetOptions.length>COLLAPSED_OPTION_COUNT&&<button type="button" onClick={()=>setExpanded(current=>({...current,[facet.key]:!current[facet.key]}))} className="mt-2 text-[10px] font-bold text-brand-orange">{expanded[facet.key]?'Show less':`View all (${facetOptions.length})`}</button>}{facet.key==='price'&&<div className="mt-2 grid grid-cols-2 gap-1.5"><input aria-label="Minimum price" value={minPrice} onChange={e=>update('min_price',e.target.value?[e.target.value]:[])} type="number" placeholder="Min" className="min-w-0 rounded-md border p-1.5 text-[11px]"/><input aria-label="Maximum price" value={maxPrice} onChange={e=>update('max_price',e.target.value?[e.target.value]:[])} type="number" placeholder="Max" className="min-w-0 rounded-md border p-1.5 text-[11px]"/></div>}</details>})}</div><div className="absolute inset-x-0 bottom-0 grid grid-cols-2 gap-2 border-t bg-white p-2.5 lg:sticky"><button onClick={clear} className="rounded-lg border border-orange-200 py-2 text-[11px] font-bold text-brand-orange">Clear all filters</button><button onClick={()=>setDrawer(false)} className="rounded-lg bg-brand-deep py-2 text-[11px] font-bold text-white lg:hidden">Apply filters</button></div></div>;
  return <main className="mx-auto min-h-[60vh] max-w-7xl bg-white px-3 py-5 sm:px-4"><div className="grid items-start gap-6 lg:grid-cols-[260px_minmax(0,1fr)]"><aside className="sticky top-44 hidden max-h-[calc(100vh-12rem)] overflow-hidden rounded-xl border bg-white lg:block">{sidebar}</aside><section className="min-w-0"><div className="flex flex-wrap items-end justify-between gap-3 border-b pb-4"><div><h1 className="text-2xl font-black capitalize text-brand-ink">{title}</h1><p className="mt-1 text-xs text-neutral-500">{sorted.length} {sorted.length===1?'product':'products'}</p></div><div className="flex gap-2"><button onClick={()=>setDrawer(true)} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-bold lg:hidden"><SlidersHorizontal size={16}/> Filter{active.length?` (${active.length})`:''}</button><select aria-label="Sort products" value={params.get('sort')||'name'} onChange={e=>update('sort',[e.target.value])} className="rounded-lg border bg-white px-3 py-2 text-sm"><option value="name">Sort: Recommended</option><option value="price-asc">Price: Low to high</option><option value="price-desc">Price: High to low</option></select></div></div>{active.length>0&&<div className="flex flex-wrap gap-2 py-3">{active.map(chip=><button key={`${chip.key}-${chip.value}`} onClick={()=>toggle(chip.key,chip.value)} className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-3 py-1 text-xs font-bold text-brand-deep">{chip.label}<X size={12}/></button>)}<button onClick={clear} className="px-2 text-xs font-bold text-brand-orange">Clear all</button></div>}<div className="grid grid-cols-2 gap-3 py-5 sm:grid-cols-3 xl:grid-cols-4">{sorted.flatMap(product=>{const variants=(product.product_variants||[]).filter(v=>v.is_active!==false);return [<ProductCard key={product.id} p={product}/>,...variants.slice(1).map(v=><ProductVariantCard key={v.id} product={product} variant={v}/>)]})}</div>{!sorted.length&&<p className="rounded-xl bg-white p-8 text-center text-sm text-neutral-500">No products match these filters.</p>}</section></div>{drawer&&<div className="fixed inset-0 z-[80] lg:hidden"><button aria-label="Close filters" className="absolute inset-0 bg-black/40" onClick={()=>setDrawer(false)}/><aside className="absolute inset-y-0 left-0 w-[min(88vw,300px)] overflow-hidden">{sidebar}</aside></div>}</main>;
}
