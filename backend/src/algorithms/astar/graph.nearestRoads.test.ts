import { describe, expect, it } from "vitest";
import { RoadGraph } from "./graph";

function makeGraph() {
  // Two parallel-ish roads a known distance apart, so we can assert which
  // one wins for a given click point.
  return new RoadGraph({
    nodes: [
      { id: "A", latitude: 14.3, longitude: 121.1 },
      { id: "B", latitude: 14.3, longitude: 121.11 },
      { id: "C", latitude: 14.31, longitude: 121.1 },
      { id: "D", latitude: 14.31, longitude: 121.11 },
    ],
    edges: [
      {
        id: "E1",
        fromNodeId: "A",
        toNodeId: "B",
        roadId: "ROAD_SOUTH",
        roadName: "South Road",
        distanceMeters: 1000,
        status: "OPEN",
      },
      {
        id: "E2",
        fromNodeId: "C",
        toNodeId: "D",
        roadId: "ROAD_NORTH",
        roadName: "North Road",
        distanceMeters: 1000,
        status: "OPEN",
      },
    ],
  });
}

describe("RoadGraph.nearestRoads", () => {
  it("returns the closer road first when clicking near it", () => {
    // Much closer to the south road (lat 14.3) than the north one (14.31).
    const results = makeGraph().nearestRoads(14.3005, 121.105, 5);
    expect(results[0].roadId).toBe("ROAD_SOUTH");
    expect(results[0].roadName).toBe("South Road");
  });

  it("includes distance for every returned road, closest first", () => {
    const results = makeGraph().nearestRoads(14.3005, 121.105, 5);
    expect(results.length).toBe(2);
    expect(results[0].distanceMeters).toBeLessThanOrEqual(results[1].distanceMeters);
  });

  it("respects the limit parameter", () => {
    const results = makeGraph().nearestRoads(14.3005, 121.105, 1);
    expect(results.length).toBe(1);
  });

  it("finds the true closest point along a segment, not just its endpoints", () => {
    // A single long road; click near its midpoint, far from either endpoint.
    const graph = new RoadGraph({
      nodes: [
        { id: "A", latitude: 14.3, longitude: 121.1 },
        { id: "B", latitude: 14.32, longitude: 121.1 },
      ],
      edges: [
        {
          id: "E1",
          fromNodeId: "A",
          toNodeId: "B",
          roadId: "LONG_ROAD",
          distanceMeters: 2200,
          status: "OPEN",
        },
      ],
    });
    // Click right at the midpoint, offset slightly east.
    const results = graph.nearestRoads(14.31, 121.1005, 1);
    // Distance should be close to the small eastward offset (~50m), not
    // the much larger distance to either endpoint (~1.1km).
    expect(results[0].distanceMeters).toBeLessThan(200);
  });
});
