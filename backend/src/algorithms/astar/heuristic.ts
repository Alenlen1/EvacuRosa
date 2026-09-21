import type { GraphNode } from "./node";

export function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Admissible A* heuristic: straight-line distance can never overestimate
 * the true road distance, so this never breaks A*'s optimality guarantee. */
export function heuristic(a: GraphNode, b: GraphNode): number {
  return haversineMeters(a.latitude, a.longitude, b.latitude, b.longitude);
}

/** Converts a lat/lng to local meters (x=east, y=north) relative to a
 * reference point, using an equirectangular approximation. Good enough at
 * city scale (a few km) — used for finding the closest point on a road
 * segment, not for anything requiring surveying-grade precision. */
export function toLocalMeters(
  latitude: number,
  longitude: number,
  refLatitude: number,
  refLongitude: number
): { x: number; y: number } {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const x = toRad(longitude - refLongitude) * R * Math.cos(toRad(refLatitude));
  const y = toRad(latitude - refLatitude) * R;
  return { x, y };
}

/** True minimum distance from a point to a line SEGMENT (not an infinite
 * line, and not just the segment's midpoint or either endpoint). */
export function distanceMetersToSegment(
  point: { latitude: number; longitude: number },
  segmentStart: { latitude: number; longitude: number },
  segmentEnd: { latitude: number; longitude: number }
): number {
  const a = toLocalMeters(
    segmentStart.latitude,
    segmentStart.longitude,
    point.latitude,
    point.longitude
  );
  const b = toLocalMeters(
    segmentEnd.latitude,
    segmentEnd.longitude,
    point.latitude,
    point.longitude
  );

  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) return Math.hypot(a.x, a.y);

  let t = (-a.x * dx + -a.y * dy) / lengthSq;
  t = Math.max(0, Math.min(1, t));
  const closestX = a.x + t * dx;
  const closestY = a.y + t * dy;
  return Math.hypot(closestX, closestY);
}
