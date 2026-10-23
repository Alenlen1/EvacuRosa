import { describe, expect, it } from "vitest";
import { searchBarangays } from "./barangaySearch";

const barangays = [
  { id: "1", name: "Macabling" },
  { id: "2", name: "Malusak" },
  { id: "3", name: "Market Area (Poblacion)" },
  { id: "4", name: "Pulong Santa Cruz" },
  { id: "5", name: "Sinalhan" },
  { id: "6", name: "Santo Domingo" },
];

describe("barangay search", () => {
  it("keeps the complete directory for an empty search", () => {
    expect(searchBarangays(barangays, "  ")).toEqual(barangays);
  });
  it("returns partial matches in directory order", () => {
    expect(searchBarangays(barangays, "MA").map((item) => item.id)).toEqual([
      "1",
      "2",
      "3",
    ]);
  });
  it.each(["Brgy. Malusak", "barangay malusak", "  Málusak  "])(
    "finds the same barangay for %s",
    (query) => {
      expect(searchBarangays(barangays, query)).toEqual([barangays[1]]);
    },
  );
  it("supports parenthetical names and partial multiword names", () => {
    expect(searchBarangays(barangays, "Poblacion")).toEqual([barangays[2]]);
    expect(searchBarangays(barangays, "Pulong Cruz")).toEqual([barangays[3]]);
    expect(searchBarangays(barangays, "Pulong Sta. Cruz")).toEqual([
      barangays[3],
    ]);
    expect(searchBarangays(barangays, "Sto. Domingo")).toEqual([barangays[5]]);
  });
  it("does not substitute a barangay when the name does not match", () => {
    expect(searchBarangays(barangays, "not a barangay")).toEqual([]);
  });
});
