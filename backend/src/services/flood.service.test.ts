import { describe, expect, it } from "vitest";
import { roadStatusOverridesForReports } from "./flood.service";
import type { FloodReport } from "../types/flood";

function report(overrides: Partial<FloodReport>): FloodReport {
  return {
    id: "flood-1",
    roadId: "R1",
    severity: "MODERATE",
    roadImpassable: false,
    status: "ACTIVE",
    reportedAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("roadStatusOverridesForReports", () => {
  it("marks a confirmed-impassable road as BLOCKED", () => {
    const overrides = roadStatusOverridesForReports([
      report({ roadId: "R-BLOCKED", severity: "SEVERE", roadImpassable: true }),
    ]);
    expect(overrides.get("R-BLOCKED")).toBe("BLOCKED");
  });

  it("marks a passable affected road as FLOODED", () => {
    const overrides = roadStatusOverridesForReports([
      report({ roadId: "R-FLOODED" }),
    ]);
    expect(overrides.get("R-FLOODED")).toBe("FLOODED");
  });

  it("never downgrades a blocked road", () => {
    const overrides = roadStatusOverridesForReports([
      report({ roadId: "R1", roadImpassable: true }),
      report({ id: "flood-2", roadId: "R1", roadImpassable: false }),
    ]);
    expect(overrides.get("R1")).toBe("BLOCKED");
  });
});
