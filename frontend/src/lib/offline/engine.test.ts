import { describe, expect, it } from "vitest";
import { OfflineRoutingEngine } from "./engine";
import { RoadGraph } from "../../../../backend/src/algorithms/astar/graph";
import { calculateRoute } from "../../../../backend/src/algorithms/routing";
import type { OfflinePackage } from "../../../../backend/src/algorithms/offline";

const start = { latitude: 14.3, longitude: 121.1 };
const destination = { latitude: 14.301, longitude: 121.1 };
function data(): OfflinePackage {
  return {
    graph: { version: "test", data: {
      nodes: [{ id: "A", ...start }, { id: "B", ...destination }],
      edges: [{ id: "AB", fromNodeId: "A", toNodeId: "B", roadId: "road",
        distanceMeters: 111, status: "OPEN", osmTags: { highway: "residential", oneway: "yes" } }],
    } },
    snapshot: { formatVersion: 1, graphVersion: "test", updatedAt: "2026-10-08T00:00:00Z",
      hazardsAvailable: true, floodReports: [], fireIncidents: [], earthquakeImpacts: [], statusOverrides: [],
      centers: [{ id: "center", name: "Center", address: "Santa Rosa", barangayId: null,
        ...destination, capacity: 100, currentOccupancy: 0, status: "AVAILABLE", updatedAt: "2026-10-08T00:00:00Z" }],
    },
  };
}
describe("offline routing", () => {
  it("uses the same path, distance and risk as the backend engine", () => {
    const saved = data();
    const online = calculateRoute(new RoadGraph(saved.graph.data), start, destination, "car", saved.snapshot);
    const offline = new OfflineRoutingEngine(saved).calculate(start, destination, "car");
    expect(offline.result).toMatchObject({ route: online.path, distance: online.distanceMeters,
      riskLevel: online.riskLevel, source: "offline", updatedAt: saved.snapshot.updatedAt });
    expect(offline.result?.warnings[0]).toContain("may have changed");
  });
  it("retains one-way and travel-mode access restrictions", () => {
    const saved = data();
    expect(new OfflineRoutingEngine(saved).calculate(destination, start, "car").error).toBeTruthy();
    expect(new OfflineRoutingEngine(saved).calculate(destination, start, "walking").result).toBeTruthy();
    saved.graph.data.edges[0].osmTags = { highway: "residential", foot: "yes", vehicle: "no" };
    expect(new OfflineRoutingEngine(saved).calculate(start, destination, "car").error).toBeTruthy();
    expect(new OfflineRoutingEngine(saved).calculate(start, destination, "walking").result).toBeTruthy();
  });
  it("never bypasses cached hazard closures", () => {
    const saved = data();
    saved.snapshot.statusOverrides = [["road", "BLOCKED"]];
    expect(new OfflineRoutingEngine(saved).calculate(start, destination, "walking"))
      .toMatchObject({ failureReason: "HAZARD_BLOCKED" });
    expect(new OfflineRoutingEngine(saved).calculate(start, null, "walking"))
      .toMatchObject({ failureReason: "HAZARD_BLOCKED" });
  });
  it("excludes full/closed centers and marks missing hazard data as unknown", () => {
    const saved = data();
    saved.snapshot.hazardsAvailable = false;
    const engine = new OfflineRoutingEngine(saved);
    expect(engine.calculate(start, destination, "walking").result?.riskLevel).toBeNull();
    expect(engine.calculate(start, null, "walking").result).toMatchObject({ recommendedCenter: { id: "center" }, riskLevel: null });
    saved.snapshot.centers[0].status = "CLOSED";
    expect(new OfflineRoutingEngine(saved).calculate(start, null, "walking").error).toBeTruthy();
    saved.snapshot.centers[0].status = "FULL";
    expect(new OfflineRoutingEngine(saved).calculate(start, null, "walking").error).toBeTruthy();
  });
});
