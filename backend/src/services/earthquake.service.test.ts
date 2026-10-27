import { describe, expect, it } from "vitest";
import {
  earthquakeImpactByRoadId,
  earthquakeStatusOverridesForImpacts,
} from "./earthquake.service";
import type { EarthquakeRoadImpact } from "../types/earthquake";

function impact(
  overrides: Partial<EarthquakeRoadImpact> = {},
): EarthquakeRoadImpact {
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
  it("applies standalone road impacts to routing and fuzzy risk without an event", () => {
    const impacts = [
      impact({
        earthquakeEventId: null,
        roadId: "R1",
        confirmedBlocked: true,
        impactLevel: "HIGH",
      }),
      impact({
        id: "impact-2",
        earthquakeEventId: null,
        roadId: "R2",
        confirmedBlocked: false,
        impactLevel: "LOW",
      }),
    ];
    const overrides = earthquakeStatusOverridesForImpacts(impacts);
    expect(overrides.get("R1")).toBe("BLOCKED");
    expect(overrides.has("R2")).toBe(false);
    expect(earthquakeImpactByRoadId(impacts)).toEqual(
      new Map([
        ["R1", 3],
        ["R2", 1],
      ]),
    );
  });
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
