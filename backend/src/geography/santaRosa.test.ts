import { describe, expect, it } from "vitest";
import {
  isInsideSantaRosa,
  isSantaRosaSegment,
  santaRosaBoundary,
} from "./santaRosa";
import { RoadGraph } from "../algorithms/astar/graph";
import { isSantaRosaRoad } from "../services/hazardScope.service";

describe("Santa Rosa hazard boundary", () => {
  it("contains exactly the 18 Santa Rosa barangays", () => {
    const names = santaRosaBoundary.properties.barangays
      .map((b) => b.name.replace(/ \(Pob\.\)/g, ""))
      .sort();
    expect(names).toEqual(
      [
        "Aplaya",
        "Balibago",
        "Caingin",
        "Dila",
        "Dita",
        "Don Jose",
        "Ibaba",
        "Kanluran",
        "Labas",
        "Macabling",
        "Malitlit",
        "Malusak",
        "Market Area",
        "Pooc",
        "Pulong Santa Cruz",
        "Santo Domingo",
        "Sinalhan",
        "Tagapo",
      ].sort(),
    );
    for (const barangay of santaRosaBoundary.properties.barangays) {
      expect(
        isInsideSantaRosa(barangay.latitude, barangay.longitude),
        barangay.name,
      ).toBe(true);
    }
  });
  it("includes the city center and southern city area beyond the old viewport", () => {
    expect(isInsideSantaRosa(14.3146, 121.1137)).toBe(true);
    expect(isInsideSantaRosa(14.24, 121.065)).toBe(true);
  });
  it.each([
    [14.32664, 121.09821], // Romanville
    [14.332, 121.1], // Richfield Phase 2
    [14.331, 121.098], // Richfield residential street block
  ])("includes the corrected Sinalhan subdivision (%s, %s)", (lat, lng) => {
    expect(isInsideSantaRosa(lat, lng)).toBe(true);
  });
  it.each([
    [14.3245, 121.094647], // Garcia Filart, Biñan
    [14.33, 121.092], // Biñan cemetery area
    [14.3335, 121.096], // west of the Richfield creek
  ])("keeps adjacent Biñan locations excluded (%s, %s)", (lat, lng) => {
    expect(isInsideSantaRosa(lat, lng)).toBe(false);
  });
  it.each([
    [14.338, 121.085],
    [14.275, 121.125],
    [14.29, 121.055],
    [0, 0],
    [NaN, 121.1],
    [14.3, Infinity],
  ])("excludes outside or invalid coordinates (%s, %s)", (lat, lng) =>
    expect(isInsideSantaRosa(lat, lng)).toBe(false),
  );
  it("includes boundary vertices but rejects road segments extending outside", () => {
    const [longitude, latitude] =
      santaRosaBoundary.geometry.coordinates[0][0][0];
    expect(isInsideSantaRosa(latitude, longitude)).toBe(true);
    expect(
      isSantaRosaSegment(
        { latitude: 14.3, longitude: 121.1 },
        { latitude: 14.301, longitude: 121.1 },
      ),
    ).toBe(true);
    expect(
      isSantaRosaSegment(
        { latitude: 14.3, longitude: 121.1 },
        { latitude: 14.338, longitude: 121.085 },
      ),
    ).toBe(false);
  });
  it("rejects unknown, outside, and partly outside roadIds", () => {
    const graph = new RoadGraph({
      nodes: [
        { id: "A", latitude: 14.3, longitude: 121.1 },
        { id: "B", latitude: 14.301, longitude: 121.1 },
        { id: "C", latitude: 14.338, longitude: 121.085 },
        { id: "D", latitude: 14.3381, longitude: 121.085 },
      ],
      edges: [
        {
          id: "AB",
          roadId: "inside",
          fromNodeId: "A",
          toNodeId: "B",
          distanceMeters: 111,
          status: "OPEN",
        },
        {
          id: "CD",
          roadId: "outside",
          fromNodeId: "C",
          toNodeId: "D",
          distanceMeters: 11,
          status: "OPEN",
        },
        {
          id: "BC",
          roadId: "crossing",
          fromNodeId: "B",
          toNodeId: "C",
          distanceMeters: 4000,
          status: "OPEN",
        },
      ],
    });
    expect(isSantaRosaRoad(graph, "inside")).toBe(true);
    for (const id of ["outside", "crossing", "missing"])
      expect(isSantaRosaRoad(graph, id)).toBe(false);
    expect(
      graph
        .nearestRoads(14.3, 121.1, 3, (id) => isSantaRosaRoad(graph, id))
        .map((road) => road.roadId),
    ).toEqual(["inside"]);
  });
});
