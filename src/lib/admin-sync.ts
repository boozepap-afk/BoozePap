export const ADMIN_CHANGE_KEY = 'boozepap:admin-change';

/** Confirm admin table writes and notify other storefront tabs after persistence. */
export function createAdminSyncFetch(fetcher: typeof fetch, isAdmin: () => boolean, notify: () => void): typeof fetch {
  return async (input, options) => {
    const endpoint = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    const method = (options?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
    const tableWrite = isAdmin() && /^\/rest\/v1\/[^/]+$/.test(endpoint.pathname)
      && ['POST', 'PATCH', 'DELETE'].includes(method);
    if (!tableWrite) return fetcher(input, options);

    const headers = new Headers(input instanceof Request ? input.headers : undefined);
    new Headers(options?.headers).forEach((value, name) => headers.set(name, value));
    const preferences = (headers.get('Prefer') || '').split(',').map(value => value.trim())
      .filter(value => value && !value.startsWith('return='));
    headers.set('Prefer', [...preferences, 'return=representation'].join(','));
    const response = await fetcher(input, { ...options, headers });
    if (!response.ok) return response;
    let saved: unknown;
    try { saved = await response.clone().json(); } catch { saved = null; }
    if (!saved || (Array.isArray(saved) && !saved.length)) {
      return Response.json({
        code: 'ADMIN_WRITE_NOT_CONFIRMED',
        message: 'Supabase did not confirm any saved rows. Reload admin and check the record before retrying.',
        details: null, hint: null,
      }, { status: 409 });
    }
    // Browser notifications must not turn a confirmed database save into an error.
    try { notify(); } catch { /* Private browsing can disable localStorage. */ }
    return response;
  };
}
