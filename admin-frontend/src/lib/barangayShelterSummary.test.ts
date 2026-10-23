import { describe, expect, it } from "vitest";
import type { EvacuationCenter } from "@/services/api";
import { getBarangayShelterSummary } from "./barangayShelterSummary";

type Shelter = Pick<EvacuationCenter, "barangayId" | "status">;
const shelter = (
  status: Shelter["status"],
  barangayId: Shelter["barangayId"] = "barangay-a",
): Shelter => ({ barangayId, status });

describe("barangay shelter summary", () => {
  it("distinguishes no registered shelters from unavailable shelters", () => {
    expect(getBarangayShelterSummary("barangay-a", [])).toEqual({
      status: "NONE",
      label: "No shelters registered",
      detail: "No shelter listed for this barangay.",
    });
  });

  it.each([
    ["AVAILABLE", "Available", "1 shelter accepting evacuees."],
    ["NEARLY_FULL", "Nearly full", "1 shelter accepting evacuees."],
    ["FULL", "No available shelters", "1 shelter full."],
    ["CLOSED", "Shelters closed", "1 shelter closed."],
  ] as const)("describes one %s shelter", (status, label, detail) => {
    expect(getBarangayShelterSummary("barangay-a", [shelter(status)])).toEqual({
      status,
      label,
      detail,
    });
  });

  it("counts nearly full shelters as accepting and excludes closed/full shelters", () => {
    expect(
      getBarangayShelterSummary("barangay-a", [
        shelter("AVAILABLE"),
        shelter("NEARLY_FULL"),
        shelter("CLOSED"),
        shelter("FULL"),
      ]),
    ).toEqual({
      status: "AVAILABLE",
      label: "Available",
      detail: "2 of 4 shelters accepting evacuees.",
    });
  });

  it("shows nearly full when that is the only accepting status", () => {
    expect(
      getBarangayShelterSummary("barangay-a", [
        shelter("FULL"),
        shelter("CLOSED"),
        shelter("NEARLY_FULL"),
      ]),
    ).toEqual({
      status: "NEARLY_FULL",
      label: "Nearly full",
      detail: "1 of 3 shelters accepting evacuees.",
    });
  });

  it("reports full and closed counts separately when no shelter is accepting", () => {
    expect(
      getBarangayShelterSummary("barangay-a", [
        shelter("FULL"),
        shelter("CLOSED"),
        shelter("CLOSED"),
      ]),
    ).toEqual({
      status: "FULL",
      label: "No available shelters",
      detail: "1 shelter full; 2 closed.",
    });
  });

  it.each([
    ["AVAILABLE", "2 of 2 shelters accepting evacuees."],
    ["FULL", "2 shelters full."],
    ["CLOSED", "2 shelters closed."],
  ] as const)("uses plural grammar for multiple %s shelters", (status, detail) => {
    expect(
      getBarangayShelterSummary("barangay-a", [shelter(status), shelter(status)]),
    ).toMatchObject({ status, detail });
  });

  it("only counts exact assigned barangay IDs, excluding unassigned records", () => {
    expect(
      getBarangayShelterSummary("barangay-a", [
        shelter("AVAILABLE", "barangay-b"),
        shelter("AVAILABLE", "barangay-A"),
        shelter("AVAILABLE", null),
        shelter("CLOSED"),
      ]),
    ).toEqual({
      status: "CLOSED",
      label: "Shelters closed",
      detail: "1 shelter closed.",
    });
    expect(
      getBarangayShelterSummary("barangay-c", [shelter("AVAILABLE")]).status,
    ).toBe("NONE");
  });
});
