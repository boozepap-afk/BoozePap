import assert from 'node:assert/strict';
import { createAdminSyncFetch } from '../src/lib/admin-sync.ts';
import { createClient } from '@supabase/supabase-js';

const base = 'https://example.supabase.co';
let notices = 0;
const requests = [];
const sync = createAdminSyncFetch(async (input, options) => {
  requests.push({ input, options });
  return Response.json([{ id: 'saved-row' }]);
}, () => true, () => { notices++; });

for (const table of ['products', 'product_variants', 'categories', 'homepage_banners', 'homepage_product_sections', 'store_settings', 'delivery_settings', 'orders']) {
  for (const method of ['POST', 'PATCH', 'DELETE']) {
    const response = await sync(`${base}/rest/v1/${table}?id=eq.test`, {
      method,
      headers: { Authorization: 'Bearer test-session', Prefer: 'resolution=merge-duplicates,return=minimal' },
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), [{ id: 'saved-row' }], 'the SDK can still read the response');
    const headers = requests.at(-1).options.headers;
    assert.equal(headers.get('Authorization'), 'Bearer test-session', 'session authentication is preserved');
    assert.equal(headers.get('Prefer'), 'resolution=merge-duplicates,return=representation', 'upsert semantics are preserved while requesting saved rows');
  }
}
assert.equal(notices, 24, 'confirmed admin writes notify storefront tabs');

for (const body of [[], null]) {
  const noRows = createAdminSyncFetch(async () => Response.json(body), () => true, () => assert.fail('unconfirmed saves must not notify'));
  const response = await noRows(`${base}/rest/v1/products`, { method: 'PATCH' });
  assert.equal(response.status, 409);
  assert.equal((await response.json()).code, 'ADMIN_WRITE_NOT_CONFIRMED');
}
const denied = createAdminSyncFetch(async () => Response.json({ message: 'denied' }, { status: 403 }), () => true, () => assert.fail('denied saves must not notify'));
assert.equal((await denied(`${base}/rest/v1/products`, { method: 'PATCH' })).status, 403);

for (const [isAdmin, path, method] of [
  [false, '/rest/v1/customers', 'POST'],
  [true, '/rest/v1/products', 'GET'],
  [true, '/auth/v1/token', 'POST'],
  [true, '/storage/v1/object/product-images/test', 'POST'],
  [true, '/rest/v1/rpc/adjust_reward_points', 'POST'],
]) {
  const options = { method };
  const passThrough = createAdminSyncFetch(async (_input, actual) => {
    assert.equal(actual, options, 'customer requests, reads, auth, storage and RPC keep their original behavior');
    return new Response(null, { status: 204 });
  }, () => isAdmin, () => assert.fail('unrelated requests must not notify'));
  assert.equal((await passThrough(`${base}${path}`, options)).status, 204);
}
const privateBrowser = createAdminSyncFetch(async () => Response.json([{ id: 'saved' }]), () => true, () => { throw new Error('storage disabled'); });
assert.equal((await privateBrowser(`${base}/rest/v1/products`, { method: 'PATCH' })).status, 200, 'notification errors do not invalidate persisted changes');

let sdkNotices = 0;
let sdkResponse = [{ id: 'product-id', price: 3999 }];
const client = createClient(base, 'test-public-key', {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: createAdminSyncFetch(async (_input, options) => {
    assert.equal(new Headers(options.headers).get('Prefer')?.includes('return=representation'), true);
    return Response.json(sdkResponse);
  }, () => true, () => { sdkNotices++; }) },
});
const updated = await client.from('products').update({ price: 3999 }).eq('id', 'product-id');
assert.equal(updated.error, null, 'existing SDK saves without select still succeed');
assert.equal(sdkNotices, 1);
const selected = await client.from('products').update({ price: 3999 }).eq('id', 'product-id').select('id,price').maybeSingle();
assert.equal(selected.data.price, 3999, 'SDK maybeSingle still returns its verified saved row');
sdkResponse = [];
const filtered = await client.from('products').update({ price: 3999 }).eq('id', 'missing');
assert.equal(filtered.error.code, 'ADMIN_WRITE_NOT_CONFIRMED', 'SDK exposes a filtered-out write as an error');
assert.equal(sdkNotices, 2);
console.log('Confirmed admin writes, notifications, RLS rejection, empty writes, auth preservation and request isolation passed.');
