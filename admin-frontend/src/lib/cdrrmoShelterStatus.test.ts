import { describe, expect, it } from "vitest";
import { getCdrrmoShelterStatusCounts } from "./cdrrmoShelterStatus";

describe("CDRRMO shelter status counts", () => {
  it("counts saved statuses in separate, non-overlapping categories", () => {
    expect(
      getCdrrmoShelterStatusCounts([
        { status: "AVAILABLE" },
        { status: "NEARLY_FULL" },
        { status: "AVAILABLE" },
        { status: "FULL" },
        { status: "CLOSED" },
        { status: "CLOSED" },
      ]),
    ).toEqual({ AVAILABLE: 2, NEARLY_FULL: 1, FULL: 1, CLOSED: 2 });
  });

  it("returns known zero counts for an empty center list", () => {
    expect(getCdrrmoShelterStatusCounts([])).toEqual({
      AVAILABLE: 0,
      NEARLY_FULL: 0,
      FULL: 0,
      CLOSED: 0,
    });
  });

  it("does not assign unknown statuses to a known category", () => {
    expect(
      getCdrrmoShelterStatusCounts([
        { status: "UNKNOWN" },
        { status: "NEARLY FULL" },
        { status: "available" },
        { status: "toString" },
        { status: "FULL" },
      ]),
    ).toEqual({ AVAILABLE: 0, NEARLY_FULL: 0, FULL: 1, CLOSED: 0 });
  });
});
