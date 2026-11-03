import assert from 'node:assert/strict';
import { readCatalog } from '../src/lib/catalog-reader.ts';

const calls = [];
const url = 'https://example.supabase.co';
const fetcher = async (endpoint, options) => {
  calls.push({ endpoint, options });
  const length = Number(endpoint.searchParams.get('offset')) ? 1 : Number(endpoint.searchParams.get('limit'));
  return Response.json(Array.from({ length }, (_, index) => ({ id: String(index), price: 1500, stock: 7 })));
};
assert.equal((await readCatalog(url, 'public-key', { categoryId: 'gin-id', limit: 9 }, undefined, fetcher)).length, 9);
assert.equal(calls.length, 1, 'recommendations never paginate an entire catalogue');
assert.equal(calls[0].endpoint.searchParams.get('category_id'), 'eq.gin-id', 'filter the product category, not an embedded relationship');
assert.equal(calls[0].options.cache, 'no-store', 'live price and stock data is not cached');
assert.doesNotMatch(calls[0].endpoint.searchParams.get('select'), /\*|description|tasting_notes|seo_title/, 'listing payload omits rich content');
assert.match(calls[0].endpoint.searchParams.get('select'), /stock/);
calls.length = 0;
assert.equal((await readCatalog(url, 'public-key', {}, undefined, fetcher)).length, 1001, 'large catalogues retain their final page');
assert.equal(calls.length, 2);
assert.equal(calls[1].endpoint.searchParams.get('offset'), '1000');
calls.length = 0;
await readCatalog(url, 'public-key', { ids: [] }, undefined, fetcher);
assert.equal(calls.length, 0, 'empty homepage selections never fall back to a catalogue scan');
await readCatalog(url, 'public-key', { ids: ['chosen-id'], limit: 1 }, undefined, fetcher);
assert.equal(calls[0].endpoint.searchParams.get('id'), 'in.(chosen-id)');
await assert.rejects(() => readCatalog(url, 'public-key', {}, undefined, async () => new Response('', { status: 503 })), /HTTP 503/);
await assert.rejects(() => readCatalog(url, 'public-key', {}, undefined, async () => Response.json({ error: 'invalid' })), /Invalid catalog/);
console.log('Bounded recommendations, category filtering, catalogue pagination, live stock, empty selections and failure handling passed.');

for (const code of ['42703', 'PGRST204']) {
  const compatibilityCalls = [];
  const rows = await readCatalog(url, 'public-key', { categoryId: 'gin-id', limit: 24 }, undefined, async (endpoint, options) => {
    compatibilityCalls.push(new URL(endpoint));
    assert.equal(options.cache, 'no-store');
    if (!endpoint.searchParams.get('select').startsWith('*')) return Response.json({ code, message: 'column products.grape_variety does not exist' }, { status: 400 });
    return Response.json([{ id: 'live-product', name: 'Live Gin', price: 2150, stock: 7,
      description: 'Rich content must not reach every listing. '.repeat(1000), metadata: { large: true },
      product_variants: [{ id: 'bottle', name: '750ml', price: 2150, stock: 3, is_active: true, sku: 'private-detail', option_values: { unused: 'detail' } }],
    }]);
  });
  assert.equal(compatibilityCalls.length, 2, 'one bounded compatibility retry');
  assert.equal(compatibilityCalls[1].searchParams.get('category_id'), 'eq.gin-id');
  assert.equal(compatibilityCalls[1].searchParams.get('limit'), '24');
  assert.equal(rows[0].price, 2150);
  assert.equal(rows[0].stock, 7);
  assert.equal(rows[0].product_variants[0].stock, 3);
  assert.equal(rows[0].product_variants[0].price, 2150);
  assert.equal(rows[0].description, undefined);
  assert.equal(rows[0].metadata, undefined);
  assert.equal(rows[0].product_variants[0].sku, undefined);
  assert.ok(JSON.stringify(rows).length < 500, 'compatibility reads still produce a compact listing payload');
}
let deniedReads = 0;
await assert.rejects(() => readCatalog(url, 'key', {}, undefined, async () => {
  deniedReads++;
  return Response.json({ code: '42501', message: 'permission denied' }, { status: 403 });
}), /HTTP 403.*42501/);
assert.equal(deniedReads, 1, 'permission failures must not trigger compatibility retries');
let failedCompatibilityReads = 0;
await assert.rejects(() => readCatalog(url, 'key', {}, undefined, async () => {
  failedCompatibilityReads++;
  return Response.json({ code: '42703', message: 'column not found' }, { status: 400 });
}), /compatibility read returned HTTP 400/);
assert.equal(failedCompatibilityReads, 2, 'compatibility errors never loop');
console.log('Older-schema compatibility, compact payloads, preserved prices/stock, and bounded error handling passed.');

let schemaReads = 0;
const paginatedCompatibility = await readCatalog(url, 'key', {}, undefined, async endpoint => {
  schemaReads++;
  if (!endpoint.searchParams.get('select').startsWith('*')) return Response.json({ code: '42703', message: 'optional field absent' }, { status: 400 });
  return Response.json(Array.from({ length: Number(endpoint.searchParams.get('offset')) ? 1 : 1000 }, (_, index) => ({ id: String(index), price: 2000, stock: 2, description: 'unneeded rich content' })));
});
assert.equal(paginatedCompatibility.length, 1001);
assert.equal(schemaReads, 3, 'remaining pages reuse the compatible projection instead of failing repeatedly');
assert.ok(paginatedCompatibility.every(product => product.description === undefined));
console.log('Compatible pagination retries schema discovery only once per catalogue read.');
