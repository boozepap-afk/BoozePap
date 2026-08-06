'use client';

import { importLibrary, setOptions } from '@googlemaps/js-api-loader';

export type GoogleMapsLoadErrorCode =
  | 'missing-key'
  | 'authentication'
  | 'places-unavailable'
  | 'script-load';

export class GoogleMapsLoadError extends Error {
  constructor(public readonly code: GoogleMapsLoadErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'GoogleMapsLoadError';
  }
}

let mapsPromise: Promise<void> | undefined;

function logMapsError(error: GoogleMapsLoadError) {
  if (error.code === 'missing-key') {
    console.error('[Google Maps] Missing NEXT_PUBLIC_GOOGLE_MAPS_API_KEY. Add it to the deployment environment and rebuild/redeploy the Next.js application.');
    return;
  }

  if (error.code === 'authentication') {
    console.error(
      '[Google Maps] Authentication failed. Check that the API key is valid, billing is enabled, Maps JavaScript API and Places API (New) are enabled, and HTTP referer restrictions allow localhost, the Vercel preview URL, chupahub.com, and www.chupahub.com.',
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

/** Loads Google Maps once, in the browser, with every checkout library preloaded. */
export function loadGoogleMaps(): Promise<void> {
  if (mapsPromise) return mapsPromise;

  mapsPromise = (async () => {
    if (typeof window === 'undefined') {
      throw new GoogleMapsLoadError('script-load', 'Google Maps can only be loaded in a browser.');
    }

    const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!key) throw new GoogleMapsLoadError('missing-key', 'The Google Maps environment variable is missing.');

    let authenticationFailed = false;
    const previousAuthFailure = window.gm_authFailure;
    window.gm_authFailure = () => {
      authenticationFailed = true;
      previousAuthFailure?.();
    };

    // setOptions installs one shared dynamic loader; the promise above prevents duplicate setup/scripts.
    setOptions({ key, v: 'weekly', libraries: ['maps', 'places', 'marker', 'geocoding'] });

    try {
      await Promise.all([
        importLibrary('maps'),
        importLibrary('places'),
        importLibrary('marker'),
        importLibrary('geocoding'),
      ]);

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
