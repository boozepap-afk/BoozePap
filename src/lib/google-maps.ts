'use client';

import { importLibrary, setOptions } from '@googlemaps/js-api-loader';

export type GoogleMapsLoadErrorCode =
  | 'missing-key'
  | 'authentication'
  | 'places-unavailable'
  | 'script-load'
  | 'configuration-load';

export class GoogleMapsLoadError extends Error {
  constructor(public readonly code: GoogleMapsLoadErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'GoogleMapsLoadError';
  }
}

let mapsPromise: Promise<void> | undefined;
let loaderConfigured = false;

function logMapsError(error: GoogleMapsLoadError) {
  if (error.code === 'missing-key') {
    console.error('[Google Maps] Missing NEXT_PUBLIC_GOOGLE_MAPS_API_KEY. Set the public browser key in Cloudflare Worker runtime variables.');
    return;
  }

  if (error.code === 'authentication') {
    console.error(
      '[Google Maps] Authentication failed. Check that the API key is valid, billing is enabled, Maps JavaScript API and Places API (New) are enabled, and HTTP referer restrictions allow the intended BoozePap production domain and approved development/preview domains.',
      error,
    );
    return;
  }

  if (error.code === 'places-unavailable') {
    console.error('[Google Maps] Places library is unavailable. Enable Places API (New) for the key/project and confirm its API restrictions permit Places API (New).', error);
    return;
  }

  console.error(
    '[Google Maps] Script loading failed. Check the network/CSP and then verify the API key, HTTP referer restrictions, enabled Maps JavaScript/Places APIs, and billing.',
    error,
  );
}

async function browserMapsKey() {
  const compiledKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim();
  try {
    const response = await fetch('/api/maps/config', { cache: 'no-store', signal: AbortSignal.timeout(8000) });
    if (response.ok) {
      const config = await response.json() as { apiKey?: string };
      if (typeof config.apiKey === 'string' && config.apiKey.trim()) return config.apiKey.trim();
    }
    if (!compiledKey && response.status === 503) throw new GoogleMapsLoadError('missing-key', 'The Google Maps browser key is not configured.');
  } catch (cause) {
    if (cause instanceof GoogleMapsLoadError) throw cause;
    if (!compiledKey) throw new GoogleMapsLoadError('configuration-load', 'Could not load address lookup configuration.', { cause });
  }
  if (compiledKey) return compiledKey;
  throw new GoogleMapsLoadError('missing-key', 'The Google Maps browser key is not configured.');
}

/** Address search needs Places only. Load maps/geocoding when actually used. */
export function loadGoogleMaps(): Promise<void> {
  if (mapsPromise) return mapsPromise;

  mapsPromise = (async () => {
    if (typeof window === 'undefined') {
      throw new GoogleMapsLoadError('script-load', 'Google Maps can only be loaded in a browser.');
    }

    const key = await browserMapsKey();

    let authenticationFailed = false;
    const previousAuthFailure = window.gm_authFailure;
    window.gm_authFailure = () => {
      authenticationFailed = true;
      previousAuthFailure?.();
    };

    // setOptions installs one shared dynamic loader; the promise above prevents duplicate setup/scripts.
    if (!loaderConfigured) {
      setOptions({ key, v: 'weekly', language: 'en', region: 'KE' });
      loaderConfigured = true;
    }

    try {
      await importLibrary('places');

      if (authenticationFailed) {
        throw new GoogleMapsLoadError('authentication', 'Google Maps rejected the configured API key.');
      }
      if (!window.google?.maps?.places?.AutocompleteSuggestion?.fetchAutocompleteSuggestions || !window.google.maps.places.AutocompleteSessionToken) {
        throw new GoogleMapsLoadError('places-unavailable', 'Google Maps loaded without the Place Autocomplete Data API.');
      }
    } catch (cause) {
      if (cause instanceof GoogleMapsLoadError) throw cause;
      const message = cause instanceof Error ? cause.message : String(cause);
      const authenticationError = authenticationFailed || /api.?key|billing|referer|referrer|denied|not.?authorized|invalid/i.test(message);
      throw new GoogleMapsLoadError(
        authenticationError ? 'authentication' : 'script-load',
        authenticationError ? 'Google Maps authentication failed.' : 'The Google Maps JavaScript API script could not be loaded.',
        { cause },
      );
    } finally {
      window.gm_authFailure = previousAuthFailure;
    }
  })().catch((cause) => {
    const error = cause instanceof GoogleMapsLoadError
      ? cause
      : new GoogleMapsLoadError('script-load', 'The Google Maps JavaScript API script could not be loaded.', { cause });
    mapsPromise = undefined; // A transient failure must not poison every later attempt.
    logMapsError(error);
    throw error;
  });

  return mapsPromise;
}

declare global {
  interface Window {
    gm_authFailure?: () => void;
  }
}
