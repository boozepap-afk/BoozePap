export const STORE_ORIGIN = { latitude: -1.293053, longitude: 36.787758 } as const;

export type DeliveryBand = { id?: string; name?: string; min_distance_km: number; max_distance_km?: number | null; fee: number; estimated_minutes_min?: number; estimated_minutes_max?: number };

export function validCoordinates(latitude: number, longitude: number) {
  return Number.isFinite(latitude) && Number.isFinite(longitude) && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
}

export function haversineKm(latitude: number, longitude: number) {
  const radians = Math.PI / 180;
  const latitudeDelta = (latitude - STORE_ORIGIN.latitude) * radians;
  const longitudeDelta = (longitude - STORE_ORIGIN.longitude) * radians;
  const value = Math.sin(latitudeDelta / 2) ** 2 + Math.cos(STORE_ORIGIN.latitude * radians) * Math.cos(latitude * radians) * Math.sin(longitudeDelta / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

async function googleDrivingKm(latitude: number, longitude: number) {
  const key = process.env.GOOGLE_ROUTES_API_KEY;
  if (!key) return null;
  const response = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': 'routes.distanceMeters' },
    body: JSON.stringify({ origin: { location: { latLng: { latitude: STORE_ORIGIN.latitude, longitude: STORE_ORIGIN.longitude } } }, destination: { location: { latLng: { latitude, longitude } } }, travelMode: 'DRIVE', routingPreference: 'TRAFFIC_AWARE' }),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`Google Routes returned HTTP ${response.status}: ${(await response.text()).slice(0, 500)}`);
  const payload = await response.json() as { routes?: Array<{ distanceMeters?: number }> };
  const metres = Number(payload.routes?.[0]?.distanceMeters);
  if (!Number.isFinite(metres) || metres < 0) throw new Error('Google Routes did not return a valid distance.');
  return metres / 1000;
}

export async function deliveryDistanceKm(latitude: number, longitude: number) {
  if (!validCoordinates(latitude, longitude)) throw new Error('Invalid delivery coordinates.');
  try {
    const distance = await googleDrivingKm(latitude, longitude);
    if (distance != null) return { distanceKm: distance, source: 'google_routes' as const };
  } catch (error) {
    console.error('[Checkout delivery] Google Routes failed; using Haversine fallback', error);
  }
  return { distanceKm: haversineKm(latitude, longitude), source: 'haversine' as const };
}

export function bandForDistance(distanceKm: number, bands: DeliveryBand[]) {
  return bands.find(band => distanceKm >= Number(band.min_distance_km) && (band.max_distance_km == null || distanceKm <= Number(band.max_distance_km))) || null;
}
