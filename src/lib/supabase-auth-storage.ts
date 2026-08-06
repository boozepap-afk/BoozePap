const COOKIE_CHUNK_SIZE = 3000;

export type AuthCookie = { name: string; value: string };

export function decodeAuthCookie(value?: string) {
  if (!value) return null;
  try { return decodeURIComponent(value); } catch { return value; }
}

export function encodeAuthCookie(value: string) {
  return encodeURIComponent(value);
}

export function readChunkedAuthCookie(key: string, cookies: AuthCookie[]) {
  const unchunked = cookies.find(cookie => cookie.name === key);
  if (unchunked) return decodeAuthCookie(unchunked.value);
  const chunks = cookies
    .filter(cookie => cookie.name.startsWith(`${key}.`))
    .sort((a, b) => Number(a.name.slice(key.length + 1)) - Number(b.name.slice(key.length + 1)));
  return chunks.length ? decodeAuthCookie(chunks.map(cookie => cookie.value).join('')) : null;
}

export function chunkAuthCookie(key: string, value: string) {
  const encoded = encodeAuthCookie(value), chunks: AuthCookie[] = [];
  for (let offset = 0, index = 0; offset < encoded.length; offset += COOKIE_CHUNK_SIZE, index += 1) {
    chunks.push({ name: `${key}.${index}`, value: encoded.slice(offset, offset + COOKIE_CHUNK_SIZE) });
  }
  return chunks;
}

export function authCookieNames(key: string, cookies: AuthCookie[]) {
  return cookies.filter(cookie => cookie.name === key || cookie.name.startsWith(`${key}.`)).map(cookie => cookie.name);
}

export const authCookieOptions = {
  path: '/',
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  maxAge: 60 * 60 * 24 * 365,
};
