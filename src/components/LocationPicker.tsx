'use client';

import { CheckCircle2, LocateFixed, MapPin, Search } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { loadGoogleMaps } from '@/lib/google-maps';

export type DeliveryLocation = { latitude: number; longitude: number; placeId?: string; placeName?: string; verified: boolean };
export type MapsLoadState = 'loading' | 'ready' | 'error' | 'autocomplete-error';
type Props = { address: string; onAddress: (value: string) => void; value: DeliveryLocation | null; onChange: (value: DeliveryLocation | null) => void; onLoadState?: (state: MapsLoadState) => void };
type SearchState = 'idle' | 'loading' | 'results' | 'empty' | 'error';

function mapsErrorDetails(cause: unknown) {
  const value = cause as { name?: string; message?: string; status?: string; code?: string; stack?: string } | null;
  return { error: cause, name: value?.name || 'UnknownError', message: value?.message || String(cause), status: value?.status || value?.code, stack: value?.stack };
}

function mapsServiceMessage(cause: unknown, service: 'Places API (New)' | 'Geocoding API') {
  const details = mapsErrorDetails(cause), text = `${details.name} ${details.message} ${details.status || ''}`;
  if (/RefererNotAllowedMapError|referer|referrer/i.test(text)) return 'This website is not allowed by the Google API key referrer restrictions.';
  if (/ApiNotActivatedMapError|not activated|not enabled/i.test(text)) return `${service} is not enabled for this Google Cloud project.`;
  if (/BillingNotEnabledMapError|billing/i.test(text)) return 'Google Maps billing is not enabled for this project.';
  if (/InvalidKeyMapError|invalid.?key/i.test(text)) return 'The configured Google Maps API key is invalid.';
  if (/REQUEST_DENIED|denied|not authorized/i.test(text)) return `Google denied the ${service} request. Check API enablement and key restrictions.`;
  if (/network|fetch|load|failed/i.test(text)) return `The ${service} request failed because of a network or content-security-policy problem.`;
  return details.message || `${service} request failed.`;
}

