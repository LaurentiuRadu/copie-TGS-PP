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
 * Enhanced geolocation with retry logic and fallback for Android devices
 * - Încercări multiple (default: 3)
 * - Timeout mai mare (default: 15 secunde)
 * - Fallback la low accuracy dacă high accuracy eșuează
 * - Cache pentru ultima locație validă
 */
export const getCurrentPosition = async (opts?: GeolocationOptions): Promise<GeolocationPosition> => {
  const maxRetries = opts?.maxRetries ?? 3;
  const retryDelay = opts?.retryDelay ?? 1000;
  const timeout = opts?.timeout ?? 15000; // 15 seconds default
  const enableHighAccuracy = opts?.enableHighAccuracy ?? true;
  const maximumAge = opts?.maximumAge ?? 0;

  console.log('[Geolocation] 📍 Starting location request:', {
    maxRetries,
    timeout,
    enableHighAccuracy,
    hasCachedPosition: !!cachedPosition
  });

  // Helper function to get position (Capacitor or Web API)
  const getPositionOnce = async (options: PositionOptions): Promise<GeolocationPosition> => {
    try {
      const { Geolocation } = await import('@capacitor/geolocation');
      // @ts-ignore - Capacitor options compatible
      return await Geolocation.getCurrentPosition(options as any);
    } catch {
      return await new Promise<GeolocationPosition>((resolve, reject) => {
        if (!('geolocation' in navigator)) {
          return reject(new Error('Geolocation not supported'));
        }
        navigator.geolocation.getCurrentPosition(resolve, reject, options);
      });
    }
  };

  // Try with high accuracy first
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[Geolocation] 🔄 Attempt ${attempt}/${maxRetries} (high accuracy: ${enableHighAccuracy})`);
      
      const position = await getPositionOnce({
        enableHighAccuracy,
        timeout,
        maximumAge
      });

      console.log('[Geolocation] ✅ Location obtained successfully:', {
        accuracy: position.coords.accuracy,
        latitude: position.coords.latitude.toFixed(6),
        longitude: position.coords.longitude.toFixed(6)
      });

      // Update cache
      cachedPosition = position;
      cacheTimestamp = Date.now();

      return position;
    } catch (error: any) {
      console.warn(`[Geolocation] ⚠️ Attempt ${attempt} failed:`, {
        code: error.code,
        message: error.message
      });

      // If this is not the last attempt and it's a timeout or position unavailable error
      if (attempt < maxRetries && (error.code === 2 || error.code === 3)) {
        console.log(`[Geolocation] ⏳ Retrying in ${retryDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        continue;
      }

      // If permission denied, don't retry
      if (error.code === 1) {
        throw error;
      }

      // If this was the last high-accuracy attempt, try low accuracy as fallback
      if (attempt === maxRetries && enableHighAccuracy) {
        console.log('[Geolocation] 🔄 Trying fallback with low accuracy...');
        try {
          const fallbackPosition = await getPositionOnce({
            enableHighAccuracy: false,
            timeout: timeout * 0.75, // Slightly shorter timeout
            maximumAge: 10000 // Accept cached position up to 10 seconds old
          });

          console.log('[Geolocation] ✅ Fallback location obtained:', {
            accuracy: fallbackPosition.coords.accuracy,
            latitude: fallbackPosition.coords.latitude.toFixed(6),
            longitude: fallbackPosition.coords.longitude.toFixed(6)
          });

          // Update cache
          cachedPosition = fallbackPosition;
          cacheTimestamp = Date.now();

          return fallbackPosition;
        } catch (fallbackError) {
          console.error('[Geolocation] ❌ Fallback also failed:', fallbackError);
        }
      }

      // If all attempts failed, check if we have a recent cached position
      if (cachedPosition && (Date.now() - cacheTimestamp) < CACHE_DURATION) {
        console.warn('[Geolocation] 🗂️ Using cached position from', new Date(cacheTimestamp).toISOString());
        return cachedPosition;
      }

      throw error;
    }
  }

  throw new Error('Location request failed after all retries');
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
