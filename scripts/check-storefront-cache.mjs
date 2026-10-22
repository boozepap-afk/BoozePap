import assert from 'node:assert/strict';

// Run against a running development or production server:
// node scripts/check-storefront-cache.mjs [https://www.boozepap.com]
const origin = process.argv[2] || 'http://127.0.0.1:3000';

for (const path of ['/', '/gin', '/admin', '/checkout']) {
  const response = await fetch(new URL(path, origin), {
    signal: AbortSignal.timeout(120_000),
  });
  await response.arrayBuffer();
  assert.equal(response.status, 200, `${path}: page must render`);
  for (const header of ['cdn-cache-control', 'cloudflare-cdn-cache-control']) {
    assert.equal(response.headers.get(header), 'no-store', `${path}: ${header}`);
  }
  assert.notEqual(response.headers.get('cf-cache-status')?.toUpperCase(), 'HIT',
    `${path}: Cloudflare must not serve cached storefront HTML`);
  console.log(`${path}: renders with shared CDN caching disabled`);
}