export function LocationPicker({ address, onAddress, value, onChange, onLoadState }: Props) {
  const input = useRef<HTMLInputElement>(null), mapHost = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null), marker = useRef<google.maps.Marker | null>(null);
  const sessionToken = useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const placesApi = useRef<Pick<google.maps.PlacesLibrary, 'AutocompleteSuggestion' | 'AutocompleteSessionToken'> | null>(null);
  const requestId = useRef(0);
  const callbacks = useRef({ onAddress, onChange });
  const [loadState, setLoadState] = useState<MapsLoadState>('loading'), [error, setError] = useState(''), [locating, setLocating] = useState(false);
  const [autocompleteReady, setAutocompleteReady] = useState(false), [searchState, setSearchState] = useState<SearchState>('idle');
  const [suggestions, setSuggestions] = useState<google.maps.places.PlacePrediction[]>([]), [searchOpen, setSearchOpen] = useState(false), [activeSuggestion, setActiveSuggestion] = useState(-1);
  const [autocompleteError, setAutocompleteError] = useState('');
  const [reverseGeocodingError, setReverseGeocodingError] = useState('');
  const [retryNonce, setRetryNonce] = useState(0);
  const ready = loadState === 'ready';

  useEffect(() => { callbacks.current = { onAddress, onChange }; }, [onAddress, onChange]);

  const reverseGeocode = useCallback(async (position: google.maps.LatLngLiteral) => {
    let geocodingLoaded = false;
    try {
      const { Geocoder } = await google.maps.importLibrary('geocoding');
      geocodingLoaded = true;
      const response = await new Geocoder().geocode({ location: { lat: position.lat, lng: position.lng } });
      const result = response.results?.[0];
      if (!result?.formatted_address) {
        console.error('[Google Maps Geocoding] Reverse geocoding returned no formatted address.', { latitude: position.lat, longitude: position.lng, geocodingLoaded, response });
        return null;
      }
      return result;
    } catch (cause) {
      console.error('[Google Maps Geocoding] geocoder.geocode rejected.', { ...mapsErrorDetails(cause), latitude: position.lat, longitude: position.lng, geocodingLoaded });
      throw cause;
    }
  }, []);

  const positionPin = useCallback((position: google.maps.LatLngLiteral) => {
    if (!mapHost.current) return;
    if (!map.current) {
      map.current = new google.maps.Map(mapHost.current, { center: position, zoom: 16, streetViewControl: false, mapTypeControl: false, fullscreenControl: false });
      marker.current = new google.maps.Marker({ map: map.current, position, draggable: true, title: 'Drag to adjust your delivery point' });
      marker.current.addListener('dragend', async (event: google.maps.MapMouseEvent) => {
        const point = event.latLng;
        if (!point) return;
        const latitude = point.lat(), longitude = point.lng();
        map.current?.panTo(point);
        try {
          const place = await reverseGeocode({ lat: latitude, lng: longitude });
          if (place?.formatted_address) callbacks.current.onAddress(place.formatted_address);
          callbacks.current.onChange({ latitude, longitude, placeId: place?.place_id, placeName: place?.address_components?.[0]?.long_name, verified: Boolean(place?.formatted_address) });
          setReverseGeocodingError(place?.formatted_address ? '' : 'Pin adjusted, but Google returned no formatted address.');
        } catch (cause) {
          console.error('[Google Maps Geocoding] Pin reverse geocoding failed.', mapsErrorDetails(cause));
          callbacks.current.onChange({ latitude, longitude, verified: false });
          setReverseGeocodingError(mapsServiceMessage(cause, 'Geocoding API'));
        }
      });
    } else {
      map.current.setCenter(position);
      marker.current?.setPosition(position);
    }
    requestAnimationFrame(() => {
      if (!map.current) return;
      google.maps.event.trigger(map.current, 'resize');
      map.current.setCenter(position);
    });
  }, [reverseGeocode]);

  useEffect(() => {
    let active = true;
    setLoadState('loading');
    onLoadState?.('loading');
    void loadGoogleMaps().then(async () => {
      if (!active) return;
      const { AutocompleteSuggestion, AutocompleteSessionToken } = await google.maps.importLibrary('places');
      if (!active) return;
      if (!AutocompleteSuggestion?.fetchAutocompleteSuggestions || !AutocompleteSessionToken) {
        console.error('[Google Maps Places] Places library is missing the Place Autocomplete Data API. Enable Places API (New) for this project.');
        throw new Error('Places API (New) is unavailable.');
      }
      placesApi.current = { AutocompleteSuggestion, AutocompleteSessionToken };
      sessionToken.current = new AutocompleteSessionToken();
      setLoadState('ready'); setAutocompleteReady(true); onLoadState?.('ready'); setError('');
    }).catch((cause) => {
      if (!active) return;
      console.error('[Google Maps] Places library import failed.', mapsErrorDetails(cause));
      setLoadState('error'); onLoadState?.('error');
      setError(`${mapsServiceMessage(cause, 'Places API (New)')} Enter the address manually; the order will be marked Location not verified.`);
    });
    return () => { active = false; if (window.google?.maps && marker.current) google.maps.event.clearInstanceListeners(marker.current); };
  }, [positionPin, onLoadState]);

  useEffect(() => {
    if (!autocompleteReady || !searchOpen || address.trim().length < 2) {
      requestId.current += 1; setSearchState('idle'); setSuggestions([]); setActiveSuggestion(-1);
      return;
    }
    let active = true;
    const timer = window.setTimeout(() => {
      const currentRequest = ++requestId.current;
      setSearchState('loading'); setAutocompleteError('');
      const api = placesApi.current;
      if (!api) { setSearchState('error'); setAutocompleteError('Places API (New) is not ready.'); return; }
      if (!sessionToken.current) sessionToken.current = new api.AutocompleteSessionToken();
      const configuredBiasRadius = 50000;
      const biasRadius = Number.isFinite(configuredBiasRadius) ? Math.max(0, Math.min(configuredBiasRadius, 50000)) : null;
      const request = {
        input: address.trim(),
        sessionToken: sessionToken.current,
        includedRegionCodes: ['ke'],
        language: 'en',
        region: 'ke',
        ...(biasRadius == null ? {} : { locationBias: { center: { lat: -1.286389, lng: 36.817223 }, radius: biasRadius } }),
      } satisfies google.maps.places.AutocompleteRequest;
      console.info('[Google Maps Places] Autocomplete request.', request);
      void api.AutocompleteSuggestion.fetchAutocompleteSuggestions(request).then((response) => {
        if (!active || currentRequest !== requestId.current) return;
        const results = response.suggestions ?? [];
        const predictions = results.map(suggestion => suggestion.placePrediction).filter((prediction): prediction is google.maps.places.PlacePrediction => Boolean(prediction));
        setSuggestions(predictions); setActiveSuggestion(-1);
        setAutocompleteError('');
        setSearchState(predictions.length ? 'results' : 'empty');
        if (!predictions.length) console.info('[Google Maps Places] Successful autocomplete request returned no place predictions.', { input: request.input, suggestions: results });
      }).catch((cause) => {
        if (!active || currentRequest !== requestId.current) return;
        const details = mapsErrorDetails(cause), message = details.message;
        console.error('[Google Maps Places] fetchAutocompleteSuggestions rejected.', details);
        if (/REQUEST_DENIED|denied|not authorized/i.test(message)) console.error('[Google Maps Places] REQUEST_DENIED: verify key restrictions, billing, and that Places API (New) is enabled.');
        if (/legacy|not enabled|unsupported|AutocompleteSuggestion/i.test(message)) console.error('[Google Maps Places] Places API (New) is not enabled or unavailable for this API key/project.');
        setSuggestions([]); setSearchState('error'); setAutocompleteError(mapsServiceMessage(cause, 'Places API (New)')); onLoadState?.('autocomplete-error');
      });
    }, 300);
    return () => { active = false; window.clearTimeout(timer); };
  }, [address, autocompleteReady, searchOpen, retryNonce, onLoadState]);

  async function selectSuggestion(prediction: google.maps.places.PlacePrediction) {
    setSearchState('loading');
    try {
      const place = prediction.toPlace();
      await place.fetchFields({ fields: ['id', 'displayName', 'formattedAddress', 'location', 'addressComponents'] });
      if (!place.location) {
        console.error('[Google Maps Places] The selected Place has no location.', { placeId: place.id });
        setAutocompleteError('That location has no map coordinates. Please choose another suggestion.');
        return;
      }
      const formatted = place.formattedAddress || place.displayName || prediction.text.toString();
      const next = { latitude: place.location.lat(), longitude: place.location.lng(), placeId: place.id, placeName: place.displayName || undefined, verified: true };
      callbacks.current.onAddress(formatted); callbacks.current.onChange(next); positionPin({ lat: next.latitude, lng: next.longitude });
      setSuggestions([]); setSearchOpen(false); setSearchState('idle'); setActiveSuggestion(-1); setAutocompleteError(''); setError(''); onLoadState?.('ready');
      sessionToken.current = new (placesApi.current?.AutocompleteSessionToken || google.maps.places.AutocompleteSessionToken)();
      localStorage.setItem('chupahub-delivery-label', place.displayName || formatted.split(',')[0]);
      window.dispatchEvent(new Event('chupahub-location-updated'));
    } catch (cause) {
      console.error('[Google Maps Places] place.fetchFields rejected.', mapsErrorDetails(cause));
      setAutocompleteError(mapsServiceMessage(cause, 'Places API (New)'));
      setSearchState('error');
    }
  }

  function searchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') { setSearchOpen(false); setActiveSuggestion(-1); return; }
    if (!searchOpen || !suggestions.length) return;
    if (event.key === 'ArrowDown') { event.preventDefault(); setActiveSuggestion(current => Math.min(current + 1, suggestions.length - 1)); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); setActiveSuggestion(current => Math.max(current - 1, 0)); }
    else if (event.key === 'Enter' && activeSuggestion >= 0) { event.preventDefault(); void selectSuggestion(suggestions[activeSuggestion]); }
  }

  useEffect(() => { if (ready && value?.verified) positionPin({ lat: value.latitude, lng: value.longitude }); }, [positionPin, ready, value]);

  function changed(text: string) { onAddress(text); setSearchOpen(true); setSearchState('idle'); setAutocompleteError(''); setReverseGeocodingError(''); setError(''); if (autocompleteReady) onLoadState?.('ready'); if (value) onChange(null); }
  function retryAutocomplete() { requestId.current += 1; setAutocompleteError(''); setSearchState('idle'); setSearchOpen(true); onLoadState?.('ready'); setRetryNonce(value => value + 1); }
  function currentLocation() {
    if (!navigator.geolocation) { setError('Location is not supported by this browser.'); return; }
    setAutocompleteError(''); setSearchOpen(false); setLocating(true);
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      const position = { lat: coords.latitude, lng: coords.longitude };
      try {
        const place = await reverseGeocode(position);
        if (!place?.formatted_address) { onChange({ latitude: position.lat, longitude: position.lng, verified: false }); setReverseGeocodingError('We found your coordinates, but Google returned no formatted address.'); return; }
        onAddress(place.formatted_address); onChange({ latitude: position.lat, longitude: position.lng, placeId: place.place_id, placeName: place.address_components?.[0]?.long_name, verified: true });
        positionPin(position); setReverseGeocodingError(''); setError('');
      } catch (cause) { console.error('[Google Maps Geocoding] Current-location reverse geocoding failed.', mapsErrorDetails(cause)); onChange({ latitude: position.lat, longitude: position.lng, verified: false }); setReverseGeocodingError(mapsServiceMessage(cause, 'Geocoding API')); }
      finally { setLocating(false); }
    }, () => { setError('Location permission was not granted. Search for your delivery location instead.'); setLocating(false); }, { enableHighAccuracy: true, timeout: 10000 });
  }

  return <div className="overflow-visible"><label className="block font-black">Search your delivery location<div className="relative mt-2 overflow-visible"><Search className="absolute left-3 top-3 text-brand-orange" size={18}/><input ref={input} value={address} onChange={(event) => changed(event.target.value)} onFocus={() => address.trim().length >= 2 && setSearchOpen(true)} onKeyDown={searchKeyDown} className="w-full rounded-xl border border-orange-200 py-3 pl-10 pr-3 font-normal" placeholder="Building, estate, road, business or landmark" autoComplete="off" role="combobox" aria-autocomplete="list" aria-expanded={searchOpen && address.trim().length >= 2} aria-controls="delivery-location-suggestions"/>{searchOpen && address.trim().length >= 2 && searchState !== 'idle' && searchState !== 'error' && <div id="delivery-location-suggestions" role="listbox" className="absolute left-0 right-0 top-full z-50 mt-1 max-h-72 overflow-y-auto rounded-xl border border-orange-200 bg-white shadow-xl">{searchState === 'loading' ? <p className="p-4 text-sm font-bold text-neutral-500" role="status">Searching…</p> : searchState === 'results' ? suggestions.map((prediction, index) => <button key={prediction.placeId} type="button" role="option" aria-selected={index === activeSuggestion} onMouseDown={(event) => event.preventDefault()} onClick={() => void selectSuggestion(prediction)} className={`block w-full border-b border-orange-100 px-4 py-3 text-left last:border-0 ${index === activeSuggestion ? 'bg-orange-50' : 'bg-white hover:bg-orange-50'}`}><span className="block font-bold text-brand-ink">{prediction.text?.toString() || prediction.mainText?.toString()}</span>{prediction.secondaryText?.toString() && <span className="mt-1 block text-sm text-neutral-600">{prediction.secondaryText.toString()}</span>}</button>) : searchState === 'empty' ? <p className="p-4 text-sm font-bold text-neutral-600">No matching locations found</p> : null}</div>}</div></label>{loadState === 'loading' && <p className="mt-3 text-sm font-bold text-neutral-500" role="status">Loading Google Maps…</p>}{loadState === 'ready' && autocompleteReady && !value?.verified && !autocompleteError && !reverseGeocodingError && <p className="mt-3 text-sm text-neutral-600" role="status">Address suggestions are available. Type at least 2 characters.</p>}{autocompleteError ? <div className="mt-3 flex flex-wrap items-center gap-3" role="alert"><p className="text-sm font-bold text-red-600">{autocompleteError}</p><button type="button" onClick={retryAutocomplete} className="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-bold text-red-700">Retry</button></div> : reverseGeocodingError ? <p className="mt-3 text-sm font-bold text-red-600" role="alert">{reverseGeocodingError}</p> : null}<button type="button" onClick={currentLocation} disabled={locating || !ready} className="mt-3 inline-flex items-center gap-2 rounded-xl border border-orange-200 px-4 py-2 text-sm font-bold disabled:opacity-50"><LocateFixed size={17}/>{locating ? 'Finding address…' : 'Use my current location'}</button><div className={value?.verified ? 'mt-4' : 'hidden'}><div ref={mapHost} className="h-56 w-full overflow-hidden rounded-2xl border border-orange-200" aria-label="Adjust delivery location on Google Map"/><p className="mt-2 flex items-center gap-2 text-xs font-bold text-neutral-600"><MapPin size={15} className="text-brand-orange"/>Drag the pin to adjust the exact delivery point.</p></div>{value?.verified && <p className="mt-3 inline-flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2 text-sm font-bold text-green-700"><CheckCircle2 size={17}/> Location confirmed</p>}{error && <p className="mt-3 text-sm font-bold text-red-600" role="alert">{error}</p>}</div>;
}
