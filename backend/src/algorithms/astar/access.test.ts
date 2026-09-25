import { describe, expect, it } from "vitest";
import { permittedModes, TRAVEL_MODES } from "./access";
import { RoadGraph } from "./graph";
import { findPath } from "./astar";

const road = { highway: "residential" };
describe("OSM access and direction rules", () => {
  it("allows ordinary public roads for all modes", () => {
    expect(permittedModes(road, false)).toEqual([...TRAVEL_MODES]);
    expect(permittedModes(road, true)).toEqual([...TRAVEL_MODES]);
  });
  it.each(["yes", "1", "true"])("enforces oneway=%s for vehicles, not pedestrians", oneway => {
    expect(permittedModes({ ...road, oneway }, true)).toEqual(["walking"]);
    expect(permittedModes({ ...road, oneway }, false)).toEqual([...TRAVEL_MODES]);
  });
  it("supports reversed ways and bicycle exceptions", () => {
    expect(permittedModes({ ...road, oneway: "-1" }, false)).toEqual(["walking"]);
    expect(permittedModes({ ...road, oneway: "-1" }, true)).toEqual([...TRAVEL_MODES]);
    expect(permittedModes({ ...road, oneway: "yes", "oneway:bicycle": "no" }, true)).toEqual(["walking", "biking"]);
    expect(permittedModes({ ...road, "oneway:foot": "yes" }, true)).not.toContain("walking");
  });
  it("infers roundabouts and respects explicit two-way overrides", () => {
    expect(permittedModes({ ...road, junction: "roundabout" }, true)).toEqual(["walking"]);
    expect(permittedModes({ ...road, junction: "roundabout", oneway: "no" }, true)).toEqual([...TRAVEL_MODES]);
  });
  it("honors the access hierarchy and directional access", () => {
    expect(permittedModes({ ...road, access: "private", foot: "yes" }, false)).toEqual(["walking"]);
    expect(permittedModes({ ...road, vehicle: "no", motorcycle: "yes" }, false)).toEqual(["walking", "motorcycle"]);
    expect(permittedModes({ ...road, motor_vehicle: "no" }, false)).toEqual(["walking", "biking"]);
    expect(permittedModes({ ...road, "bicycle:forward": "no" }, false)).not.toContain("biking");
    expect(permittedModes({ ...road, "bicycle:forward": "no" }, true)).toContain("biking");
  });
  it("excludes unresolved restricted access and conditional directions", () => {
    for (const access of ["private", "no", "destination", "customers"]) {
      expect(permittedModes({ ...road, access }, false)).toEqual([]);
    }
    expect(permittedModes({ ...road, "access:conditional": "no @ (Mo-Fr)" }, false)).toEqual([]);
    expect(permittedModes({ ...road, oneway: "reversible" }, false)).toEqual(["walking"]);
  });
  it("keeps motor vehicles off paths and pedestrians off motorways by default", () => {
    expect(permittedModes({ highway: "footway" }, false)).toEqual(["walking"]);
    expect(permittedModes({ highway: "steps" }, false)).toEqual(["walking"]);
    expect(permittedModes({ highway: "motorway" }, false)).not.toContain("walking");
    expect(permittedModes({ highway: "motorway" }, false)).not.toContain("biking");
  });
});

function graph(tags: Record<string, string>, detour = false) {
  return new RoadGraph({
    nodes: [
      { id: "A", latitude: 14.3, longitude: 121.1 },
      { id: "B", latitude: 14.3001, longitude: 121.1 },
      { id: "C", latitude: 14.3001, longitude: 121.1001 },
    ],
    edges: [
      { id: "AB", fromNodeId: "A", toNodeId: "B", roadId: "R1", distanceMeters: 12, status: "OPEN", osmTags: tags },
      ...(detour ? [
        { id: "BC", fromNodeId: "B", toNodeId: "C", roadId: "R2", distanceMeters: 12, status: "OPEN" as const, osmTags: road },
        { id: "CA", fromNodeId: "C", toNodeId: "A", roadId: "R3", distanceMeters: 17, status: "OPEN" as const, osmTags: road },
      ] : []),
    ],
  });
}
describe("mode-aware A*", () => {
  it("takes a detour instead of driving against traffic", () => {
    const network = graph({ ...road, oneway: "yes" }, true);
    expect(findPath(network, "B", "A", { travelMode: "car" }).nodeIds).toEqual(["B", "C", "A"]);
    expect(findPath(network, "B", "A", { travelMode: "walking" }).nodeIds).toEqual(["B", "A"]);
  });
  it("returns no route instead of violating access or direction", () => {
    expect(findPath(graph({ ...road, oneway: "yes" }), "B", "A", { travelMode: "car" }).found).toBe(false);
    expect(findPath(graph({ highway: "footway" }), "A", "B", { travelMode: "motorcycle" }).found).toBe(false);
  });
  it("keeps hazard blocking stronger than every mode permission", () => {
    for (const travelMode of TRAVEL_MODES) {
      expect(findPath(graph(road), "A", "B", { travelMode, statusOverrides: new Map([["R1", "BLOCKED"]]) }).found).toBe(false);
    }
  });
  it("snaps goals to incoming edges and rejects far or inaccessible points", () => {
    const network = graph({ ...road, oneway: "yes" });
    expect(network.nearestAccessibleNode(14.3001, 121.1, "car")?.id).toBe("B");
    expect(network.nearestAccessibleNode(0, 0, "car")).toBeNull();
    expect(graph({ highway: "footway" }).nearestAccessibleNode(14.3, 121.1, "car")).toBeNull();
  });
});
