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
