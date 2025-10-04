// Geolocation utilities with cross-platform support

export interface Coordinates {
  latitude: number;
  longitude: number;
}

// Cache pentru ultimele coordonate valide
let lastKnownPosition: GeolocationPosition | null = null;
const LOCATION_CACHE_KEY = 'timetrack_last_location';
const LOCATION_CACHE_EXPIRY = 10 * 60 * 1000; // 10 minute

interface CachedLocation {
  coords: {
    latitude: number;
    longitude: number;
    accuracy: number;
    altitude: number | null;
    altitudeAccuracy: number | null;
    heading: number | null;
    speed: number | null;
  };
  timestamp: number;
}

// Încarcă locația din cache la startup
function loadCachedLocation(): GeolocationPosition | null {
  try {
    const cached = localStorage.getItem(LOCATION_CACHE_KEY);
    if (!cached) return null;
    
    const data: CachedLocation = JSON.parse(cached);
    const age = Date.now() - data.timestamp;
    
    // Returnează doar dacă e mai proaspăt de 10 minute
    if (age < LOCATION_CACHE_EXPIRY) {
      lastKnownPosition = data as any;
      return data as any;
    }
    
    localStorage.removeItem(LOCATION_CACHE_KEY);
    return null;
  } catch (error) {
    return null;
  }
}

// Salvează locația în cache
function saveCachedLocation(position: GeolocationPosition): void {
  try {
    const data: CachedLocation = {
      coords: {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        altitude: position.coords.altitude,
        altitudeAccuracy: position.coords.altitudeAccuracy,
        heading: position.coords.heading,
        speed: position.coords.speed,
      },
      timestamp: position.timestamp
    };
    localStorage.setItem(LOCATION_CACHE_KEY, JSON.stringify(data));
    lastKnownPosition = position;
  } catch (error) {
    console.warn('Failed to cache location:', error);
  }
}

// Returnează ultima locație cunoscută (din memorie sau cache)
export function getLastKnownPosition(): GeolocationPosition | null {
  if (lastKnownPosition) return lastKnownPosition;
  return loadCachedLocation();
}

// Cross-platform geolocation helper cu cache inteligent
export const getCurrentPosition = async (opts?: PositionOptions): Promise<GeolocationPosition> => {
  try {
    const { Geolocation } = await import('@capacitor/geolocation');
    // @ts-ignore - Capacitor options compatible
    const position = await Geolocation.getCurrentPosition(opts as any);
    const geoPosition = position as unknown as GeolocationPosition;
    saveCachedLocation(geoPosition);
    return geoPosition;
  } catch (capacitorError) {
    // Fallback la Web Geolocation API
    return await new Promise<GeolocationPosition>((resolve, reject) => {
      if (!('geolocation' in navigator)) {
        // Încearcă cache dacă geolocation nu e disponibil
        const cached = getLastKnownPosition();
        if (cached) {
          console.warn('Geolocation not supported, using cached location');
          resolve(cached);
          return;
        }
        return reject(new Error('Geolocation not supported'));
      }
      
      navigator.geolocation.getCurrentPosition(
        (position) => {
          saveCachedLocation(position);
          resolve(position);
        },
        (error) => {
          // Dacă eșuează și există cache, folosește cache-ul (doar dacă nu e permission denied)
          const cached = getLastKnownPosition();
          if (cached && error.code !== 1) {
            console.warn('GPS failed, using cached location:', error.message);
            resolve(cached);
            return;
          }
          reject(error);
        },
        opts
      );
    });
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
