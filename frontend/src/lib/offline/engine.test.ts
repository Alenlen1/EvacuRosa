import { describe, expect, it } from "vitest";
import { OfflineRoutingEngine } from "./engine";
import { RoadGraph } from "../../../../backend/src/algorithms/astar/graph";
import { calculateRoute } from "../../../../backend/src/algorithms/routing";
import type { OfflinePackage } from "../../../../backend/src/algorithms/offline";

const start = { latitude: 14.3, longitude: 121.1 };
const destination = { latitude: 14.301, longitude: 121.1 };
function data(): OfflinePackage {
  return {
    graph: {
      version: "test",
      data: {
        nodes: [
          { id: "A", ...start },
          { id: "B", ...destination },
        ],
        edges: [
          {
            id: "AB",
            fromNodeId: "A",
            toNodeId: "B",
            roadId: "road",
            distanceMeters: 111,
            status: "OPEN",
            osmTags: { highway: "residential", oneway: "yes" },
          },
        ],
      },
    },
    snapshot: {
      formatVersion: 3,
      graphVersion: "test",
      updatedAt: "2026-10-08T00:00:00Z",
      hazardsAvailable: true,
      floodReports: [],
      fireIncidents: [],
      earthquakeImpacts: [],
      statusOverrides: [],
      centers: [
        {
          id: "center",
          name: "Center",
          address: "Santa Rosa",
          barangayId: null,
          ...destination,
          capacity: 100,
          currentOccupancy: 0,
          status: "AVAILABLE",
          updatedAt: "2026-10-08T00:00:00Z",
        },
      ],
    },
  };
}
describe("offline routing", () => {
  it("retains unmapped approach warnings for direct and recommended routes", () => {
    const saved = data();
    saved.graph.data.nodes.push(
      { id: "C", latitude: 14.3015, longitude: 121.1 },
      { id: "D", latitude: 14.3016, longitude: 121.1 },
    );
    saved.graph.data.edges.push({
      id: "CD",
      roadId: "island",
      fromNodeId: "C",
      toNodeId: "D",
      distanceMeters: 11,
      status: "OPEN",
    });
    const target = { latitude: 14.3015, longitude: 121.1001 };
    saved.snapshot.centers[0] = { ...saved.snapshot.centers[0], ...target };
    const engine = new OfflineRoutingEngine(saved);
    for (const point of [target, null]) {
      const result = engine.calculate(start, point, "walking");
      expect(result.result?.warnings).toContainEqual(
        expect.stringContaining("not mapped or verified"),
      );
      expect(result.result?.warnings[0]).toContain("may have changed");
      expect(result.result?.destinationApproach?.to).toEqual(target);
    }
  });
  it("keeps dry portions of a partly flooded edge usable offline", () => {
    const saved = data();
    const fraction = (t: number) => ({
      latitude: start.latitude + (destination.latitude - start.latitude) * t,
      longitude: 121.1,
    });
    saved.snapshot.floodReports = [
      {
        id: "precise",
        roadId: "road",
        affectedEdgeIds: ["AB"],
        edgeRanges: [{ edgeId: "AB", startFraction: 0.4, endFraction: 0.6 }],
        severity: "HIGH",
        roadImpassable: true,
        status: "ACTIVE",
        reportedAt: "2026-10-16T00:00:00Z",
        updatedAt: "2026-10-16T00:00:00Z",
      },
    ];
    const engine = new OfflineRoutingEngine(saved);
    expect(
      engine.calculate(start, fraction(0.4), "walking").result,
    ).toBeTruthy();
    expect(
      engine.calculate(fraction(0.6), destination, "walking").result,
    ).toBeTruthy();
    expect(engine.calculate(start, destination, "walking").failureReason).toBe(
      "HAZARD_BLOCKED",
    );
    expect(engine.calculate(destination, start, "walking").failureReason).toBe(
      "HAZARD_BLOCKED",
    );
  });
  it("respects section blocks without blocking other segments of the same road", () => {
    const saved = data();
    const end = { id: "C", latitude: 14.302, longitude: 121.1 };
    saved.graph.data.nodes.push(end);
    saved.graph.data.edges.push({
      id: "BC",
      fromNodeId: "B",
      toNodeId: "C",
      roadId: "road",
      distanceMeters: 111,
      status: "OPEN",
    });
    saved.snapshot.statusOverrides = [["edge:BC", "BLOCKED"]];
    saved.snapshot.floodReports = [
      {
        id: "section",
        roadId: "road",
        affectedEdgeIds: ["BC"],
        severity: "HIGH",
        roadImpassable: true,
        status: "ACTIVE",
        reportedAt: "2026-10-16T00:00:00Z",
        updatedAt: "2026-10-16T00:00:00Z",
      },
    ];
    const offline = new OfflineRoutingEngine(saved);
    expect(
      offline.calculate(start, destination, "walking").result,
    ).toBeTruthy();
    expect(offline.calculate(destination, end, "walking").failureReason).toBe(
      "HAZARD_BLOCKED",
    );
    expect(offline.calculate(end, destination, "walking").failureReason).toBe(
      "HAZARD_BLOCKED",
    );
  });
  it("uses the same path, distance and risk as the backend engine", () => {
    const saved = data();
    const online = calculateRoute(
      new RoadGraph(saved.graph.data),
      start,
      destination,
      "car",
      saved.snapshot,
    );
    const offline = new OfflineRoutingEngine(saved).calculate(
      start,
      destination,
      "car",
    );
    expect(offline.result).toMatchObject({
      route: online.path,
      distance: online.distanceMeters,
      riskLevel: online.riskLevel,
      source: "offline",
      updatedAt: saved.snapshot.updatedAt,
    });
    expect(offline.result?.warnings[0]).toContain("may have changed");
    expect(offline.result?.destinationApproach).toBeUndefined();
  });
  it("retains one-way and travel-mode access restrictions", () => {
    const saved = data();
    expect(
      new OfflineRoutingEngine(saved).calculate(destination, start, "car")
        .error,
    ).toBeTruthy();
    expect(
      new OfflineRoutingEngine(saved).calculate(destination, start, "walking")
        .result,
    ).toBeTruthy();
    saved.graph.data.edges[0].osmTags = {
      highway: "residential",
      foot: "yes",
      vehicle: "no",
    };
    expect(
      new OfflineRoutingEngine(saved).calculate(start, destination, "car")
        .error,
    ).toBeTruthy();
    expect(
      new OfflineRoutingEngine(saved).calculate(start, destination, "walking")
        .result,
    ).toBeTruthy();
  });
  it("never bypasses cached hazard closures", () => {
    const saved = data();
    saved.snapshot.statusOverrides = [["road", "BLOCKED"]];
    expect(
      new OfflineRoutingEngine(saved).calculate(start, destination, "walking"),
    ).toMatchObject({ failureReason: "HAZARD_BLOCKED" });
    expect(
      new OfflineRoutingEngine(saved).calculate(start, null, "walking"),
    ).toMatchObject({ failureReason: "HAZARD_BLOCKED" });
  });
  it("excludes full/closed centers and marks missing hazard data as unknown", () => {
    const saved = data();
    saved.snapshot.hazardsAvailable = false;
    const engine = new OfflineRoutingEngine(saved);
    expect(
      engine.calculate(start, destination, "walking").result?.riskLevel,
    ).toBeNull();
    expect(engine.calculate(start, null, "walking").result).toMatchObject({
      recommendedCenter: { id: "center" },
      riskLevel: null,
    });
    saved.snapshot.centers[0].status = "CLOSED";
    expect(
      new OfflineRoutingEngine(saved).calculate(start, null, "walking").error,
    ).toBeTruthy();
    saved.snapshot.centers[0].status = "FULL";
    expect(
      new OfflineRoutingEngine(saved).calculate(start, null, "walking").error,
    ).toBeTruthy();
  });
});
