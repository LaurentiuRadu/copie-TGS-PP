// Geolocation utilities with cross-platform support

export interface Coordinates {
  latitude: number;
  longitude: number;
}

// Cross-platform geolocation helper
export const getCurrentPosition = async (opts?: PositionOptions): Promise<GeolocationPosition> => {
  try {
    const { Geolocation } = await import('@capacitor/geolocation');
    // @ts-ignore - Capacitor options compatible
    return await Geolocation.getCurrentPosition(opts as any);
  } catch {
    return await new Promise<GeolocationPosition>((resolve, reject) => {
      if (!('geolocation' in navigator)) {
        return reject(new Error('Geolocation not supported'));
      }
      navigator.geolocation.getCurrentPosition(resolve, reject, opts);
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
