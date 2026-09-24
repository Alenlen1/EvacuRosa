import type { FuzzyMemberships, FuzzyRiskInput } from "./types";

/** Standard triangular membership shape: 0 at and beyond a/c, 1 at b. */
export function triangular(x: number, a: number, b: number, c: number): number {
  if (x <= a || x >= c) return 0;
  if (x === b) return 1;
  if (x < b) return (x - a) / (b - a);
  return (c - x) / (c - b);
}

/** Trapezoidal shape: 0 below a and above d, plateau of 1 between b and c. */
export function trapezoidal(x: number, a: number, b: number, c: number, d: number): number {
  if (x <= a || x >= d) return 0;
  if (x >= b && x <= c) return 1;
  if (x < b) return (x - a) / (b - a);
  return (d - x) / (d - c);
}

/**
 * Every boundary below is a real design decision, not an arbitrary guess —
 * each variable's breakpoints overlap its neighbors on purpose, so (e.g.) a
 * 0.28m flood reading gets partial membership in both MODERATE and HIGH
 * rather than snapping hard to one category. That overlap is the actual
 * "fuzzy" part; a step function would just be if/else with extra steps.
 */

// Flood — input is water level in meters where a report has one, otherwise
// a conservative severity-based estimate (see fuzzyEngine.ts). Never a
// fabricated precise reading.
function fuzzifyFlood(waterLevelMeters: number): FuzzyMemberships["flood"] {
  return {
    NONE: trapezoidal(waterLevelMeters, -0.01, 0, 0, 0.05),
    LOW: triangular(waterLevelMeters, 0, 0.1, 0.2),
    MODERATE: triangular(waterLevelMeters, 0.15, 0.3, 0.45),
    HIGH: triangular(waterLevelMeters, 0.35, 0.5, 0.7),
    SEVERE: trapezoidal(waterLevelMeters, 0.6, 0.8, 10, 10),
  };
}

// Fire — no continuous measurement exists (unlike flood's water level), so
// severity is mapped directly to a 0-4 ordinal scale with overlapping
// triangles between adjacent categories.
function fuzzifyFire(severityLevel: number): FuzzyMemberships["fire"] {
  return {
    NONE: trapezoidal(severityLevel, -0.5, 0, 0, 0.5),
    LOW: triangular(severityLevel, 0, 1, 2),
    MODERATE: triangular(severityLevel, 1, 2, 3),
    HIGH: triangular(severityLevel, 2, 3, 4),
    SEVERE: trapezoidal(severityLevel, 3, 4, 4.5, 4.5),
  };
}

function fuzzifyRoadCondition(conditionLevel: number): FuzzyMemberships["roadCondition"] {
  return {
    GOOD: triangular(conditionLevel, -0.5, 0, 1),
    FAIR: triangular(conditionLevel, 0, 1, 2),
    POOR: triangular(conditionLevel, 1, 2, 2.5),
  };
}

function fuzzifyDistance(distanceMeters: number): FuzzyMemberships["distance"] {
  return {
    NEAR: trapezoidal(distanceMeters, -1, 0, 300, 800),
    MEDIUM: triangular(distanceMeters, 500, 1500, 2500),
    FAR: trapezoidal(distanceMeters, 2000, 3000, 1_000_000, 1_000_000),
  };
}

// Composite exposure (0-2) derived from the worse of flood/fire severity —
// not an independently reported field. See fuzzyEngine.ts for how it's
// computed; documented there since that's a modeling choice, not a shape.
function fuzzifyHazardExposure(exposureLevel: number): FuzzyMemberships["hazardExposure"] {
  return {
    LOW: triangular(exposureLevel, -0.5, 0, 1),
    MEDIUM: triangular(exposureLevel, 0, 1, 2),
    HIGH: triangular(exposureLevel, 1, 2, 2.5),
  };
}

function fuzzifyEarthquake(impactLevel: number): FuzzyMemberships["earthquake"] {
  return {
    NONE: trapezoidal(impactLevel, -0.5, 0, 0, 0.5),
    LOW: triangular(impactLevel, 0, 1, 2),
    MODERATE: triangular(impactLevel, 1, 2, 3),
    HIGH: trapezoidal(impactLevel, 2, 3, 3.5, 3.5),
  };
}

export function fuzzify(input: FuzzyRiskInput): FuzzyMemberships {
  return {
    flood: fuzzifyFlood(input.floodWaterLevelMeters),
    fire: fuzzifyFire(input.fireSeverityLevel),
    roadCondition: fuzzifyRoadCondition(input.roadConditionLevel),
    distance: fuzzifyDistance(input.distanceMeters),
    hazardExposure: fuzzifyHazardExposure(input.hazardExposureLevel),
    earthquake: fuzzifyEarthquake(input.earthquakeImpactLevel),
  };
}
