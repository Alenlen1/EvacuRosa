import { describe, expect, it } from "vitest";
import { RoadGraph } from "./astar/graph";
import { selectFloodSection } from "./floodSections";
import { calculateRoute } from "./routing";
import { roadStatusOverridesForReports } from "../services/flood.service";
import { edgeRisk } from "../services/riskWeighting.service";
import { indexFloodReports } from "../types/floodScope";
import type { FloodReport } from "../types/flood";

const nodes = ["A", "B", "C", "D", "X", "E", "F"].map((id, index) => ({
  id,
  latitude: 14.3 + index * 0.001,
  longitude: 121.1,
}));
const edge = (id: string, a: string, b: string, roadId = "W1") => ({
  id,
  fromNodeId: a,
  toNodeId: b,
  roadId,
  distanceMeters: 200,
  status: "OPEN" as const,
});
const graph = new RoadGraph({
  nodes,
  edges: [
    edge("AB", "A", "B"),
    edge("BC", "B", "C"),
    edge("CD", "C", "D"),
    edge("EF", "E", "F"),
    edge("BX", "B", "X", "detour"),
    edge("XC", "X", "C", "detour"),
  ],
});
const point = (a: number, b: number) => ({
  latitude: (nodes[a].latitude + nodes[b].latitude) / 2,
  longitude: 121.1,
});
const report = (fields: Partial<FloodReport> = {}): FloodReport => ({
  id: "flood",
  roadId: "W1",
  affectedEdgeIds: ["BC"],
  severity: "HIGH",
  roadImpassable: true,
  status: "ACTIVE",
  reportedAt: "2026-10-16T00:00:00Z",
  updatedAt: "2026-10-16T00:00:00Z",
  ...fields,
});

describe("flood road section selection", () => {
  it("retains the clicked positions within road edges, including reversed selection", () => {
    for (const [start, end, expectedStart, expectedEnd] of [
      [point(0, 1), point(2, 3), point(0, 1), point(2, 3)],
      [point(2, 3), point(0, 1), point(2, 3), point(0, 1)],
      [
        { latitude: 14.3012, longitude: 121.1 },
        { latitude: 14.3018, longitude: 121.1 },
        { latitude: 14.3012, longitude: 121.1 },
        { latitude: 14.3018, longitude: 121.1 },
      ],
      [
        { latitude: 14.3018, longitude: 121.1 },
        { latitude: 14.3012, longitude: 121.1 },
        { latitude: 14.3018, longitude: 121.1 },
        { latitude: 14.3012, longitude: 121.1 },
      ],
    ]) {
      const preview = selectFloodSection(graph, "W1", start, end);
      const coordinates = ({
        latitude,
        longitude,
      }: {
        latitude: number;
        longitude: number;
      }) => ({ latitude, longitude });
      expect(preview.snappedStart.latitude).toBeCloseTo(
        coordinates(expectedStart).latitude,
        10,
      );
      expect(preview.snappedEnd.latitude).toBeCloseTo(
        coordinates(expectedEnd).latitude,
        10,
      );
      expect(preview.affectedSegments[0][0]).toEqual(preview.snappedStart);
      expect(preview.affectedSegments.at(-1)![1]).toEqual(preview.snappedEnd);
      for (let i = 1; i < preview.affectedSegments.length; i++)
        expect(preview.affectedSegments[i - 1][1]).toEqual(
          preview.affectedSegments[i][0],
        );
    }
  });
  it("selects only the clicked segment, not the rest of its road ID", () => {
    expect(
      selectFloodSection(
        graph,
        "W1",
        { latitude: 14.3012, longitude: 121.1 },
        { latitude: 14.3018, longitude: 121.1 },
      ).edgeIds,
    ).toEqual(["BC"]);
  });
  it("does not expand a short selection to the whole graph edge", () => {
    const preview = selectFloodSection(
      graph,
      "W1",
      { latitude: 14.3014, longitude: 121.10001 },
      { latitude: 14.3015, longitude: 121.10001 },
    );
    expect(preview.distanceMeters).toBe(20);
    expect(preview.edgeRanges[0].startFraction).toBeCloseTo(0.4, 8);
    expect(preview.edgeRanges[0].endFraction).toBeCloseTo(0.5, 8);
    expect(preview.snappedStart.longitude).toBe(121.1);
    expect(preview.snappedEnd.latitude).toBeCloseTo(14.3015, 10);
    expect(() =>
      selectFloodSection(graph, "W1", point(1, 2), point(1, 2)),
    ).toThrow(/1 metre/);
  });
  it("follows connected road geometry between two ends in either order", () => {
    expect(
      selectFloodSection(graph, "W1", point(0, 1), point(2, 3)).edgeIds,
    ).toEqual(["AB", "BC", "CD"]);
    expect(
      selectFloodSection(graph, "W1", point(2, 3), point(0, 1)).edgeIds,
    ).toEqual(["CD", "BC", "AB"]);
  });
  it("does not bridge disconnected geometry or accept distant/missing roads", () => {
    expect(() =>
      selectFloodSection(graph, "W1", point(0, 1), point(5, 6)),
    ).toThrow(/disconnected/);
    expect(() =>
      selectFloodSection(graph, "W1", point(0, 1), {
        latitude: 14.1,
        longitude: 121,
      }),
    ).toThrow(/250 m/);
    expect(() =>
      selectFloodSection(graph, "missing", point(0, 1), point(1, 2)),
    ).toThrow();
  });
});

