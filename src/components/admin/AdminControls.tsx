'use client';

import { useRef, useState, type DragEvent } from 'react';
import { Bold, Heading2, ImagePlus, Italic, Link, List, Loader2, UploadCloud } from 'lucide-react';
import sanitizeHtml from 'sanitize-html';

export type DashboardMetric = { label: string; value: string | number; detail: string; tone?: 'orange' | 'red' | 'green' | 'blue' };

export function DashboardCards({ metrics }: { metrics: DashboardMetric[] }) {
  const tones = { orange: 'bg-orange-50 text-brand-deep', red: 'bg-red-50 text-red-700', green: 'bg-green-50 text-green-700', blue: 'bg-blue-50 text-blue-700' };
  return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{metrics.map((metric) => <article key={metric.label} className="rounded-2xl border border-orange-100 bg-white p-5 shadow-card"><p className="text-xs font-black uppercase tracking-widest text-neutral-500">{metric.label}</p><p className="mt-2 text-4xl font-black text-brand-ink">{metric.value}</p><p className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-bold ${tones[metric.tone || 'orange']}`}>{metric.detail}</p></article>)}</div>;
}

export function RichTextEditor({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const editor = useRef<HTMLDivElement>(null);
  function command(name: string, argument?: string) { editor.current?.focus(); document.execCommand(name, false, argument); onChange(editor.current?.innerHTML || ''); }
  const safeValue = sanitizeHtml(value, { allowedTags: ['p', 'br', 'strong', 'b', 'em', 'i', 'h2', 'h3', 'ul', 'ol', 'li', 'a'], allowedAttributes: { a: ['href', 'target', 'rel'] } });
  return <div className="mt-1 overflow-hidden rounded-xl border bg-white font-normal"><div className="flex flex-wrap gap-1 border-b bg-neutral-50 p-2">{[
    { icon: Bold, label: 'Bold', run: () => command('bold') }, { icon: Italic, label: 'Italic', run: () => command('italic') },
    { icon: Heading2, label: 'Heading', run: () => command('formatBlock', 'h2') }, { icon: List, label: 'List', run: () => command('insertUnorderedList') },
    { icon: Link, label: 'Link', run: () => { const url = window.prompt('Link URL'); if (url) command('createLink', url); } },
  ].map(({ icon: Icon, label, run }) => <button key={label} type="button" title={label} onClick={run} className="rounded-lg p-2 hover:bg-orange-100"><Icon size={17} /></button>)}</div><div ref={editor} contentEditable suppressContentEditableWarning onBlur={(event) => onChange(event.currentTarget.innerHTML)} dangerouslySetInnerHTML={{ __html: safeValue }} className="min-h-32 p-3 outline-none prose prose-sm max-w-none" /></div>;
}

export function ImageDropzone({ busy, onFiles }: { busy: boolean; onFiles: (files: File[]) => void }) {
  const [dragging, setDragging] = useState(false);
  function accept(files: FileList | null) { if (files) onFiles(Array.from(files).filter((file) => file.type.startsWith('image/'))); }
  function drop(event: DragEvent<HTMLLabelElement>) { event.preventDefault(); setDragging(false); accept(event.dataTransfer.files); }
  return <label onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={drop} className={`flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-4 text-center transition ${dragging ? 'border-brand-orange bg-orange-50' : 'border-orange-200 bg-brand-soft/50'}`}><input type="file" multiple accept="image/jpeg,image/png,image/webp,image/avif,image/gif,image/heic,image/heif,image/svg+xml,.jpg,.jpeg,.png,.webp,.avif,.gif,.heic,.heif,.svg" disabled={busy} onChange={(event) => accept(event.target.files)} className="sr-only" />{busy ? <Loader2 className="animate-spin text-brand-orange" /> : <UploadCloud className="text-brand-orange" />}<span className="mt-2 text-sm font-bold">Drop multiple images or click to browse</span><span className="text-xs text-neutral-500">JPG, PNG, WebP, AVIF, GIF, HEIC/HEIF or sanitized SVG · max 15 MB each</span></label>;
}

export function GalleryPreview({ urls, onRemove }: { urls: string[]; onRemove: (url: string) => void }) {
  if (!urls.length) return null;
  return <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">{urls.map((url) => <div key={url} className="group relative"><img src={url} alt="Product gallery" className="h-20 w-full rounded-lg bg-white object-contain" /><button type="button" onClick={() => onRemove(url)} className="absolute right-1 top-1 rounded-full bg-red-600 px-2 py-0.5 text-xs font-black text-white opacity-90">×</button></div>)}</div>;
}

export function EmptyState({ title, detail }: { title: string; detail: string }) {
  return <div className="rounded-2xl border border-dashed border-orange-200 p-10 text-center"><ImagePlus className="mx-auto text-brand-orange" /><h3 className="mt-3 font-black">{title}</h3><p className="mt-1 text-sm text-neutral-500">{detail}</p></div>;
}
