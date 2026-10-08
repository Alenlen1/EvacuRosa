import { describe, expect, it } from "vitest";
import { bearing, compassHeading, headingDelta, matchRoute, meters, plausibleFix, pointAlong, remainingRoute, routeLengths, upcomingBend, usableFix } from "./navigation";

const a = { latitude: 14.3, longitude: 121.1 };
const b = { latitude: 14.301, longitude: 121.1 };
const c = { latitude: 14.301, longitude: 121.101 };
const route = [a, b, c];
describe("walking route progress", () => {
  it("projects onto the actual route and preserves its upcoming corner", () => {
    const lengths = routeLengths(route);
    const match = matchRoute({ latitude: 14.3005, longitude: 121.10003 }, route, lengths);
    expect(match.along).toBeCloseTo(lengths[1] / 2, 1);
    expect(match.distance).toBeLessThan(4);
    const remaining = remainingRoute(route, lengths, match.along);
    expect(remaining.slice(1)).toEqual([b, c]);
    expect(meters(remaining[0], a)).toBeGreaterThan(50);
  });
  it("does not jump to the end when a route loops back near its start", () => {
    const loop = [a, b, c, { latitude: 14.3, longitude: 121.101 }, a];
    const lengths = routeLengths(loop);
    const match = matchRoute({ latitude: 14.3, longitude: 121.10005 }, loop, lengths, 0, 65);
    expect(match.along).toBeLessThan(10);
    expect(lengths.at(-1)! - match.along).toBeGreaterThan(400);
  });
  it("limits a forward leap even when the later road is closer", () => {
    const lengths = routeLengths(route);
    const match = matchRoute(c, route, lengths, 0, 60);
    expect(match.along).toBeLessThanOrEqual(60);
    expect(match.distance).toBeGreaterThan(80);
  });
  it("handles duplicate vertices and completed routes without NaN", () => {
    const points = [a, a, b]; const lengths = routeLengths(points);
    expect(matchRoute(a, points, lengths).distance).toBe(0);
    expect(remainingRoute(points, lengths, lengths.at(-1)!)).toEqual([b]);
    expect(pointAlong(points, lengths, 20).latitude).toBeGreaterThan(a.latitude);
  });
  it("finds an upcoming geometric bend without claiming a street instruction", () => {
    const lengths = routeLengths(route);
    expect(upcomingBend(route, lengths, 70)).not.toBeNull();
    expect(upcomingBend(route, lengths, 0)).toBeNull();
    expect(bearing(a, b)).toBeCloseTo(0);
    expect(bearing(b, c)).toBeCloseTo(90);
  });
});
describe("GPS and compass filtering", () => {
  const fix = { ...a, accuracy: 8, timestamp: 100000 };
  it("rejects stale, missing, inaccurate and future fixes", () => {
    expect(usableFix(fix, 100100)).toBe(true);
    expect(usableFix(fix, 116000)).toBe(false);
    expect(usableFix({ ...fix, accuracy: 80 }, 100100)).toBe(false);
    expect(usableFix({ ...fix, timestamp: 120000 }, 100100)).toBe(false);
    expect(usableFix(null, 100100)).toBe(false);
  });
  it("rejects a large GPS teleport and duplicate timestamps", () => {
    expect(plausibleFix(fix, { ...fix, ...c, timestamp: 101000 }, 4)).toBe(false);
    expect(plausibleFix(fix, fix, 4)).toBe(false);
    expect(plausibleFix(fix, { ...fix, latitude: 14.30002, timestamp: 102000 }, 4)).toBe(true);
  });
  it("uses the short rotation across north", () => {
    expect(headingDelta(359, 1)).toBe(2);
    expect(headingDelta(1, 359)).toBe(-2);
  });
  it("rejects relative/unreliable sensors and accounts for screen orientation", () => {
    expect(compassHeading({ alpha: 90, absolute: false }, 0)).toBeNull();
    expect(compassHeading({ alpha: 90, absolute: true }, 0)).toBe(270);
    expect(compassHeading({ alpha: 90, absolute: true }, 90)).toBe(0);
    expect(compassHeading({ alpha: null, absolute: false, webkitCompassHeading: 45, webkitCompassAccuracy: 10 }, 0)).toBe(45);
    expect(compassHeading({ alpha: null, absolute: false, webkitCompassHeading: 45, webkitCompassAccuracy: -1 }, 0)).toBeNull();
  });
});
