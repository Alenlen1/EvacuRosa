export type FloodLevel = "NONE" | "LOW" | "MODERATE" | "HIGH" | "SEVERE";
export type FireLevel = "NONE" | "LOW" | "MODERATE" | "HIGH" | "SEVERE";
export type ConditionLevel = "GOOD" | "FAIR" | "POOR";
export type DistanceLevel = "NEAR" | "MEDIUM" | "FAR";
export type ExposureLevel = "LOW" | "MEDIUM" | "HIGH";
export type EarthquakeLevel = "NONE" | "LOW" | "MODERATE" | "HIGH";
export type RiskLevel = "VERY_LOW" | "LOW" | "MODERATE" | "HIGH" | "VERY_HIGH";

/** Raw, crisp measurements before fuzzification. */
export interface FuzzyRiskInput {
  floodWaterLevelMeters: number;
  fireSeverityLevel: number; // 0-4
  roadConditionLevel: number; // 0=GOOD, 1=FAIR, 2=POOR
  distanceMeters: number;
  hazardExposureLevel: number; // 0-2, derived composite
  earthquakeImpactLevel: number; // 0-3
}

export interface FuzzyMemberships {
  flood: Record<FloodLevel, number>;
  fire: Record<FireLevel, number>;
  roadCondition: Record<ConditionLevel, number>;
  distance: Record<DistanceLevel, number>;
  hazardExposure: Record<ExposureLevel, number>;
  earthquake: Record<EarthquakeLevel, number>;
}
