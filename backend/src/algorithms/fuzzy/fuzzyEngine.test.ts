import { describe, expect, it } from "vitest";
import { evaluateRoadRisk } from "./fuzzyEngine";
import type { FuzzyRiskInput } from "./types";

const baseline: FuzzyRiskInput = {
  floodWaterLevelMeters: 0,
  fireSeverityLevel: 0,
  roadConditionLevel: 0, // GOOD
  distanceMeters: 1500, // MEDIUM — isolates flood/condition rules from distance rules
  hazardExposureLevel: 0,
  earthquakeImpactLevel: 0,
};

describe("evaluateRoadRisk", () => {
  it("is VERY_LOW for a clear, good-condition road (spec rule R4)", () => {
    const result = evaluateRoadRisk(baseline);
    expect(result.riskLevel).toBe("VERY_LOW");
  });

  it("is VERY_HIGH for a severe flood regardless of everything else (rule R5)", () => {
    const result = evaluateRoadRisk({ ...baseline, floodWaterLevelMeters: 0.9 });
    expect(result.riskLevel).toBe("VERY_HIGH");
  });

  it("is VERY_HIGH for HIGH flood + POOR road condition (spec rule R1, worked example)", () => {
    const result = evaluateRoadRisk({
      ...baseline,
      floodWaterLevelMeters: 0.5, // peak of the HIGH triangle
      roadConditionLevel: 2, // POOR
    });
    expect(result.riskLevel).toBe("VERY_HIGH");
    expect(result.firedRules.some((r) => r.id === "R1")).toBe(true);
  });

  it("increases monotonically as flood level rises, all else equal", () => {
    const none = evaluateRoadRisk({ ...baseline, floodWaterLevelMeters: 0 });
    const low = evaluateRoadRisk({ ...baseline, floodWaterLevelMeters: 0.1 });
    const moderate = evaluateRoadRisk({ ...baseline, floodWaterLevelMeters: 0.3 });
    const high = evaluateRoadRisk({ ...baseline, floodWaterLevelMeters: 0.5 });
    expect(none.riskScore).toBeLessThan(low.riskScore);
    expect(low.riskScore).toBeLessThanOrEqual(moderate.riskScore);
    expect(moderate.riskScore).toBeLessThanOrEqual(high.riskScore);
  });

  it("reports which rules fired, for an eventual 'why this route' explanation", () => {
    const result = evaluateRoadRisk({ ...baseline, floodWaterLevelMeters: 0.9 });
    expect(result.firedRules.length).toBeGreaterThan(0);
    expect(result.firedRules[0].id).toBe("R5");
  });
});
