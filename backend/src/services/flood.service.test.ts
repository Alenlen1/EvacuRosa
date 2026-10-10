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
  it.each(["LOW", "MODERATE"] as const)(
    "keeps %s routable even with an outdated impassable flag",
    (severity) => {
      expect(
        roadStatusOverridesForReports([
          report({ severity, roadImpassable: true }),
        ]).get("R1"),
      ).toBe("FLOODED");
    },
  );

  it.each(["HIGH", "SEVERE"] as const)(
    "blocks %s even without the old checkbox",
    (severity) => {
      expect(
        roadStatusOverridesForReports([
          report({ severity, roadImpassable: false }),
        ]).get("R1"),
      ).toBe("BLOCKED");
    },
  );

  it("does not restrict NONE or reports without a road", () => {
    expect(
      roadStatusOverridesForReports([
        report({ severity: "NONE", roadImpassable: true }),
        report({ roadId: "", severity: "SEVERE" }),
      ]).size,
    ).toBe(0);
  });
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
      report({ roadId: "R1", severity: "HIGH", roadImpassable: true }),
      report({ id: "flood-2", roadId: "R1", roadImpassable: false }),
    ]);
    expect(overrides.get("R1")).toBe("BLOCKED");
  });
  it("blocks a road regardless of report order", () => {
    expect(
      roadStatusOverridesForReports([
        report({ severity: "LOW" }),
        report({ severity: "SEVERE" }),
      ]).get("R1"),
    ).toBe("BLOCKED");
  });
});
