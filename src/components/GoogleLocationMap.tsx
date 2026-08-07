'use client';

import { useEffect, useRef } from 'react';
import type { DeliveryLocation } from './LocationPicker';
import { loadGoogleMaps } from '@/lib/google-maps';

export function GoogleLocationMap({ location }: { location: DeliveryLocation }) {
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => { let marker: google.maps.marker.AdvancedMarkerElement | undefined; void loadGoogleMaps().then(async () => { const [maps, markers] = await Promise.all([google.maps.importLibrary('maps'), google.maps.importLibrary('marker')]); if (!container.current) return; const center = { lat: location.latitude, lng: location.longitude }; const map = new maps.Map(container.current, { center, zoom: 16, mapId: 'BOOZEPAP_DELIVERY_CONFIRMATION', disableDefaultUI: true, zoomControl: true }); marker = new markers.AdvancedMarkerElement({ map, position: center, title: location.placeName || 'Confirmed delivery location', gmpDraggable: false }); }).catch((error) => console.error('[Google Maps] Confirmed-location map could not be rendered.', error)); return () => { if (marker) marker.map = null; }; }, [location.latitude, location.longitude, location.placeName]);
  return <><div ref={container} className="mt-3 h-64 w-full overflow-hidden rounded-xl border border-orange-100" aria-label="Confirmed Google Maps delivery location"/><a className="mt-2 inline-block text-sm font-bold text-brand-orange" target="_blank" rel="noreferrer" href={`https://www.google.com/maps/search/?api=1&query=${location.latitude},${location.longitude}`}>Open confirmed location in Google Maps</a></>;
}
