import boundary from "../data/santaRosaBoundary.json";

/** Union of all 18 published Santa Rosa barangay boundaries. */
export const santaRosaBoundary = boundary;
const polygons = boundary.geometry.coordinates;
const rings = polygons.flat();
const points = rings.flat();
const longitudes = points.map((point) => point[0]);
const latitudes = points.map((point) => point[1]);
export const santaRosaBounds: [[number, number], [number, number]] = [
  [Math.min(...latitudes), Math.min(...longitudes)],
  [Math.max(...latitudes), Math.max(...longitudes)],
];

export const HAZARD_CITY_ERROR =
  "Select a location inside Santa Rosa City. Hazard reports cannot be placed outside the city boundary.";
export const HAZARD_ROAD_ERROR =
  "Select a road entirely inside Santa Rosa City. Roads outside or crossing the city boundary cannot be reported here.";

export function isInsideSantaRosa(
  latitude: number,
  longitude: number,
): boolean {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return false;
  const [sw, ne] = santaRosaBounds;
  if (
    latitude < sw[0] ||
    latitude > ne[0] ||
    longitude < sw[1] ||
    longitude > ne[1]
  )
    return false;
  return polygons.some(
    ([outer, ...holes]) =>
      isInsideRing(latitude, longitude, outer) &&
      !holes.some((hole) => isInsideRing(latitude, longitude, hole)),
  );
}

function isInsideRing(
  latitude: number,
  longitude: number,
  ring: number[][],
): boolean {
  let inside = false;
  for (let i = 1; i < ring.length; i++) {
    const [ax, ay] = ring[i - 1];
    const [bx, by] = ring[i];
    const cross = (longitude - ax) * (by - ay) - (latitude - ay) * (bx - ax);
    if (
      Math.abs(cross) < 1e-12 &&
      longitude >= Math.min(ax, bx) &&
      longitude <= Math.max(ax, bx) &&
      latitude >= Math.min(ay, by) &&
      latitude <= Math.max(ay, by)
    )
      return true;
    if (
      ay > latitude !== by > latitude &&
      longitude < ((bx - ax) * (latitude - ay)) / (by - ay) + ax
    )
      inside = !inside;
  }
  return inside;
}

/** Check every interval between boundary crossings, including concave borders. */
export function isSantaRosaSegment(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
): boolean {
  if (
    !isInsideSantaRosa(from.latitude, from.longitude) ||
    !isInsideSantaRosa(to.latitude, to.longitude)
  )
    return false;
  const dx = to.longitude - from.longitude;
  const dy = to.latitude - from.latitude;
  const cuts = [0, 1];
  for (const ring of rings)
    for (let i = 1; i < ring.length; i++) {
      const [ax, ay] = ring[i - 1];
      const [bx, by] = ring[i];
      const ex = bx - ax,
        ey = by - ay;
      const determinant = dx * ey - dy * ex;
      if (Math.abs(determinant) < 1e-16) continue;
      const qx = ax - from.longitude,
        qy = ay - from.latitude;
      const t = (qx * ey - qy * ex) / determinant;
      const u = (qx * dy - qy * dx) / determinant;
      if (t > 0 && t < 1 && u >= 0 && u <= 1) cuts.push(t);
    }
  cuts.sort((a, b) => a - b);
  return cuts.slice(1).every((cut, i) => {
    const t = (cuts[i] + cut) / 2;
    return isInsideSantaRosa(from.latitude + t * dy, from.longitude + t * dx);
  });
}
