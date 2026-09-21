import { describe, expect, it } from "vitest";
import { RoadGraph } from "./graph";
import { findPath } from "./astar";

function makeGraph() {
  return new RoadGraph({
    nodes: [
      { id: "A", latitude: 14.3, longitude: 121.1 },
      { id: "B", latitude: 14.31, longitude: 121.1 },
      { id: "C", latitude: 14.31, longitude: 121.11 },
      { id: "D", latitude: 14.3, longitude: 121.11 },
    ],
    edges: [
      { id: "AB", fromNodeId: "A", toNodeId: "B", roadId: "R1", distanceMeters: 1000, status: "OPEN" },
      { id: "BC", fromNodeId: "B", toNodeId: "C", roadId: "R2", distanceMeters: 1000, status: "OPEN" },
      { id: "AD", fromNodeId: "A", toNodeId: "D", roadId: "R3", distanceMeters: 1000, status: "OPEN" },
      { id: "DC", fromNodeId: "D", toNodeId: "C", roadId: "R4", distanceMeters: 3000, status: "OPEN" },
    ],
  });
}

describe("A* pathfinding", () => {
  it("finds a valid path between connected nodes", () => {
    const result = findPath(makeGraph(), "A", "C");
    expect(result.found).toBe(true);
    expect(result.nodeIds[0]).toBe("A");
    expect(result.nodeIds.at(-1)).toBe("C");
  });

  it("picks the shortest of two available paths", () => {
    const result = findPath(makeGraph(), "A", "C");
    expect(result.distanceMeters).toBe(2000);
    expect(result.nodeIds).toEqual(["A", "B", "C"]);
  });

  it("excludes a blocked road even when it is shorter, and reroutes", () => {
    const graph = new RoadGraph({
      nodes: [
        { id: "A", latitude: 14.3, longitude: 121.1 },
        { id: "B", latitude: 14.31, longitude: 121.1 },
        { id: "C", latitude: 14.31, longitude: 121.11 },
      ],
      edges: [
        { id: "AC", fromNodeId: "A", toNodeId: "C", roadId: "R1", distanceMeters: 500, status: "BLOCKED" },
        { id: "AB", fromNodeId: "A", toNodeId: "B", roadId: "R2", distanceMeters: 1000, status: "OPEN" },
        { id: "BC", fromNodeId: "B", toNodeId: "C", roadId: "R3", distanceMeters: 1000, status: "OPEN" },
      ],
    });
    const result = findPath(graph, "A", "C");
    expect(result.found).toBe(true);
    expect(result.nodeIds).toEqual(["A", "B", "C"]);
  });

  it("returns not found for an unreachable destination", () => {
    const graph = new RoadGraph({
      nodes: [
        { id: "A", latitude: 14.3, longitude: 121.1 },
        { id: "Z", latitude: 15.0, longitude: 122.0 },
      ],
      edges: [],
    });
    const result = findPath(graph, "A", "Z");
    expect(result.found).toBe(false);
  });

  it("returns a trivial zero-distance path when start equals goal", () => {
    const result = findPath(makeGraph(), "A", "A");
    expect(result.found).toBe(true);
    expect(result.distanceMeters).toBe(0);
  });
});

describe("A* with status overrides (flood-report-driven)", () => {
  it("treats an overridden BLOCKED road as impassable even though the base edge is OPEN", () => {
    const graph = new RoadGraph({
      nodes: [
        { id: "A", latitude: 14.3, longitude: 121.1 },
        { id: "B", latitude: 14.31, longitude: 121.1 },
        { id: "C", latitude: 14.31, longitude: 121.11 },
      ],
      edges: [
        { id: "AC", fromNodeId: "A", toNodeId: "C", roadId: "R1", distanceMeters: 500, status: "OPEN" },
        { id: "AB", fromNodeId: "A", toNodeId: "B", roadId: "R2", distanceMeters: 1000, status: "OPEN" },
        { id: "BC", fromNodeId: "B", toNodeId: "C", roadId: "R3", distanceMeters: 1000, status: "OPEN" },
      ],
    });
    const overrides = new Map([["R1", "BLOCKED" as const]]);
    const result = findPath(graph, "A", "C", { statusOverrides: overrides });
    expect(result.found).toBe(true);
    expect(result.nodeIds).toEqual(["A", "B", "C"]);
  });

  it("does not exclude a road overridden to FLOODED (only BLOCKED excludes)", () => {
    const graph = new RoadGraph({
      nodes: [
        { id: "A", latitude: 14.3, longitude: 121.1 },
        { id: "C", latitude: 14.31, longitude: 121.11 },
      ],
      edges: [
        { id: "AC", fromNodeId: "A", toNodeId: "C", roadId: "R1", distanceMeters: 500, status: "OPEN" },
      ],
    });
    const overrides = new Map([["R1", "FLOODED" as const]]);
    const result = findPath(graph, "A", "C", { statusOverrides: overrides });
    expect(result.found).toBe(true);
    expect(result.nodeIds).toEqual(["A", "C"]);
  });
});

describe("A* with a custom (risk-weighted) edge cost — the Phase 6 hybrid claim", () => {
  function makeDetourGraph() {
    // Nodes are clustered within a few meters of each other in real terms —
    // deliberately, so the straight-line heuristic stays far below every
    // edge's hand-typed cost (500-1800m) and A*'s admissibility guarantee
    // holds. This test is about cost-function behavior, not geography.
    return new RoadGraph({
      nodes: [
        { id: "A", latitude: 14.3, longitude: 121.1 },
        { id: "B", latitude: 14.30001, longitude: 121.1 },
        { id: "C", latitude: 14.30002, longitude: 121.1 },
        { id: "D", latitude: 14.30001, longitude: 121.10001 },
        { id: "E", latitude: 14.30002, longitude: 121.10001 },
      ],
      edges: [
        // Short "risky" direct path: A -> B -> C, 1000m total.
        { id: "AB", fromNodeId: "A", toNodeId: "B", roadId: "RISKY", distanceMeters: 500, status: "OPEN" },
        { id: "BC", fromNodeId: "B", toNodeId: "C", roadId: "RISKY", distanceMeters: 500, status: "OPEN" },
        // Longer "safe" detour: A -> D -> E -> C, 1800m total.
        { id: "AD", fromNodeId: "A", toNodeId: "D", roadId: "SAFE", distanceMeters: 600, status: "OPEN" },
        { id: "DE", fromNodeId: "D", toNodeId: "E", roadId: "SAFE", distanceMeters: 600, status: "OPEN" },
        { id: "EC", fromNodeId: "E", toNodeId: "C", roadId: "SAFE", distanceMeters: 600, status: "OPEN" },
      ],
    });
  }

  it("picks the shorter path by default (no cost function = plain distance)", () => {
    const result = findPath(makeDetourGraph(), "A", "C");
    expect(result.distanceMeters).toBe(1000);
    expect(result.nodeIds).toEqual(["A", "B", "C"]);
  });

  it("switches to the longer path once the shorter one is expensive enough", () => {
    const result = findPath(makeDetourGraph(), "A", "C", {
      edgeCost: (edge) =>
        edge.roadId === "RISKY" ? edge.distanceMeters * 5 : edge.distanceMeters,
    });
    // distanceMeters always reports TRUE physical length of the path taken,
    // never the weighted cost used to select it.
    expect(result.distanceMeters).toBe(1800);
    expect(result.nodeIds).toEqual(["A", "D", "E", "C"]);
  });
});
