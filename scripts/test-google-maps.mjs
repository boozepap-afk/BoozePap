import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { mapsServiceMessage } from '../src/lib/google-maps-errors.ts';

function moduleWithMocks(path, modules, globals = {}) {
  const javascript = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', ...Object.keys(globals), javascript)(name => {
    assert.ok(name in modules, `Unexpected import: ${name}`);
    return modules[name];
  }, module, module.exports, ...Object.values(globals));
  return module.exports;
}
function loader({ compiledKey, runtimeKey = 'runtime-browser-key', configurationFails = false, transientFailure = false } = {}) {
  const configured = [], libraries = [];
  let configReads = 0, failures = transientFailure ? 1 : 0;
  const places = { AutocompleteSuggestion: { fetchAutocompleteSuggestions: async () => ({ suggestions: [] }) }, AutocompleteSessionToken: class {} };
  const window = { google: { maps: { places } } };
  const api = moduleWithMocks('src/lib/google-maps.ts', {
    '@googlemaps/js-api-loader': {
      setOptions: options => configured.push(options),
      importLibrary: async name => {
        libraries.push(name);
        assert.equal(name, 'places', 'maps/marker/geocoding failures must not block address search');
        if (failures-- > 0) throw new Error('The Google Maps JavaScript API could not load.');
        return places;
      },
    },
  }, {
    window, process: { env: { NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: compiledKey } },
    console: { error() {} },
    fetch: async (path, options) => {
      configReads++;
      assert.equal(path, '/api/maps/config');
      assert.equal(options.cache, 'no-store');
      if (configurationFails) throw new TypeError('Failed to fetch');
      return runtimeKey ? Response.json({ apiKey: runtimeKey }) : Response.json({ code: 'MAPS_NOT_CONFIGURED' }, { status: 503 });
    },
  });
  return { api, configured, libraries, reads: () => configReads };
}
const runtimeOnly = loader();
await Promise.all([runtimeOnly.api.loadGoogleMaps(), runtimeOnly.api.loadGoogleMaps()]);
assert.equal(runtimeOnly.configured[0].key, 'runtime-browser-key', 'Cloudflare runtime key works without a compiled browser key');
assert.equal(runtimeOnly.reads(), 1, 'concurrent callers share configuration loading');
assert.deepEqual(runtimeOnly.libraries, ['places']);
const updated = loader({ compiledKey: 'old-build-key', runtimeKey: 'current-runtime-key' });
await updated.api.loadGoogleMaps();
assert.equal(updated.configured[0].key, 'current-runtime-key', 'current runtime configuration wins over a stale build');
const fallback = loader({ compiledKey: 'build-key', configurationFails: true });
await fallback.api.loadGoogleMaps();
assert.equal(fallback.configured[0].key, 'build-key', 'an unavailable config endpoint can use the existing compiled browser key');
const retry = loader({ transientFailure: true });
await assert.rejects(() => retry.api.loadGoogleMaps(), error => error.code === 'script-load');
await retry.api.loadGoogleMaps();
assert.equal(retry.configured.length, 1, 'retry does not configure duplicate SDK loaders');
assert.deepEqual(retry.libraries, ['places', 'places']);
const absent = loader({ runtimeKey: null });
await assert.rejects(() => absent.api.loadGoogleMaps(), error => error.code === 'missing-key');
assert.equal(absent.libraries.length, 0, 'missing keys do not make Google API requests');
assert.equal(mapsServiceMessage({ name: 'GoogleMapsLoadError', code: 'missing-key', message: 'Missing key' }, 'Places API (New)'), 'Address lookup is not configured yet.');
assert.doesNotMatch(mapsServiceMessage({ name: 'GoogleMapsLoadError', code: 'missing-key' }, 'Places API (New)'), /network|security/i);

function configRoute(env, bindings = {}) {
  return moduleWithMocks('src/app/api/maps/config/route.ts', {
    'next/server': { NextResponse: { json: (body, options = {}) => ({ body, status: options.status || 200, headers: options.headers }) } },
    '@opennextjs/cloudflare': { getCloudflareContext: () => ({ env: bindings }) },
  }, { process: { env } }).GET();
}
assert.deepEqual(configRoute({ NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: 'browser-key' }).body, { apiKey: 'browser-key' });
assert.deepEqual(configRoute({}, { NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: 'cloudflare-browser-key' }).body, { apiKey: 'cloudflare-browser-key' });
const privateOnly = configRoute({ GOOGLE_ROUTES_API_KEY: 'private-routes-key', GOOGLE_MAPS_API_KEY: 'private-server-key' });
assert.equal(privateOnly.status, 503, 'server-only credentials are never exposed');
assert.deepEqual(privateOnly.body, { code: 'MAPS_NOT_CONFIGURED' });
assert.match(privateOnly.headers['Cache-Control'], /no-store/);
console.log('Runtime browser keys, compiled fallback, shared loading, retry, lazy Places loading, accurate errors and server-key isolation passed.');