describe("section flood routing and fuzzy risk", () => {
  const snapshot = (reports: FloodReport[]) => ({
    statusOverrides: [...roadStatusOverridesForReports(reports)],
    floodReports: reports,
    fireIncidents: [],
    earthquakeImpacts: [] as [string, number][],
  });
  it("blocks the selected segment in both directions while leaving the same road usable elsewhere", () => {
    const input = snapshot([report()]);
    expect(input.statusOverrides).toEqual([["edge:BC", "BLOCKED"]]);
    expect(
      calculateRoute(graph, nodes[0], nodes[1], "walking", input).path,
    ).toEqual(
      [nodes[0], nodes[1]].map(({ latitude, longitude }) => ({
        latitude,
        longitude,
      })),
    );
    for (const [start, end] of [
      [nodes[1], nodes[2]],
      [nodes[2], nodes[1]],
    ]) {
      const result = calculateRoute(graph, start, end, "walking", input);
      expect(result.found).toBe(true);
      expect(result.path.some((p) => p.latitude === nodes[4].latitude)).toBe(
        true,
      );
    }
  });
  it("keeps Low/Moderate passable and limits fuzzy flood penalties to the selected edges", () => {
    const low = report({ severity: "MODERATE", roadImpassable: false });
    const index = indexFloodReports([low]);
    const ab = graph.edgesByRoadId("W1")[0],
      bc = graph.edgesByRoadId("W1")[1];
    expect(edgeRisk(ab, graph, index, [])).toEqual(
      edgeRisk(ab, graph, new Map(), []),
    );
    expect(edgeRisk(bc, graph, index, []).cost).toBeGreaterThan(
      edgeRisk(bc, graph, new Map(), []).cost,
    );
    expect(roadStatusOverridesForReports([low]).get("edge:BC")).toBe("FLOODED");
  });
  it("retains legacy whole-road blocks and strongest overlapping reports regardless of order", () => {
    const severe = report({ severity: "SEVERE" }),
      low = report({ severity: "LOW" });
    const bc = graph.edgesByRoadId("W1")[1];
    expect(edgeRisk(bc, graph, indexFloodReports([severe, low]), [])).toEqual(
      edgeRisk(bc, graph, indexFloodReports([low, severe]), []),
    );
    const all = report({ affectedEdgeIds: null });
    expect(
      calculateRoute(graph, nodes[0], nodes[1], "walking", snapshot([all, low]))
        .found,
    ).toBe(false);
  });
});
