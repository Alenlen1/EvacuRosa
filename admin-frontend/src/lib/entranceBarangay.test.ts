import { describe, expect, it } from "vitest";
import { entranceBarangay } from "./entranceBarangay";

const barangays = [
  { id: "aplaya", name: "Aplaya" },
  { id: "sinalhan", name: "Sinalhan" },
  { id: "market", name: "Market Area (Poblacion)" },
];
const aplaya = ["14.321186738188034", "121.11866693614958"] as const;
const sinalhan = ["14.330227", "121.110327"] as const;

describe("barangay-first entrance validation", () => {
  it("requires an explicitly selected barangay even for valid coordinates", () => {
    const result = entranceBarangay(...aplaya, barangays, "");
    expect(result.barangay).toBeNull();
    expect(result.valid).toBe(false);
    expect(result.message).toContain("Choose an assigned barangay");
  });
  it("accepts entrances only inside the selected barangay", () => {
    expect(entranceBarangay(...aplaya, barangays, "aplaya").valid).toBe(true);
    expect(entranceBarangay(...sinalhan, barangays, "sinalhan").valid).toBe(
      true,
    );
    const result = entranceBarangay(...sinalhan, barangays, "market");
    expect(result.valid).toBe(false);
    expect(result.barangay).toEqual(barangays[2]);
    expect(result.message).toContain("within Market Area (Poblacion)");
  });
  it("invalidates an existing entrance when another barangay is selected", () => {
    expect(entranceBarangay(...aplaya, barangays, "aplaya").valid).toBe(true);
    expect(entranceBarangay(...aplaya, barangays, "sinalhan").valid).toBe(
      false,
    );
  });
  it.each([
    ["", ""],
    ["14.32", ""],
    [" ", "121.1"],
    ["bad", "121.1"],
    ["0", "0"],
  ])(
    "rejects incomplete or invalid coordinates (%s, %s) without changing assignment",
    (latitude, longitude) => {
      const result = entranceBarangay(latitude, longitude, barangays, "aplaya");
      expect(result.valid).toBe(false);
      expect(result.barangay).toEqual(barangays[0]);
    },
  );
  it("does not substitute another barangay when the selected record is missing", () => {
    const result = entranceBarangay(...aplaya, [barangays[1]], "aplaya");
    expect(result.barangay).toBeNull();
    expect(result.valid).toBe(false);
  });
  it("blocks registration when the selected boundary is unavailable", () => {
    const result = entranceBarangay(
      ...aplaya,
      [{ id: "unknown", name: "Unknown barangay" }],
      "unknown",
    );
    expect(result.valid).toBe(false);
    expect(result.message).toContain("boundary is unavailable");
  });
});
