import fs from 'node:fs';

const admin = fs.readFileSync('src/app/admin/page.tsx', 'utf8');
const required = [
  ["select('id,name,price').order('name')", 'core product fallback'],
  ["select('id,product_id,name,price').order('name')", 'core product-size fallback'],
  ['<optgroup label="Products">', 'product choices'],
  ['<optgroup label="Product sizes">', 'product-size choices'],
  ['setNormal(String(item.old_price??item.price))', 'automatic original price'],
  ['label="Original price (KES)" value={normal} readOnly', 'read-only original price field'],
  [".update({old_price:original,price:discounted", 'discount save payload'],
  ['.select().single()', 'confirmed Supabase save'],
];
for (const [pattern, behavior] of required) {
  if (!admin.includes(pattern)) throw new Error(`Missing discount behavior: ${behavior}`);
}
console.log('Discount product choices and original-price behavior are configured.');
