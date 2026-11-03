import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { once } from 'node:events';

// Run after `npm run build -- --webpack`, ideally without a Maps build variable.
// Use a dummy browser key only for this local endpoint test; never call Google.
assert.ok(existsSync('.next/BUILD_ID'), 'Build the production app first');
const reservation = createServer();
reservation.listen(0, '127.0.0.1');
await once(reservation, 'listening');
const port = reservation.address().port;
await new Promise(resolve => reservation.close(resolve));
const browserKey = 'runtime-only-browser-test-key';
const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', String(port)], {
  env: { ...process.env, NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: browserKey, NEXT_TELEMETRY_DISABLED: '1' },
  stdio: 'ignore',
});
try {
  let response;
  for (let attempt = 0; attempt < 100; attempt++) {
    assert.equal(child.exitCode, null, 'production server must stay running');
    try { response = await fetch(`http://127.0.0.1:${port}/api/maps/config`); break; } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(response, 'production configuration endpoint must start');
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { apiKey: browserKey }, 'runtime key is available independently of browser compilation');
  assert.match(response.headers.get('cache-control'), /no-store/);
  console.log('Production build: runtime-only public Maps key is returned correctly; server keys are excluded.');
} finally {
  if (child.exitCode === null) {
    child.kill('SIGTERM');
    await once(child, 'exit');
  }
}
