/**
 * Upload verified local packshots to Supabase Storage and publish their public
 * URLs. This intentionally never downloads retailer images or hotlinks URLs.
 * Run only after the SQL migration has been applied and the live preflight has
 * been reviewed.
 */
import { createClient } from '@supabase/supabase-js';
import { readFile, readdir } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const manifest = JSON.parse(await readFile(join(root, 'catalog-assets/requested-products.json'), 'utf8'));
const imageDir = join(root, 'catalog-assets/images');
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const execute = process.argv.includes('--execute');
if (!url || !key) throw new Error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your shell. Never expose this key to the browser.');

const supabase = createClient(url, key, { auth: { persistSession: false } });
const { data: existingProducts, error: productError } = await supabase
  .from('products').select('id,slug,name,image_url,is_active,is_new_arrival').in('slug', manifest.products);
if (productError) throw productError;
console.table(existingProducts);
const foundSlugs = new Set(existingProducts.map((product) => product.slug));
const missingProducts = manifest.products.filter((slug) => !foundSlugs.has(slug));
if (missingProducts.length) throw new Error(`Migration preflight failed; missing products: ${missingProducts.join(', ')}`);

let files = [];
try { files = await readdir(imageDir); } catch { throw new Error(`Create ${imageDir} and add verified official packshots before running this script.`); }
const images = new Map(files.filter((file) => /\.(jpe?g|png|webp)$/i.test(file)).map((file) => [basename(file, extname(file)), file]));
const missingImages = manifest.products.filter((slug) => !images.has(slug));
if (missingImages.length) throw new Error(`Manual review required; no verified local image for: ${missingImages.join(', ')}`);
if (!execute) {
  console.log(`Dry run passed: ${images.size} verified local filenames found. Re-run with --execute to upload.`);
  process.exit(0);
}

for (const product of existingProducts) {
  const file = images.get(product.slug);
  const extension = extname(file).toLowerCase();
  const path = `catalog/${product.slug}${extension}`;
  const bytes = await readFile(join(imageDir, file));
  const contentType = extension === '.png' ? 'image/png' : extension === '.webp' ? 'image/webp' : 'image/jpeg';
  const { error: uploadError } = await supabase.storage.from('product-images').upload(path, bytes, { contentType, upsert: true });
  if (uploadError) throw uploadError;
  const publicUrl = supabase.storage.from('product-images').getPublicUrl(path).data.publicUrl;
  const response = await fetch(publicUrl, { method: 'HEAD' });
  if (!response.ok || !response.headers.get('content-type')?.startsWith('image/')) throw new Error(`Public image verification failed for ${product.slug}: ${response.status}`);
  const { error: updateError } = await supabase.from('products').update({ image_url: publicUrl, is_active: true, is_new_arrival: true }).eq('id', product.id);
  if (updateError) throw updateError;
  console.log(`Uploaded and verified ${product.slug}: ${publicUrl}`);
}
