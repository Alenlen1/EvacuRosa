import { describe, expect, it } from "vitest";
import { entranceBarangay } from "./entranceBarangay";

const barangays = [
  { id: "aplay", name: "Aplaya" },
  { id: "sinalhan", name: "Sinalhan" },
];
describe("automatic entrance assignment", () => {
  it("assigns Aplaya and recalculates immediately when the entrance moves", () => {
    expect(
      entranceBarangay("14.321186738188034", "121.11866693614958", barangays)
        .barangay,
    ).toEqual(barangays[0]);
    expect(
      entranceBarangay("14.330227", "121.110327", barangays).barangay,
    ).toEqual(barangays[1]);
  });
  it.each([
    ["", ""],
    ["14.32", ""],
    [" ", "121.1"],
    ["bad", "121.1"],
    ["0", "0"],
  ])(
    "clears assignment for missing/invalid/outside coordinates (%s, %s)",
    (latitude, longitude) => {
      expect(
        entranceBarangay(latitude, longitude, barangays).barangay,
      ).toBeNull();
    },
  );
  it("does not use another barangay while the matching record is missing", () => {
    const result = entranceBarangay(
      "14.321186738188034",
      "121.11866693614958",
      [barangays[1]],
    );
    expect(result.barangay).toBeNull();
    expect(result.message).toContain("Aplaya");
  });
});
