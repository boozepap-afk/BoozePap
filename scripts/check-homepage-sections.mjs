import fs from 'node:fs';

const migration = fs.readFileSync('supabase/migrations/20260810120000_preload_default_homepage_rows.sql', 'utf8');
const homepage = fs.readFileSync('src/app/page.tsx', 'utf8');
const rail = fs.readFileSync('src/components/Site.tsx', 'utf8');

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

console.log('Homepage section preload, category selection, and links are configured.');
