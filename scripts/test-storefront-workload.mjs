import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempSync, openSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Real Next rendering against a large, deterministic PostgREST fixture. No live writes.
const categoryId = '11111111-1111-4111-8111-111111111111';
const otherId = '22222222-2222-4222-8222-222222222222';
const categories = [{ id: categoryId, name: 'Gin', slug: 'gin', image_url: '/placeholder-product.png' }, { id: otherId, name: 'Beer', slug: 'beer', image_url: '/placeholder-product.png' }];
const products = Array.from({ length: 1500 }, (_, index) => ({
  id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
  name: `Fixture drink ${index}`, slug: `fixture-drink-${index}`, category_id: index < 300 ? categoryId : otherId,
  categories: { name: index < 300 ? 'Gin' : 'Beer', slug: index < 300 ? 'gin' : 'beer' },
  brands: { name: `Brand ${index % 100}` }, price: 1000 + index, stock: 20, is_active: true,
  image_url: '/placeholder-product.png', description: 'Long product description. '.repeat(400),
  product_variants: index === 1 ? [{ id: '33333333-3333-4333-8333-333333333333', name: 'Large bottle', price: 2000, stock: 5, is_active: true }, { id: '44444444-4444-4444-8444-444444444444', name: 'Small bottle', price: 1500, stock: 4, is_active: true }] : [], updated_at: '2026-01-01T00:00:00Z',
}));
const requests = [];
const legacySchema = process.env.BOOZEPAP_TEST_LEGACY_SCHEMA === '1';
const isProductRead = url => url.pathname === '/rest/v1/products' && !(legacySchema && url.searchParams.get('select')?.includes('grape_variety'));
const database = createServer((request, response) => {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Headers', 'apikey, authorization, content-type');
  if (request.method === 'OPTIONS') { response.writeHead(204); response.end(); return; }
  const url = new URL(request.url, 'http://fixture');
  requests.push(url);
  let rows = [];
  if (url.pathname === '/rest/v1/products') {
    if (legacySchema && url.searchParams.get('select')?.includes('grape_variety')) {
      response.writeHead(400, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ code: '42703', message: 'column products.grape_variety does not exist' }));
      return;
    }
    rows = products;
    if (url.searchParams.has('category_id')) rows = rows.filter(product => product.category_id === url.searchParams.get('category_id').slice(3));
    if (url.searchParams.has('slug')) rows = rows.filter(product => product.slug === url.searchParams.get('slug').slice(3));
    if (url.searchParams.has('id')) {
      const ids = url.searchParams.get('id').slice(4, -1).split(',');
      rows = rows.filter(product => ids.includes(product.id));
    }
    const offset = Number(url.searchParams.get('offset') || 0), limit = Number(url.searchParams.get('limit') || 1000);
    rows = rows.slice(offset, offset + limit);
    const select = url.searchParams.get('select') || '*';
    if (!select.startsWith('*')) {
      const fields = select.split(/,(?![^()]*\))/).map(field => field.split('(')[0]);
      rows = rows.map(product => Object.fromEntries(Object.entries(product).filter(([key]) => fields.includes(key))));
    }
  } else if (url.pathname === '/rest/v1/categories') {
    rows = url.searchParams.has('slug') ? categories.filter(category => `eq.${category.slug}` === url.searchParams.get('slug')) : categories;
  } else if (url.pathname === '/rest/v1/homepage_product_sections') {
    rows = [{ id: 'section', heading: 'Selected drinks', category_id: categoryId, product_ids: products.slice(0, 8).map(product => product.id), use_best_sellers: false, item_limit: 8, is_active: true }];
  } else if (url.pathname === '/rest/v1/rpc/homepage_top_selling_product_ids') {
    rows = products.slice(0, 3).map(product => ({ product_id: product.id }));
  }
  response.writeHead(200, { 'content-type': 'application/json' });
  response.end(JSON.stringify(rows));
});
database.listen(0, '127.0.0.1');
await once(database, 'listening');
const portServer = createServer();
portServer.listen(0, '127.0.0.1');
await once(portServer, 'listening');
const port = portServer.address().port;
await new Promise(resolve => portServer.close(resolve));
const logPath = join(mkdtempSync(join(tmpdir(), 'boozepap-workload-')), 'next.log');
const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--webpack', '--hostname', '127.0.0.1', '--port', String(port)], {
  env: { ...process.env, NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${database.address().port}`, NEXT_PUBLIC_SUPABASE_ANON_KEY: 'fixture-public-key', NEXT_TELEMETRY_DISABLED: '1' },
  stdio: ['ignore', openSync(logPath, 'w'), 'ignore'],
});
try {
  let ready = false;
  for (let attempt = 0; attempt < 120; attempt++) {
    if (child.exitCode !== null) throw new Error(`Next exited ${child.exitCode}`);
    if (readFileSync(logPath, 'utf8').includes('Ready in')) { ready = true; break; }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  assert.ok(ready, 'Next must start');
  for (const path of ['/checkout', '/admin', '/', '/product/fixture-drink-0', '/gin', '/shop']) {
    requests.length = 0;
    const response = await fetch(`http://127.0.0.1:${port}${path}`, { signal: AbortSignal.timeout(120000) });
    const html = await response.text();
    assert.equal(response.status, 200, `${path} renders`);
    const reads = requests.filter(isProductRead);
    const cards = (html.match(/aria-label="Add Fixture drink /g) || []).length;
    if (path === '/checkout' || path === '/admin') assert.equal(reads.length, 0, `${path} must not load a catalogue`);
    if (path === '/') {
      assert.equal(reads.length, 1, 'homepage loads selected products once');
      assert.ok(reads.every(url => url.searchParams.has('id')), 'homepage never loads the whole catalogue');
      assert.equal(cards, 8, 'selected homepage products render');
    }
    if (path.startsWith('/product/')) {
      assert.equal(reads.length, 2, 'metadata/detail deduplicate; only one bounded recommendation query');
      const recommendations = reads.find(url => url.searchParams.has('category_id'));
      assert.equal(recommendations?.searchParams.get('limit'), '9');
      assert.equal(cards, 8);
    }
    if (path === '/gin') {
      assert.equal(reads.length, 1);
      assert.equal(reads[0].searchParams.get('category_id'), `eq.${categoryId}`);
      assert.equal(cards, 24, 'large category initially renders only 24 offerings');
      assert.ok(html.includes('Loading the full catalogue'), 'remaining products load directly in the browser');
      assert.equal(reads[0].searchParams.get('limit'), '24');
    }
    if (path === '/shop') {
      assert.equal(reads.length, 1, 'shop SSR only reads its first page');
      assert.equal(reads[0].searchParams.get('limit'), '24');
      assert.equal(cards, 24, 'shop render is bounded independently of catalogue size');
      assert.ok(!html.includes('fixture-drink-1499'), 'offscreen catalogue is not serialized into HTML');
    }
    console.log(`${path}: ${reads.length} successful product reads (${requests.filter(url => url.pathname === '/rest/v1/products').length} HTTP requests), ${cards} cards, ${Buffer.byteLength(html)} HTML bytes`);
  }
  assert.ok(!requests.some(url => url.pathname.startsWith('/auth/')), 'anonymous requests need no auth calls');
  // Exercise hydration and interactions in real Chromium through its native CDP.
  const profile = mkdtempSync(join(tmpdir(), 'boozepap-chromium-'));
  const chrome = spawn(process.env.CHROMIUM_PATH || '/usr/bin/chromium', ['--headless', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
  let socket;
  try {
    const waitFor = async (check, label) => {
      for (let attempt = 0; attempt < 160; attempt++) {
        try { if (await check()) return; } catch {}
        if (chrome.exitCode !== null) throw new Error(`Chromium exited ${chrome.exitCode}`);
        await new Promise(resolve => setTimeout(resolve, 250));
      }
      throw new Error(`Timed out: ${label}`);
    };
    const portFile = join(profile, 'DevToolsActivePort');
    await waitFor(() => existsSync(portFile), 'Chromium startup');
    const chromePort = readFileSync(portFile, 'utf8').split('\n')[0];
    const targets = await (await fetch(`http://127.0.0.1:${chromePort}/json/list`)).json();
    socket = new WebSocket(targets.find(target => target.type === 'page').webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
    const pending = new Map();
    const browserErrors = [];
    let sequence = 0;
    socket.addEventListener('message', event => {
      const message = JSON.parse(event.data);
      if (message.method === 'Runtime.exceptionThrown') browserErrors.push(message.params.exceptionDetails.text);
      if (message.id) { const handler = pending.get(message.id); pending.delete(message.id); if (message.error) handler.reject(new Error(message.error.message)); else handler.resolve(message.result); }
    });
    const cdp = (method, params = {}) => new Promise((resolve, reject) => { const id = ++sequence; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })); });
    const evaluate = async expression => {
      const result = await cdp('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
      return result.result.value;
    };
    await cdp('Runtime.enable');
    await cdp('Page.navigate', { url: `http://127.0.0.1:${port}/gin` });
    await waitFor(() => evaluate(`document.querySelectorAll('button[aria-label^="Add Fixture drink"]').length === 24`), '24 hydrated cards');
    await waitFor(() => evaluate(`document.querySelector('main')?.textContent.includes('300 products')`), 'all category products load in browser');
    await waitFor(() => requests.some(url => url.searchParams.get('select')?.startsWith('id,price,old_price') && url.searchParams.has('id')), 'scoped live polling after hydration');
    const priceReads = requests.filter(url => url.searchParams.get('select')?.startsWith('id,price,old_price'));
    assert.ok(priceReads.every(url => url.searchParams.has('id')), 'browser never polls unrelated catalogue prices');
    await evaluate(`Array.from(document.querySelectorAll('button')).find(button => button.textContent.startsWith('Show more products')).click()`);
    await waitFor(() => evaluate(`document.querySelectorAll('button[aria-label^="Add Fixture drink"]').length === 48`), 'load more preserves products');
    assert.ok(await evaluate(`Boolean(document.querySelector('a[href*="variant="]'))`), 'additional bottle sizes remain accessible');
    const serverReadsBefore = requests.filter(url => !url.searchParams.get('select')?.startsWith('id,price,old_price')).length;
    await evaluate(`(() => { const select = document.querySelector('[aria-label="Sort products"]'); select.value = 'price-desc'; select.dispatchEvent(new Event('change', { bubbles: true })); })()`);
    await waitFor(() => evaluate(`location.search.includes('price-desc') && document.querySelectorAll('button[aria-label^="Add Fixture drink"]').length === 24`), 'local sorting resets pagination');
    await new Promise(resolve => setTimeout(resolve, 500));
    assert.equal(requests.filter(url => !url.searchParams.get('select')?.startsWith('id,price,old_price')).length, serverReadsBefore, 'sorting does not request another server render');
    await evaluate(`document.querySelector('aside input[type="checkbox"]').click()`);
    await waitFor(() => evaluate(`location.search.includes('brand=') && document.querySelectorAll('button[aria-label^="Add Fixture drink"]').length === 3`), 'facet filter uses the complete browser dataset');
    await evaluate(`window.history.replaceState(null, '', '/gin?sort=price-desc')`);
    await waitFor(() => evaluate(`document.querySelectorAll('button[aria-label^="Add Fixture drink"]').length === 24`), 'clearing filter restores products');
    // A live price and stock update must reach the visible cards and saved cart.
    products[0].price = 9999;
    products[0].stock = 0;
    await evaluate(`localStorage.setItem('boozepap-cart-version', '2'); localStorage.setItem('boozepap-cart-v2', JSON.stringify([{productId: '${products[0].id}', price: 1000, quantity: 1}])); window.dispatchEvent(new Event('focus'))`);
    await waitFor(() => evaluate(`document.querySelector('button[aria-label="Add Fixture drink 0 to cart"]')?.disabled && JSON.parse(localStorage.getItem('boozepap-cart-v2'))[0].price === 9999`), 'live stock and cart repricing');
    assert.deepEqual(browserErrors, [], 'browser hydration must not throw');
    console.log('Chromium: hydration, 24→48 cards, local sorting without SSR, scoped polling, live stock and cart repricing passed.');
  } finally {
    socket?.close();
    chrome.kill('SIGTERM');
    await once(chrome, 'exit');
  }
  // Growing the catalogue must not increase the server-rendered Shop workload.
  const seed = products.at(-1);
  products.push(...Array.from({ length: 8500 }, (_, index) => ({ ...seed, id: `00000000-0000-4000-8000-${String(index + 1501).padStart(12, '0')}`, slug: `fixture-drink-${index + 1500}`, name: `Fixture drink ${index + 1500}` })));
  requests.length = 0;
  const largeShop = await fetch(`http://127.0.0.1:${port}/shop`);
  const largeHtml = await largeShop.text();
  assert.equal(largeShop.status, 200);
  assert.equal((largeHtml.match(/aria-label="Add Fixture drink /g) || []).length, 24);
  assert.ok(Buffer.byteLength(largeHtml) < 130000, '10,000 products must not inflate the initial Shop payload');
  assert.equal(requests.filter(isProductRead).length, 1);
  requests.length = 0;
  const concurrent = await Promise.all(Array.from({ length: 8 }, () => fetch(`http://127.0.0.1:${port}/`).then(async response => ({ status: response.status, html: await response.text() }))));
  assert.ok(concurrent.every(result => result.status === 200 && Buffer.byteLength(result.html) < 100000));
  assert.equal(requests.filter(isProductRead).length, 8, 'eight concurrent visits need only eight selected-product reads');
  assert.ok(requests.filter(isProductRead).every(url => url.searchParams.has('id')));
  console.log(`10,000-product Shop: ${Buffer.byteLength(largeHtml)} HTML bytes, 24 cards; eight concurrent homepage visits passed with one selected-product query each.`);
  console.log(`Large-catalogue request scoping, pagination and bounded server rendering passed (${legacySchema ? 'legacy schema with missing optional columns' : 'current schema'}).`);
} catch (error) {
  console.error(readFileSync(logPath, 'utf8').slice(-8000));
  throw error;
} finally {
  child.kill('SIGTERM');
  await once(child, 'exit');
  await new Promise(resolve => database.close(resolve));
}
