import { describe, expect, it } from "vitest";
import {
  earthquakeImpactByRoadId,
  earthquakeStatusOverridesForImpacts,
} from "./earthquake.service";
import type { EarthquakeRoadImpact } from "../types/earthquake";

function impact(overrides: Partial<EarthquakeRoadImpact> = {}): EarthquakeRoadImpact {
  return {
    id: "impact-1",
    earthquakeEventId: "event-1",
    roadId: "R1",
    impactLevel: "MODERATE",
    confirmedBlocked: false,
    verifiedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("earthquake impact routing", () => {
  it("blocks only roads explicitly confirmed as blocked", () => {
    const overrides = earthquakeStatusOverridesForImpacts([
      impact({ roadId: "R1", confirmedBlocked: true }),
      impact({ id: "impact-2", roadId: "R2" }),
    ]);
    expect(overrides.get("R1")).toBe("BLOCKED");
    expect(overrides.has("R2")).toBe(false);
  });

  it("keeps the highest verified impact for each road", () => {
    const impacts = earthquakeImpactByRoadId([
      impact({ impactLevel: "LOW" }),
      impact({ id: "impact-2", impactLevel: "HIGH" }),
    ]);
    expect(impacts.get("R1")).toBe(3);
  });
});
