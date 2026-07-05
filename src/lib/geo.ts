// =============================================================================
// Haversine Distance Calculation
// =============================================================================
// Application-level distance calculation between two geographic coordinates.
// Used since SQLite (unlike PostgreSQL + PostGIS) has no spatial extensions.
// =============================================================================

import { EARTH_RADIUS_MILES } from "@/lib/constants";

/**
 * Calculate the great-circle distance between two points on Earth
 * using the Haversine formula.
 *
 * @param lat1 - Latitude of point 1 in decimal degrees
 * @param lon1 - Longitude of point 1 in decimal degrees
 * @param lat2 - Latitude of point 2 in decimal degrees
 * @param lon2 - Longitude of point 2 in decimal degrees
 * @returns Distance in miles
 */
export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_MILES * c;
}

/**
 * Check if a point is within a given radius of a center point.
 */
export function isWithinRadius(
  centerLat: number,
  centerLon: number,
  pointLat: number,
  pointLon: number,
  radiusMiles: number
): boolean {
  return haversineDistance(centerLat, centerLon, pointLat, pointLon) <= radiusMiles;
}

/**
 * Format a distance for display.
 * Shows 1 decimal for distances < 10 miles, 0 decimals for >= 10.
 */
export function formatDistance(miles: number): string {
  if (miles < 0.1) return "<0.1 mi";
  if (miles < 10) return `${miles.toFixed(1)} mi`;
  return `${Math.round(miles)} mi`;
}

/**
 * Format cents as a dollar string.
 * @example formatCents(2500) → "$25.00"
 * @example formatCents(0) → "Free"
 */
export function formatCents(cents: number): string {
  if (cents === 0) return "Free";
  return `$${(cents / 100).toFixed(2)}`;
}

/**
 * Generate a bounding box for a rough pre-filter (before precise Haversine).
 * This is an optimization to reduce the number of precise distance calculations.
 */
export function getBoundingBox(
  centerLat: number,
  centerLon: number,
  radiusMiles: number
): {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
} {
  const latDelta = (radiusMiles / EARTH_RADIUS_MILES) * (180 / Math.PI);
  const lonDelta =
    (radiusMiles / (EARTH_RADIUS_MILES * Math.cos((centerLat * Math.PI) / 180))) *
    (180 / Math.PI);

  return {
    minLat: centerLat - latDelta,
    maxLat: centerLat + latDelta,
    minLon: centerLon - lonDelta,
    maxLon: centerLon + lonDelta,
  };
}