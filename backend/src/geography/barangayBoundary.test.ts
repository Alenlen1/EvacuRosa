import { describe, expect, it } from "vitest";
import boundaries from "../data/santaRosaBarangays.json";
import city from "../data/santaRosaBoundary.json";
import { SANTA_ROSA_BARANGAYS } from "./barangays";
import {
  barangayForEntrance,
  getBarangayBoundary,
  validateEntranceBarangay,
} from "./barangayBoundary";

describe("entrance barangay boundaries", () => {
  it("covers exactly the configured 18 barangays with closed polygon rings", () => {
    expect(boundaries.features.map((b) => b.properties.name).sort()).toEqual(
      [...SANTA_ROSA_BARANGAYS].sort(),
    );
    for (const { geometry } of boundaries.features) {
      expect(geometry.type).toBe("Polygon");
      for (const ring of geometry.coordinates) {
        expect(ring.length).toBeGreaterThan(3);
        expect(ring[0]).toEqual(ring.at(-1));
      }
    }
  });

  it.each(city.properties.barangays)(
    "resolves the representative entrance in $name",
    ({ name, latitude, longitude }) => {
      expect(barangayForEntrance(latitude, longitude)).toBe(
        name === "Market Area" ? "Market Area (Poblacion)" : name,
      );
      const selected =
        name === "Market Area" ? "Market Area (Poblacion)" : name;
      expect(getBarangayBoundary(selected)?.properties.name).toBe(selected);
      expect(() =>
        validateEntranceBarangay(latitude, longitude, selected),
      ).not.toThrow();
      for (const other of SANTA_ROSA_BARANGAYS.filter(
        (entry) => entry !== selected,
      ))
        expect(() =>
          validateEntranceBarangay(latitude, longitude, other),
        ).toThrow(`within ${other}`);
    },
  );

  it("assigns the entrance in the reported example to Aplaya", () => {
    expect(barangayForEntrance(14.321186738188034, 121.11866693614958)).toBe(
      "Aplaya",
    );
  });

  it("does not substitute a nearest area when a boundary is unavailable", () => {
    expect(getBarangayBoundary("Unknown barangay")).toBeNull();
    expect(() =>
      validateEntranceBarangay(14.330227, 121.110327, "Unknown barangay"),
    ).toThrow("boundary is unavailable");
  });

  it.each([
    [0, 0],
    [14.33, 121.092],
    [NaN, 121.1],
    [14.3, Infinity],
  ])(
    "rejects outside or invalid coordinates (%s, %s)",
    (latitude, longitude) => {
      expect(() => barangayForEntrance(latitude, longitude)).toThrow();
    },
  );

  it("does not guess the barangay at a shared boundary vertex", () => {
    const aplaya = boundaries.features.find(
      (b) => b.properties.name === "Aplaya",
    )!;
    const others = new Set(
      boundaries.features
        .filter((b) => b !== aplaya)
        .flatMap((b) =>
          b.geometry.coordinates.flat().map((p) => JSON.stringify(p)),
        ),
    );
    const point = aplaya.geometry.coordinates
      .flat()
      .find((p) => others.has(JSON.stringify(p)));
    expect(point).toBeDefined();
    expect(() => barangayForEntrance(point![1], point![0])).toThrow(
      "shared barangay boundary",
    );
    expect(() =>
      validateEntranceBarangay(point![1], point![0], "Aplaya"),
    ).toThrow("shared barangay boundary");
  });
});
