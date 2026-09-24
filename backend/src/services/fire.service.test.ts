import { describe, expect, it } from "vitest";
import { fireStatusOverridesForIncidents } from "./fire.service";
import type { FireIncident } from "../types/fire";

function incident(overrides: Partial<FireIncident> = {}): FireIncident {
  return {
    id: "fire-1",
    latitude: 14.3,
    longitude: 121.1,
    severity: "HIGH",
    radiusMeters: 200,
    status: "ACTIVE",
    confirmedBlockedRoadIds: [],
    reportedAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("fireStatusOverridesForIncidents", () => {
  it("blocks only explicitly confirmed roads", () => {
    const overrides = fireStatusOverridesForIncidents([
      incident({ confirmedBlockedRoadIds: ["R1", "R2"] }),
    ]);
    expect(overrides.get("R1")).toBe("BLOCKED");
    expect(overrides.get("R2")).toBe("BLOCKED");
  });

  it("does not block roads based on proximity alone", () => {
    expect(fireStatusOverridesForIncidents([incident()]).size).toBe(0);
  });
});
