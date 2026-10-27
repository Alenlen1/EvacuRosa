import { describe, expect, it } from "vitest";
import type { ManagedCenter } from "@/components/admin/CenterManager";
import {
  getBarangayWorkspaceSummary,
  isAcceptingCenter,
} from "./barangayWorkspaceSummary";

type SummaryCenter = Pick<
  ManagedCenter,
  "capacity" | "current_occupancy" | "status"
>;

const center = (overrides: Partial<SummaryCenter> = {}): SummaryCenter => ({
  capacity: 100,
  current_occupancy: 40,
  status: "AVAILABLE",
  ...overrides,
});

describe("barangay workspace summary", () => {
  it("counts nearly full centers with remaining spaces as accepting evacuees", () => {
    const centers = [
      center({ capacity: 500, current_occupancy: 200 }),
      center({ capacity: 500, current_occupancy: 103 }),
      center({ capacity: 500, current_occupancy: 400, status: "NEARLY_FULL" }),
      center({ capacity: 500, current_occupancy: 400, status: "NEARLY_FULL" }),
    ];
    expect(centers.filter(isAcceptingCenter)).toHaveLength(4);
    expect(getBarangayWorkspaceSummary(centers)).toEqual({
      centerCount: 4,
      occupancy: 1103,
      remainingSpaces: 897,
    });
  });

  it("does not count full, closed, zero-capacity or occupied-to-capacity centers as accepting", () => {
    expect(
      [
        center({ status: "FULL", current_occupancy: 100 }),
        center({ status: "CLOSED", current_occupancy: 10 }),
        center({ status: "NEARLY_FULL", current_occupancy: 100 }),
        center({ capacity: 0, current_occupancy: 0 }),
      ].filter(isAcceptingCenter),
    ).toHaveLength(0);
  });
  it("shows known zero totals for no assigned centers", () => {
    expect(getBarangayWorkspaceSummary([])).toEqual({
      centerCount: 0,
      occupancy: 0,
      remainingSpaces: 0,
    });
  });

  it("includes every center's occupants but only accepting centers' spaces", () => {
    expect(
      getBarangayWorkspaceSummary([
        center(),
        center({ status: "NEARLY_FULL", current_occupancy: 80 }),
        center({ status: "FULL", current_occupancy: 90 }),
        center({ status: "CLOSED", current_occupancy: 10 }),
      ]),
    ).toEqual({ centerCount: 4, occupancy: 220, remainingSpaces: 80 });
  });

  it("retains overcapacity occupants and never subtracts spaces elsewhere", () => {
    expect(
      getBarangayWorkspaceSummary([
        center({ current_occupancy: 120 }),
        center({ capacity: 0, current_occupancy: 0 }),
        center(),
      ]),
    ).toEqual({ centerCount: 3, occupancy: 160, remainingSpaces: 60 });
  });

  it.each([undefined, null, NaN, Infinity, -1, 4.5, "40"])(
    "does not present incomplete totals as known when occupancy is %s",
    (invalid) => {
      const invalidCenter = center({
        current_occupancy: invalid as unknown as number,
      });
      expect(getBarangayWorkspaceSummary([center(), invalidCenter])).toEqual({
        centerCount: 2,
        occupancy: null,
        remainingSpaces: null,
      });
    },
  );

  it.each([undefined, null, NaN, Infinity, -1, 4.5, "100"])(
    "preserves the known occupant total when capacity is %s",
    (invalid) => {
      const invalidCenter = center({
        capacity: invalid as unknown as number,
      });
      expect(getBarangayWorkspaceSummary([center(), invalidCenter])).toEqual({
        centerCount: 2,
        occupancy: 80,
        remainingSpaces: null,
      });
    },
  );

  it("requires valid occupancy even when an accepting center has zero capacity", () => {
    expect(
      getBarangayWorkspaceSummary([
        center({ capacity: 0, current_occupancy: NaN }),
      ]),
    ).toEqual({ centerCount: 1, occupancy: null, remainingSpaces: null });
  });

  it("does not infer available spaces for an unknown or missing status", () => {
    for (const status of ["", "UNKNOWN", undefined, null]) {
      expect(
        getBarangayWorkspaceSummary([
          center(),
          center({ status: status as unknown as string }),
        ]),
      ).toEqual({ centerCount: 2, occupancy: 80, remainingSpaces: null });
    }
  });

  it("does not need capacity values for centers that cannot accept evacuees", () => {
    expect(
      getBarangayWorkspaceSummary([
        center({ status: "FULL", capacity: NaN }),
        center({ status: "CLOSED", capacity: NaN }),
      ]),
    ).toEqual({ centerCount: 2, occupancy: 80, remainingSpaces: 0 });
  });

  it("does not expose imprecise totals when addition exceeds safe integers", () => {
    expect(
      getBarangayWorkspaceSummary([
        center({
          capacity: Number.MAX_SAFE_INTEGER,
          current_occupancy: Number.MAX_SAFE_INTEGER,
        }),
        center(),
      ]),
    ).toEqual({ centerCount: 2, occupancy: null, remainingSpaces: 60 });
    expect(
      getBarangayWorkspaceSummary([
        center({ capacity: Number.MAX_SAFE_INTEGER, current_occupancy: 0 }),
        center(),
      ]).remainingSpaces,
    ).toBeNull();
  });
});
