// app/utils/geoUtils.ts

interface Coordinate {
  lat: number;
  lng: number;
}

/**
 * Calculate distance between two coordinates in meters
 * Uses Haversine formula
 */
export const getDistanceFromLatLonInMeters = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371000; // Earth radius in meters
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) *
      Math.cos(deg2rad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  return distance;
};

const deg2rad = (deg: number): number => {
  return deg * (Math.PI / 180);
};

/**
 * Find the nearest point on the route to the current location
 * Also returns the perpendicular distance to the nearest segment
 */
export const findNearestPointOnRoute = (
  currentLat: number,
  currentLng: number,
  route: Coordinate[]
): { index: number; distance: number; segmentDistance?: number } => {
  let minDistance = Infinity;
  let nearestIndex = 0;
  let minSegmentDistance = Infinity;

  // Check each point on the route
  route.forEach((point, index) => {
    const distance = getDistanceFromLatLonInMeters(
      currentLat,
      currentLng,
      point.lat,
      point.lng
    );

    if (distance < minDistance) {
      minDistance = distance;
      nearestIndex = index;
    }
  });

  // Also check perpendicular distance to segments
  for (let i = 0; i < route.length - 1; i++) {
    const segmentDist = distanceToSegment(
      currentLat,
      currentLng,
      route[i],
      route[i + 1]
    );

    if (segmentDist < minSegmentDistance) {
      minSegmentDistance = segmentDist;
      // If user is closer to a segment than to the nearest point,
      // use the end of that segment
      if (segmentDist < minDistance) {
        nearestIndex = i + 1;
        minDistance = segmentDist;
      }
    }
  }

  return {
    index: nearestIndex,
    distance: minDistance,
    segmentDistance: minSegmentDistance,
  };
};

/**
 * Calculate perpendicular distance from point to line segment
 */
const distanceToSegment = (
  pointLat: number,
  pointLng: number,
  segmentStart: Coordinate,
  segmentEnd: Coordinate
): number => {
  const x = pointLat;
  const y = pointLng;
  const x1 = segmentStart.lat;
  const y1 = segmentStart.lng;
  const x2 = segmentEnd.lat;
  const y2 = segmentEnd.lng;

  const A = x - x1;
  const B = y - y1;
  const C = x2 - x1;
  const D = y2 - y1;

  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  let param = -1;

  if (lenSq !== 0) {
    param = dot / lenSq;
  }

  let xx, yy;

  if (param < 0) {
    xx = x1;
    yy = y1;
  } else if (param > 1) {
    xx = x2;
    yy = y2;
  } else {
    xx = x1 + param * C;
    yy = y1 + param * D;
  }

  return getDistanceFromLatLonInMeters(pointLat, pointLng, xx, yy);
};

/**
 * Calculate the cumulative traveled distance along the route
 */
export const calculateTraveledDistance = (
  route: Coordinate[],
  traveledIndices: Set<number>
): number => {
  let totalDistance = 0;

  const sortedIndices = Array.from(traveledIndices).sort((a, b) => a - b);

  for (let i = 0; i < sortedIndices.length - 1; i++) {
    const currentIdx = sortedIndices[i];
    const nextIdx = sortedIndices[i + 1];

    // If indices are consecutive, add the distance between them
    if (nextIdx === currentIdx + 1) {
      totalDistance += getDistanceFromLatLonInMeters(
        route[currentIdx].lat,
        route[currentIdx].lng,
        route[nextIdx].lat,
        route[nextIdx].lng
      );
    }
  }

  return totalDistance;
};

/**
 * Calculate total route distance
 */
export const calculateTotalRouteDistance = (route: Coordinate[]): number => {
  let totalDistance = 0;

  for (let i = 0; i < route.length - 1; i++) {
    totalDistance += getDistanceFromLatLonInMeters(
      route[i].lat,
      route[i].lng,
      route[i + 1].lat,
      route[i + 1].lng
    );
  }

  return totalDistance;
};

/**
 * Get the furthest traveled index (highest index in the set)
 * This represents how far along the route the user has progressed
 */
export const getFurthestTraveledIndex = (
  traveledIndices: Set<number>
): number => {
  if (traveledIndices.size === 0) return -1;
  return Math.max(...Array.from(traveledIndices));
};

/**
 * Check if user is progressing forward on the route
 */
export const isProgressingForward = (
  currentIndex: number,
  previousFurthestIndex: number
): boolean => {
  return currentIndex > previousFurthestIndex;
};

/**
 * Format distance for display (meters or kilometers)
 */
export const formatDistance = (meters: number): string => {
  if (meters < 1000) {
    return `${Math.round(meters)}m`;
  }
  return `${(meters / 1000).toFixed(2)}km`;
};

/**
 * Format seconds into MM:SS
 */
export const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

/**
 * Calculate progress percentage along route
 */
export const calculateProgress = (
  traveledIndices: Set<number>,
  totalPoints: number
): number => {
  const furthestIndex = getFurthestTraveledIndex(traveledIndices);
  if (furthestIndex < 0) return 0;
  return Math.round((furthestIndex / (totalPoints - 1)) * 100);
};
