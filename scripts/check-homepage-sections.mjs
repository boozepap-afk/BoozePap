import fs from 'node:fs';

const migration = fs.readFileSync('supabase/migrations/20260810120000_preload_default_homepage_rows.sql', 'utf8');
const homepage = fs.readFileSync('src/app/page.tsx', 'utf8');
const rail = fs.readFileSync('src/components/Site.tsx', 'utf8');
const admin = fs.readFileSync('src/app/admin/page.tsx', 'utf8');

const expected = [
  ["'Top Selling'", "'/collections/top-sellers'"],
  ["'Wines'", "'/wine'"],
  ["'Gins'", "'/gin'"],
  ["'Beers'", "'/beer'"],
];

for (const [heading, destination] of expected) {
  if (!migration.includes(heading) || !migration.includes(destination)) throw new Error(`Missing ${heading} homepage row or destination`);
}
if (!migration.includes('delete from public.homepage_product_sections')) throw new Error('Restore must prevent duplicate homepage rows');
if (!homepage.includes('configuredSections.map')) throw new Error('Homepage must render configured Supabase sections');
if (!homepage.includes('product.category_id === section.category_id')) throw new Error('Category rows must select products by the saved category ID');
if (!rail.includes('<Link href={href}') || !rail.includes('>View all</Link>')) throw new Error('Section heading and View all must be links');
if (admin.indexOf('new FormData(event.currentTarget)') > admin.indexOf('await requireSession()', admin.indexOf('async function save(event: FormEvent<HTMLFormElement>)'))) throw new Error('FormData must be captured before awaiting the admin session');
if (!admin.includes('category_id: categoryId || null')) throw new Error('An empty category must be normalized to null before saving');
if (!admin.includes('selectedProductIds.some(id => !uuidPattern.test(id))')) throw new Error('Selected product IDs must be validated as UUIDs');
if (!admin.includes("item_limit: Number(form.get('item_limit')) || 8")) throw new Error('The product limit must be normalized to a number');
if (!admin.includes("console.error(`Failed to ${editing ? 'update' : 'create'} homepage section:`")) throw new Error('Supabase save errors must be logged with their complete details');

console.log('Homepage section preload, category selection, and links are configured.');
