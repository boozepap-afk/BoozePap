export const YAYA_CENTRE = { latitude: -1.293053, longitude: 36.787758 } as const;
export const STORE_ORIGIN = YAYA_CENTRE;

export type DeliveryPricing = {
  storeLatitude: number;
  storeLongitude: number;
  baseFee: number;
  includedKm: number;
  pricePerKm: number;
  maximumKm: number;
  estimatedTime: string;
};

export function validCoordinates(latitude: number, longitude: number) {
  return Number.isFinite(latitude) && Number.isFinite(longitude) && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
}

const finite = (value: unknown) => {
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

/** Normalize the active row without requiring PostgREST to know optional columns. */
export function deliveryPricingFromRow(row: Record<string, unknown>): DeliveryPricing | null {
  // Older BoozePap projects stored only the active Default band's `fee` and
  // distance bounds. Keep that valid row usable with the production pricing
  // defaults instead of treating optional configuration keys as an outage.
  const storeLatitude = finite(row.origin_latitude ?? row.store_latitude) ?? YAYA_CENTRE.latitude;
  const storeLongitude = finite(row.origin_longitude ?? row.store_longitude) ?? YAYA_CENTRE.longitude;
  const baseFee = finite(row.base_fee ?? row.delivery_fee ?? row.fee);
  const includedKm = finite(row.included_km ?? row.included_distance_km) ?? 3;
  const pricePerKm = finite(row.price_per_km) ?? 40;
  const maximumKm = finite(row.maximum_distance_km ?? row.max_distance_km) ?? 50;
  if (storeLatitude == null || storeLongitude == null || !validCoordinates(storeLatitude, storeLongitude) || baseFee == null || baseFee < 0 || includedKm == null || includedKm < 0 || pricePerKm == null || pricePerKm < 0 || maximumKm == null || maximumKm <= 0) return null;
  const estimatedTime = String(row.estimated_time || `${finite(row.estimated_minutes_min) ?? 10}–${finite(row.estimated_minutes_max) ?? 50} minutes`);
  return { storeLatitude, storeLongitude, baseFee, includedKm, pricePerKm, maximumKm, estimatedTime };
}

export function haversineKm(latitude: number, longitude: number, origin: { latitude: number; longitude: number } = YAYA_CENTRE) {
  const radians = Math.PI / 180, latitudeDelta = (latitude - origin.latitude) * radians, longitudeDelta = (longitude - origin.longitude) * radians;
  const value = Math.sin(latitudeDelta / 2) ** 2 + Math.cos(origin.latitude * radians) * Math.cos(latitude * radians) * Math.sin(longitudeDelta / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

async function googleDrivingKm(latitude: number, longitude: number, pricing: DeliveryPricing, key = process.env.GOOGLE_ROUTES_API_KEY, fetcher: typeof fetch = fetch) {
  if (!key) return null;
  const response = await fetcher('https://routes.googleapis.com/directions/v2:computeRoutes', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': 'routes.distanceMeters' }, body: JSON.stringify({ origin: { location: { latLng: { latitude: pricing.storeLatitude, longitude: pricing.storeLongitude } } }, destination: { location: { latLng: { latitude, longitude } } }, travelMode: 'DRIVE' }), cache: 'no-store' });
  if (!response.ok) throw new Error(`Google Routes HTTP ${response.status}`);
  const payload = await response.json() as { routes?: Array<{ distanceMeters?: number }> }, metres = Number(payload.routes?.[0]?.distanceMeters);
  if (!Number.isFinite(metres) || metres < 0) throw new Error('Google Routes returned no valid distance.');
  return metres / 1000;
}

export async function calculateDeliveryQuote(latitude: number, longitude: number, subtotal: number, locationVerified: boolean, pricing: DeliveryPricing, options: { googleKey?: string; fetcher?: typeof fetch } = {}) {
  if (!validCoordinates(latitude, longitude) || !Number.isFinite(subtotal) || subtotal < 0) throw new Error('Invalid quote input.');
  let distanceKm: number;
  try { distanceKm = await googleDrivingKm(latitude, longitude, pricing, options.googleKey ?? process.env.GOOGLE_ROUTES_API_KEY, options.fetcher) ?? haversineKm(latitude, longitude, { latitude: pricing.storeLatitude, longitude: pricing.storeLongitude }); }
  catch (error) { console.error('[Checkout quote] Google Routes failed; using Haversine', error); distanceKm = haversineKm(latitude, longitude, { latitude: pricing.storeLatitude, longitude: pricing.storeLongitude }); }
  if (distanceKm > pricing.maximumKm) return null;
  const extraKm = Math.max(0, distanceKm - pricing.includedKm);
  const deliveryFee = Number((pricing.baseFee + extraKm * pricing.pricePerKm).toFixed(2));
  return { subtotal, distanceKm: Number(distanceKm.toFixed(2)), deliveryFee, total: Number((subtotal + deliveryFee).toFixed(2)), estimatedTime: pricing.estimatedTime, locationVerified };
}
