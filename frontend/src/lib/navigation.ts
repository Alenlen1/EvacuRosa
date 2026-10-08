import type { LatLng } from "@/services/api";

const R = 6371000;
const rad = Math.PI / 180;
export const normalizeHeading = (angle: number) => ((angle % 360) + 360) % 360;
export const headingDelta = (from: number, to: number) => ((to - from + 540) % 360) - 180;
export function meters(a: LatLng, b: LatLng) {
  const x = (b.longitude - a.longitude) * rad * Math.cos((a.latitude + b.latitude) / 2 * rad);
  return Math.hypot(x, (b.latitude - a.latitude) * rad) * R;
}
export function bearing(a: LatLng, b: LatLng) {
  return normalizeHeading(Math.atan2((b.longitude - a.longitude) * Math.cos(a.latitude * rad), b.latitude - a.latitude) / rad);
}
export function interpolate(a: LatLng, b: LatLng, fraction: number): LatLng {
  return { latitude: a.latitude + (b.latitude - a.latitude) * fraction, longitude: a.longitude + (b.longitude - a.longitude) * fraction };
}
export function routeLengths(route: LatLng[]) {
  const lengths = [0];
  for (let i = 1; i < route.length; i++) lengths.push(lengths[i - 1] + meters(route[i - 1], route[i]));
  return lengths;
}
export function pointAlong(route: LatLng[], lengths: number[], distance: number): LatLng {
  for (let i = 1; i < route.length; i++) {
    if (lengths[i] >= distance && lengths[i] > lengths[i - 1]) return interpolate(route[i - 1], route[i], Math.max(0, (distance - lengths[i - 1]) / (lengths[i] - lengths[i - 1])));
  }
  return route[route.length - 1];
}
/** Restrict progress to nearby route history, so crossings/parallel roads cannot
 * consume a distant part of a loop. Accuracy and time checks live in the hook. */
export function matchRoute(point: LatLng, route: LatLng[], lengths: number[], min = 0, max = Infinity) {
  let best = { distance: Infinity, along: min, segment: 0, point: route[0] };
  for (let i = 1; i < route.length; i++) {
    const length = lengths[i] - lengths[i - 1];
    if (!length || lengths[i] < min || lengths[i - 1] > max) continue;
    const a = route[i - 1], b = route[i];
    const scale = Math.cos(point.latitude * rad);
    const dx = (b.longitude - a.longitude) * scale, dy = b.latitude - a.latitude;
    const fraction = Math.max(0, (min - lengths[i - 1]) / length, Math.min(1, (max - lengths[i - 1]) / length,
      (((point.longitude - a.longitude) * scale * dx + (point.latitude - a.latitude) * dy) / (dx * dx + dy * dy))));
    const projected = interpolate(a, b, fraction);
    const distance = meters(point, projected);
    if (distance < best.distance) best = { distance, along: lengths[i - 1] + fraction * length, segment: i - 1, point: projected };
  }
  return best;
}
export function remainingRoute(route: LatLng[], lengths: number[], along: number) {
  const index = lengths.findIndex(length => length > along);
  return index < 0 ? [route[route.length - 1]] : [pointAlong(route, lengths, along), ...route.slice(index)];
}
/** Shape-derived bends are camera hints, not turn-by-turn road instructions. */
export function upcomingBend(route: LatLng[], lengths: number[], along: number) {
  const total = lengths[lengths.length - 1];
  for (let distance = along + 10; distance < Math.min(total - 8, along + 65); distance += 5) {
    const before = pointAlong(route, lengths, Math.max(0, distance - 10));
    const at = pointAlong(route, lengths, distance);
    const after = pointAlong(route, lengths, distance + 10);
    if (Math.abs(headingDelta(bearing(before, at), bearing(at, after))) > 35) return distance - along;
  }
  return null;
}

export interface NavigationFix extends LatLng { accuracy: number; timestamp: number; heading?: number | null; speed?: number | null }
export function usableFix(fix: NavigationFix | null, now: number) {
  return !!fix && Number.isFinite(fix.latitude) && Number.isFinite(fix.longitude) &&
    Number.isFinite(fix.accuracy) && fix.accuracy >= 0 && fix.accuracy <= 40 &&
    Number.isFinite(fix.timestamp) && now - fix.timestamp >= -1000 && now - fix.timestamp <= 15000;
}
export function plausibleFix(previous: NavigationFix | null, next: NavigationFix, maxSpeed: number) {
  if (!previous) return true;
  const seconds = (next.timestamp - previous.timestamp) / 1000;
  return seconds > 0 && meters(previous, next) <= Math.max(25, seconds * maxSpeed + previous.accuracy + next.accuracy);
}

export function compassHeading(event: { alpha: number | null; absolute: boolean; webkitCompassHeading?: number; webkitCompassAccuracy?: number }, screenAngle: number) {
  if (typeof event.webkitCompassHeading === "number" && Number.isFinite(event.webkitCompassHeading)) {
    if (event.webkitCompassAccuracy !== undefined && (event.webkitCompassAccuracy < 0 || event.webkitCompassAccuracy > 30)) return null;
    return normalizeHeading(event.webkitCompassHeading + screenAngle);
  }
  return event.absolute && event.alpha !== null && Number.isFinite(event.alpha) ? normalizeHeading(360 - event.alpha + screenAngle) : null;
}
