export function mapsServiceMessage(cause: unknown, service: 'Places API (New)' | 'Geocoding API') {
  const error = cause as { message?: string; status?: string; code?: string } | null;
  // Error class names such as GoogleMapsLoadError are not network evidence.
  if (error?.code === 'missing-key') return 'Address lookup is not configured yet.';
  const text = `${error?.message || String(cause)} ${error?.status || error?.code || ''}`;
  if (/authentication|places-unavailable|referer|referrer|not activated|not enabled|billing|invalid.?key|REQUEST_DENIED|denied|not authorized/i.test(text)) return 'Address lookup is temporarily unavailable.';
  if (/network|fetch|could not load|connection|script-load|configuration-load/i.test(text)) return 'Address lookup could not connect. Check your connection and try again.';
  return service === 'Geocoding API' ? 'We could not find the address for this location.' : 'We could not look up that address. Please try again.';
}
