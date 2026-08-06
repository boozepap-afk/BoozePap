'use client';

const MAX_BYTES = 15 * 1024 * 1024;
const RASTER_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif']);
const HEIC_TYPES = new Set(['image/heic', 'image/heif']);

type ProcessedImage = { full: File; thumbnail: File; previewUrl: string };

function isSvg(bytes: Uint8Array) { return /<svg[\s>]/i.test(new TextDecoder().decode(bytes)); }
function detectedType(bytes: Uint8Array) {
  const text = new TextDecoder().decode(bytes.slice(0, 32));
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (String.fromCharCode(...bytes.slice(0, 8)) === '\x89PNG\r\n\x1a\n') return 'image/png';
  if (text.startsWith('GIF87a') || text.startsWith('GIF89a')) return 'image/gif';
  if (text.startsWith('RIFF') && text.slice(8, 12) === 'WEBP') return 'image/webp';
  if (text.slice(4, 8) === 'ftyp' && /avif|avis/.test(text.slice(8, 16))) return 'image/avif';
  if (text.slice(4, 8) === 'ftyp' && /heic|heif|heix|hevc|mif1/.test(text.slice(8, 20))) return 'image/heic';
  return isSvg(bytes) ? 'image/svg+xml' : '';
}

async function sanitizeSvg(file: File) {
  const document = new DOMParser().parseFromString(await file.text(), 'image/svg+xml');
  if (document.querySelector('parsererror') || document.documentElement.localName !== 'svg') throw new Error('The SVG is corrupt or is not an SVG image.');
  document.querySelectorAll('script, foreignObject, iframe, object, embed, image, use').forEach((node) => node.remove());
  document.querySelectorAll('*').forEach((node) => [...node.attributes].forEach((attribute) => {
    const name = attribute.name.toLowerCase(); const value = attribute.value.trim().toLowerCase();
    if (name.startsWith('on') || name === 'style' || name.endsWith('href') || value.includes('url(') || value.startsWith('data:') || value.startsWith('http:') || value.startsWith('https:')) node.removeAttribute(attribute.name);
  }));
  return new Blob([new XMLSerializer().serializeToString(document)], { type: 'image/svg+xml' });
}

async function canvasBlob(source: ImageBitmap, maxEdge: number, quality: number) {
  const scale = Math.min(1, maxEdge / Math.max(source.width, source.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(source.width * scale)); canvas.height = Math.max(1, Math.round(source.height * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Your browser could not prepare this image.');
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', quality));
  if (!blob) throw new Error('The image could not be compressed.');
  return blob;
}

export async function processAdminImage(file: File): Promise<ProcessedImage> {
  if (file.size > MAX_BYTES) throw new Error('Choose an image smaller than 15 MB.');
  const bytes = new Uint8Array(await file.slice(0, 32).arrayBuffer());
  const actualType = detectedType(bytes);
  if (!actualType || (!RASTER_TYPES.has(actualType) && !HEIC_TYPES.has(actualType) && actualType !== 'image/svg+xml')) throw new Error('Choose a real JPG, PNG, WebP, AVIF, GIF, HEIC, HEIF, or sanitized SVG image.');
  let source: Blob = file;
  if (actualType === 'image/svg+xml') source = await sanitizeSvg(file);
  if (HEIC_TYPES.has(actualType)) {
    const { default: heic2any } = await import('heic2any');
    const converted = await heic2any({ blob: file, toType: 'image/webp', quality: 0.9 });
    source = Array.isArray(converted) ? converted[0] : converted;
  }
  let bitmap: ImageBitmap;
  try { bitmap = await createImageBitmap(source, { imageOrientation: 'from-image' }); } catch { throw new Error('This image is corrupt or cannot be decoded by this browser.'); }
  try {
    const fullBlob = await canvasBlob(bitmap, 2000, 0.88);
    const thumbnailBlob = await canvasBlob(bitmap, 480, 0.8);
    const safeName = file.name.replace(/\.[^.]+$/, '').replace(/[^a-z0-9-]+/gi, '-').toLowerCase() || 'image';
    const full = new File([fullBlob], `${safeName}.webp`, { type: 'image/webp' });
    const thumbnail = new File([thumbnailBlob], `${safeName}-thumb.webp`, { type: 'image/webp' });
    return { full, thumbnail, previewUrl: URL.createObjectURL(fullBlob) };
  } finally { bitmap.close(); }
}
