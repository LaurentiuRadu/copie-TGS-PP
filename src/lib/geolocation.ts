// Geolocation utilities with cross-platform support for Android/iOS

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface GeolocationOptions {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
  maxRetries?: number;
  retryDelay?: number;
}

// Cache for last known good position
let cachedPosition: GeolocationPosition | null = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minute cache

/**
 * Enhanced geolocation with PARALLEL GPS + WiFi detection for maximum speed
 * Strategy:
 * - Pornește GPS (high accuracy) și WiFi (low accuracy) în paralel
 * - Returnează prima locație care vine (de obicei WiFi e mai rapid)
 * - Retry logic pentru fiecare metodă
 * - Cache pentru ultima locație validă
 */
export const getCurrentPosition = async (opts?: GeolocationOptions): Promise<GeolocationPosition> => {
  const maxRetries = opts?.maxRetries ?? 3;
  const retryDelay = opts?.retryDelay ?? 1000;
  const timeout = opts?.timeout ?? 15000; // 15 seconds default
  const maximumAge = opts?.maximumAge ?? 0;

  console.log('[Geolocation] 📍 Starting PARALLEL location request (GPS + WiFi):', {
    maxRetries,
    timeout,
    hasCachedPosition: !!cachedPosition
  });

  // Helper function to get position (Capacitor or Web API)
  const getPositionOnce = async (options: PositionOptions, label: string): Promise<GeolocationPosition> => {
    console.log(`[Geolocation] 🚀 Starting ${label} request...`);
    try {
      const { Geolocation } = await import('@capacitor/geolocation');
      // @ts-ignore - Capacitor options compatible
      const position = await Geolocation.getCurrentPosition(options as any);
      console.log(`[Geolocation] ✅ ${label} succeeded:`, {
        accuracy: position.coords.accuracy,
        latitude: position.coords.latitude.toFixed(6),
        longitude: position.coords.longitude.toFixed(6)
      });
      // Capacitor returns Position, cast to GeolocationPosition
      return position as unknown as GeolocationPosition;
    } catch (capacitorError) {
      // Fallback to web API
      return await new Promise<GeolocationPosition>((resolve, reject) => {
        if (!('geolocation' in navigator)) {
          return reject(new Error('Geolocation not supported'));
        }
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            console.log(`[Geolocation] ✅ ${label} succeeded (web API):`, {
              accuracy: pos.coords.accuracy,
              latitude: pos.coords.latitude.toFixed(6),
              longitude: pos.coords.longitude.toFixed(6)
            });
            resolve(pos);
          },
          (err) => {
            console.warn(`[Geolocation] ❌ ${label} failed:`, err.message);
            reject(err);
          },
          options
        );
      });
    }
  };

  // Retry function with exponential backoff
  const getPositionWithRetry = async (
    enableHighAccuracy: boolean, 
    label: string
  ): Promise<GeolocationPosition> => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const position = await getPositionOnce({
          enableHighAccuracy,
          timeout: timeout / maxRetries, // Distribute timeout across retries
          maximumAge: enableHighAccuracy ? maximumAge : 10000 // WiFi can use slightly older position
        }, `${label} (attempt ${attempt}/${maxRetries})`);

        return position;
      } catch (error: any) {
        // If permission denied, don't retry
        if (error.code === 1) {
          throw error;
        }

        // If not last attempt, retry
        if (attempt < maxRetries) {
          const delay = retryDelay * attempt; // Exponential backoff
          console.log(`[Geolocation] ⏳ ${label} retry in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        throw error;
      }
    }
    throw new Error(`${label} failed after ${maxRetries} retries`);
  };

  try {
    // Start BOTH GPS and WiFi in parallel - use whichever responds first!
    const gpsPromise = getPositionWithRetry(true, 'GPS (high accuracy)');
    const wifiPromise = getPositionWithRetry(false, 'WiFi (low accuracy)');

    // Race them - first one to succeed wins!
    const position = await Promise.race([gpsPromise, wifiPromise]);

    console.log('[Geolocation] 🏆 First location obtained (probably WiFi):', {
      accuracy: position.coords.accuracy,
      source: position.coords.accuracy < 50 ? 'GPS' : 'WiFi/Network'
    });

    // Update cache
    cachedPosition = position;
    cacheTimestamp = Date.now();

    return position;
  } catch (error: any) {
    console.error('[Geolocation] ❌ Both GPS and WiFi failed:', error);

    // Last resort: check cached position
    if (cachedPosition && (Date.now() - cacheTimestamp) < CACHE_DURATION) {
      console.warn('[Geolocation] 🗂️ Using cached position from', new Date(cacheTimestamp).toISOString());
      return cachedPosition;
    }

    throw error;
  }
};

// Calculate distance between two coordinates using Haversine formula
// Returns distance in meters
export const calculateDistance = (coord1: Coordinates, coord2: Coordinates): number => {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (coord1.latitude * Math.PI) / 180;
  const φ2 = (coord2.latitude * Math.PI) / 180;
  const Δφ = ((coord2.latitude - coord1.latitude) * Math.PI) / 180;
  const Δλ = ((coord2.longitude - coord1.longitude) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
};

// Check if coordinates are within allowed radius of a location
export const isWithinRadius = (
  currentCoords: Coordinates,
  locationCoords: Coordinates,
  radiusMeters: number
): boolean => {
  const distance = calculateDistance(currentCoords, locationCoords);
  return distance <= radiusMeters;
};

// Find nearest work location from user's current position
export const findNearestLocation = (
  currentCoords: Coordinates,
  locations: Array<{ id: string; latitude: number; longitude: number; radius_meters: number }>
) => {
  let nearest = null;
  let minDistance = Infinity;

  for (const location of locations) {
    const distance = calculateDistance(currentCoords, {
      latitude: location.latitude,
      longitude: location.longitude,
    });

    if (distance <= location.radius_meters && distance < minDistance) {
      minDistance = distance;
      nearest = { ...location, distance };
    }
  }

  return nearest;
};

/**
 * Verifică dacă coordonatele curente sunt în interiorul unei locații definite
 * Suportă: cerc (radius), poligon (geometry), sau țară întreagă (country)
 */
export const isWithinLocation = async (
  currentCoords: Coordinates,
  location: {
    latitude: number;
    longitude: number;
    radius_meters: number;
    coverage_type?: 'circle' | 'polygon' | 'country';
    geometry?: any; // GeoJSON geometry
  }
): Promise<boolean> => {
  // Toată țara = permite oriunde
  if (location.coverage_type === 'country') {
    return true;
  }
  
  // Poligon desenat - folosește turf pentru verificare
  if (location.coverage_type === 'polygon' && location.geometry) {
    try {
      const { default: booleanPointInPolygon } = await import('@turf/boolean-point-in-polygon');
      const point: [number, number] = [currentCoords.longitude, currentCoords.latitude];
      return booleanPointInPolygon(point, location.geometry);
    } catch (error) {
      console.error('[Geolocation] Error checking polygon:', error);
      return false;
    }
  }
  
  // Circle (metoda existentă) - fallback implicit
  return isWithinRadius(
    currentCoords,
    { latitude: location.latitude, longitude: location.longitude },
    location.radius_meters
  );
};
