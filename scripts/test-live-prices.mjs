import assert from 'node:assert/strict';
import { effectivePrice, fetchCatalogPrices, refreshCartPrices } from '../src/lib/catalog-pricing.ts';

assert.deepEqual(effectivePrice({ price: 1500, old_price: 1000 }), { price: 1500, oldPrice: undefined, active: false }, 'a stale comparison price never replaces the current Supabase price');
assert.equal(effectivePrice({ price: 1500 }).price, 1500);
assert.equal(effectivePrice({ price: 1000, old_price: 1500 }).price, 1000, 'an active discount uses the Supabase sale price');
assert.equal(effectivePrice({ price: 1000, old_price: 1500, discount_starts_at: '2999-01-01T00:00:00Z' }).price, 1500, 'future discounts retain their original price');
assert.equal(effectivePrice({ price: 1000, old_price: 1500, discount_ends_at: '2000-01-01T00:00:00Z' }).price, 1500, 'expired discounts restore their original price');
assert.equal(effectivePrice({ price: 0, old_price: 1000 }).price, 0, 'zero sale prices are preserved');

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
  assert.match(url.searchParams.get('select'), /(?:^|,)stock(?:,|$)/, 'live product inventory accompanies prices');
  assert.match(url.searchParams.get('select'), /product_variants\([^)]*stock/);
  assert.doesNotMatch(url.searchParams.get('select'), /\*/, 'poll only the fields needed for live prices and inventory');
}
const cart = [{ productId: id, price: 600, quantity: 2 }, { productId: id, variantId, price: 720, quantity: 1 }, { productId: 'unavailable', price: 100, quantity: 1 }];
const updated = refreshCartPrices(cart, new Map([[id, product]]));
assert.deepEqual(updated.map(item => item.price), [750, 900, 100]);
assert.deepEqual(cart.map(item => item.price), [600, 720, 100], 'the original cart is not mutated');
assert.equal(updated[0].quantity, 2);
const raisedPrices = new Map([[id, { ...product, price: 1500, product_variants: [{ id: variantId, price: 1800, old_price: 1200 }] }]]);
assert.deepEqual(refreshCartPrices(cart, raisedPrices).map(item => item.price), [1500, 1800, 100], 'saved product and variant prices follow Supabase price increases');
assert.equal(refreshCartPrices(updated, new Map([[id, product]]))[0], updated[0], 'unchanged cart prices do not trigger another update');
await assert.rejects(() => fetchCatalogPrices('https://example.supabase.co', 'public-test-key', undefined, async () => new Response('', { status: 503 })), /HTTP 503/, 'failed reads do not masquerade as an empty catalog');
console.log('Live Supabase price reads, pagination, cache bypass, variants, and saved-cart repricing passed.');

const scopedRequests = [];
const scope = Array.from({ length: 205 }, (_, index) => `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`);
const scopedFetch = async (endpoint, options) => {
  scopedRequests.push(endpoint);
  assert.equal(options.cache, 'no-store');
  return Response.json(endpoint.searchParams.get('id').slice(4, -1).split(',').map(id => ({ id, price: 1234, stock: 6 })));
};
const scopedPrices = await fetchCatalogPrices('https://example.supabase.co', 'key', undefined, scopedFetch, [...scope, scope[0], 'invalid)']);
assert.equal(scopedRequests.length, 3, 'large scopes use batches of at most 100 IDs');
assert.equal(scopedPrices.length, 205, 'duplicates and malformed IDs are excluded');
assert.equal(scopedPrices.at(-1).stock, 6);
assert.equal(scopedPrices.at(-1).price, 1234);
assert.deepEqual(scopedPrices.map(row => row.id), scope, 'only watched/cart products are polled');
scopedRequests.length = 0;
assert.deepEqual(await fetchCatalogPrices('https://example.supabase.co', 'key', undefined, scopedFetch, []), []);
assert.equal(scopedRequests.length, 0, 'pages without products or a cart do no background catalogue reads');
console.log('Scoped live price/stock polling, batching and empty-page bypass passed.');
