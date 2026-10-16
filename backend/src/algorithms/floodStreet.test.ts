import { describe, expect, it } from "vitest";
import { RoadGraph } from "./astar/graph";
import { selectFloodSection } from "./floodSections";
import { calculateRoute } from "./routing";
import type { FloodReport } from "../types/flood";

const nodes = Array.from({ length: 5 }, (_, i) => ({
  id: String(i),
  latitude: 14.3 + i * 0.001,
  longitude: 121.1,
}));
const point = (i: number) => ({ latitude: 14.3 + i * 0.001, longitude: 121.1 });
const edges = Array.from({ length: 4 }, (_, i) => ({
  id: `E${i}`,
  roadId: `W${i}`,
  roadName: i % 2 ? "Example   STREET" : "Example Street",
  fromNodeId: String(i),
  toNodeId: String(i + 1),
  distanceMeters: 111,
  status: "OPEN" as const,
}));
const graph = new RoadGraph({ nodes, edges });

describe("flood selection across OSM street pieces", () => {
  it("follows a named street across several connected way IDs beyond the initial 250m limit", () => {
    const preview = selectFloodSection(graph, "W0", point(0.2), point(3.8));
    expect(preview.edgeIds).toEqual(["E0", "E1", "E2", "E3"]);
    expect(preview.distanceMeters).toBe(400);
    expect(preview.snappedEnd.latitude).toBeCloseTo(point(3.8).latitude, 10);
    expect(preview.edgeRanges[0].startFraction).toBeCloseTo(0.2, 8);
    expect(preview.edgeRanges[3].endFraction).toBeCloseTo(0.8, 8);
    expect(
      selectFloodSection(graph, "W3", point(3.8), point(0.2)).edgeIds,
    ).toEqual(["E3", "E2", "E1", "E0"]);
  });
  it("never connects identical names across a gap or through a differently named street", () => {
    const other = new RoadGraph({
      nodes: [...nodes, { id: "X", latitude: 14.31, longitude: 121.1 }],
      edges: [
        ...edges.slice(0, 2),
        { ...edges[3], fromNodeId: "3", toNodeId: "X" },
        { ...edges[2], roadName: "Other Street" },
      ],
    });
    expect(() =>
      selectFloodSection(other, "W0", point(0.2), point(3.8)),
    ).toThrow(/disconnected/);
  });
  it("does not group unnamed road classifications into a citywide street", () => {
    const unnamed = new RoadGraph({
      nodes,
      edges: edges.map((edge) => ({ ...edge, roadName: "residential" })),
    });
    expect(unnamed.edgesForStreet("W0")).toHaveLength(1);
    expect(() =>
      selectFloodSection(unnamed, "W0", point(0.2), point(3.8)),
    ).toThrow(/250 m/);
  });
  it("excludes ineligible city roads from the connecting chain", () => {
    expect(() =>
      selectFloodSection(
        graph,
        "W0",
        point(0.2),
        point(3.8),
        (id) => id !== "W2",
      ),
    ).toThrow(/disconnected/);
  });
  it("applies a multi-way saved report to every selected piece in both routing directions", () => {
    const preview = selectFloodSection(graph, "W0", point(0.2), point(3.8));
    const report: FloodReport = {
      id: "multi",
      roadId: "W0",
      affectedEdgeIds: preview.edgeIds,
      edgeRanges: preview.edgeRanges,
      severity: "HIGH",
      roadImpassable: true,
      status: "ACTIVE",
      reportedAt: "2026-10-16T00:00:00Z",
      updatedAt: "2026-10-16T00:00:00Z",
    };
    const snapshot = {
      floodReports: [report],
      statusOverrides: [],
      fireIncidents: [],
      earthquakeImpacts: [],
    };
    expect(
      calculateRoute(graph, point(2), point(3), "walking", snapshot)
        .failureReason,
    ).toBe("HAZARD_BLOCKED");
    expect(
      calculateRoute(graph, point(3), point(2), "walking", snapshot)
        .failureReason,
    ).toBe("HAZARD_BLOCKED");
    expect(
      calculateRoute(graph, point(0), point(0.2), "walking", snapshot).found,
    ).toBe(true);
    expect(
      calculateRoute(graph, point(3.8), point(4), "walking", snapshot).found,
    ).toBe(true);
  });
});
