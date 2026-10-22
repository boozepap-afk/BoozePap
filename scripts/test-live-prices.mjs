import assert from 'node:assert/strict';
import { fetchCatalogPrices, refreshCartPrices } from '../src/lib/catalog-pricing.ts';

const id = '11111111-1111-4111-8111-111111111111';
const variantId = '22222222-2222-4222-8222-222222222222';
const product = { id, price: 750, old_price: 1000, product_variants: [{ id: variantId, price: 900, old_price: 1200 }] };
const requests = [];
const prices = await fetchCatalogPrices('https://example.supabase.co', 'public-test-key', undefined, async (url, options) => {
  requests.push({ url, options });
  return Response.json(Number(url.searchParams.get('offset')) === 0 ? Array.from({ length: 1000 }, () => product) : [{ ...product, id: 'last-product' }]);
});
assert.equal(prices.length, 1001, 'catalogs larger than Supabase response limits are paginated');
assert.equal(requests.length, 2);
assert.equal(requests[1].url.searchParams.get('offset'), '1000');
for (const { url, options } of requests) {
  assert.equal(url.origin, 'https://example.supabase.co', 'prices come directly from Supabase');
  assert.equal(url.pathname, '/rest/v1/products');
  assert.equal(options.cache, 'no-store', 'cached HTML/browser prices are bypassed');
  assert.equal(options.headers.apikey, 'public-test-key');
  assert.match(url.searchParams.get('select'), /product_variants/);
}
const cart = [{ productId: id, price: 600, quantity: 2 }, { productId: id, variantId, price: 720, quantity: 1 }, { productId: 'unavailable', price: 100, quantity: 1 }];
const updated = refreshCartPrices(cart, new Map([[id, product]]));
assert.deepEqual(updated.map(item => item.price), [750, 900, 100]);
assert.deepEqual(cart.map(item => item.price), [600, 720, 100], 'the original cart is not mutated');
assert.equal(updated[0].quantity, 2);
assert.equal(refreshCartPrices(updated, new Map([[id, product]]))[0], updated[0], 'unchanged cart prices do not trigger another update');
await assert.rejects(() => fetchCatalogPrices('https://example.supabase.co', 'public-test-key', undefined, async () => new Response('', { status: 503 })), /HTTP 503/, 'failed reads do not masquerade as an empty catalog');
console.log('Live Supabase price reads, pagination, cache bypass, variants, and saved-cart repricing passed.');
