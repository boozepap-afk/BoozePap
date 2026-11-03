import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';

export const dynamic = 'force-dynamic';

export function GET() {
  // Deliberately use runtime lookup: NEXT_PUBLIC values referenced directly
  // in browser code are frozen at build time. Expose only the browser key.
  const runtime = process.env;
  let apiKey = runtime.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim();
  if (!apiKey) {
    try {
      const bindings = getCloudflareContext().env as unknown as Record<string, unknown>;
      const value = bindings.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
      if (typeof value === 'string') apiKey = value.trim();
    } catch {
      // Local Next.js has no Cloudflare bindings; process.env is its source.
    }
  }
  const headers = { 'Cache-Control': 'private, no-store', 'CDN-Cache-Control': 'no-store' };
  if (!apiKey) return NextResponse.json({ code: 'MAPS_NOT_CONFIGURED' }, { status: 503, headers });
  // Never fall back to GOOGLE_ROUTES_API_KEY or another server credential.
  return NextResponse.json({ apiKey }, { headers });
}
