import { describe, expect, it } from "vitest";
import { loadRoadGraph } from "./road.service";
import { findPath } from "../algorithms/astar/astar";
import { TRAVEL_MODES } from "../algorithms/astar/access";

describe("Santa Rosa road snapshot", () => {
  it("keeps the reported market lane walking-only in both directions without blocking Rizal Boulevard", () => {
    const graph = loadRoadGraph();
    const lane = graph.edgesByRoadId("W319098748");
    expect(lane.length).toBeGreaterThan(0);
    for (const edge of lane) {
      const forward = graph.neighbors(edge.fromNodeId).find(candidate => candidate.id === edge.id)!;
      const reverse = graph.neighbors(edge.toNodeId).find(candidate => candidate.id === `${edge.id}-r`)!;
      expect(forward.allowedModes).toEqual(["walking"]);
      expect(reverse.allowedModes).toEqual(["walking"]);
    }
    const start = lane[0].fromNodeId;
    const goal = lane[lane.length - 1].toNodeId;
    expect(findPath(graph, start, goal, { travelMode: "walking" }).edges.some(edge => edge.roadId === "W319098748")).toBe(true);
    for (const travelMode of ["biking", "motorcycle", "car"] as const) {
      const route = findPath(graph, start, goal, { travelMode });
      expect(route.found).toBe(true);
      expect(route.edges.some(edge => edge.roadId === "W319098748")).toBe(false);
    }
    const boulevard = graph.edgesByRoadId("W1081554465")[0];
    expect(graph.neighbors(boulevard.fromNodeId).find(edge => edge.id === boulevard.id)?.allowedModes).toContain("car");
  });
  it("loads access metadata and finds local routes without forbidden edges", () => {
    const graph = loadRoadGraph();
    for (const travelMode of TRAVEL_MODES) {
      const start = graph.nearestAccessibleNode(14.31896, 121.11207, travelMode);
      const goal = graph.nearestAccessibleNode(14.313, 121.111, travelMode);
      expect(start).not.toBeNull();
      expect(goal).not.toBeNull();
      const route = findPath(graph, start!.id, goal!.id, { travelMode });
      expect(route.found).toBe(true);
      expect(route.edges.length).toBeGreaterThan(0);
      for (const edge of route.edges) expect(edge.allowedModes).toContain(travelMode);
    }
  });
});
