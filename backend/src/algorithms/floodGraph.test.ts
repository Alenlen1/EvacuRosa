import { describe, expect, it } from "vitest";
import { RoadGraph } from "./astar/graph";
import { prepareFloodRouting } from "./floodGraph";
import { calculateRoute } from "./routing";
import { edgeRisk } from "../services/riskWeighting.service";
import { indexFloodReports } from "../types/floodScope";
import type { FloodReport } from "../types/flood";

const a = { id: "A", latitude: 14.3, longitude: 121.1 },
  b = { id: "B", latitude: 14.31, longitude: 121.1 };
const point = (t: number) => ({
  latitude: a.latitude + (b.latitude - a.latitude) * t,
  longitude: 121.1,
});
const base = () =>
  new RoadGraph({
    nodes: [a, b],
    edges: [
      {
        id: "AB",
        roadId: "road",
        fromNodeId: "A",
        toNodeId: "B",
        distanceMeters: 1112,
        status: "OPEN",
        osmTags: { highway: "residential", oneway: "yes" },
      },
    ],
  });
const report = (fields: Partial<FloodReport> = {}): FloodReport => ({
  id: "flood",
  roadId: "road",
  affectedEdgeIds: ["AB"],
  edgeRanges: [{ edgeId: "AB", startFraction: 0.4, endFraction: 0.6 }],
  severity: "HIGH",
  roadImpassable: true,
  status: "ACTIVE",
  reportedAt: "2026-10-16T00:00:00Z",
  updatedAt: "2026-10-16T00:00:00Z",
  ...fields,
});
const snapshot = (reports: FloodReport[]) => ({
  floodReports: reports,
  statusOverrides: [] as [string, "BLOCKED"][],
  fireIncidents: [],
  earthquakeImpacts: [] as [string, number][],
});

describe("precise flood graph partitioning", () => {
  it("blocks only the flooded interval in both directions, leaving both dry ends usable", () => {
    const graph = base(),
      input = snapshot([report()]);
    for (const [start, end] of [
      [a, point(0.4)],
      [point(0.4), a],
      [point(0.6), b],
      [b, point(0.6)],
    ])
      expect(calculateRoute(graph, start, end, "walking", input).found).toBe(
        true,
      );
    for (const [start, end] of [
      [a, b],
      [b, a],
      [point(0.4), point(0.6)],
      [point(0.6), point(0.4)],
    ])
      expect(
        calculateRoute(graph, start, end, "walking", input).failureReason,
      ).toBe("HAZARD_BLOCKED");
    expect(graph.getData().edges).toHaveLength(1);
  });
  it("preserves one-way rules and physical distance after splitting", () => {
    const graph = base(),
      input = snapshot([report({ severity: "LOW", roadImpassable: false })]);
    expect(calculateRoute(graph, a, b, "car", input).distanceMeters).toBe(1112);
    expect(calculateRoute(graph, b, a, "car", input).found).toBe(false);
    expect(calculateRoute(graph, b, a, "walking", input).found).toBe(true);
  });
  it("assigns fuzzy flood risk only to the wet subedge", () => {
    const input = prepareFloodRouting(
      base(),
      [report({ severity: "MODERATE", roadImpassable: false })],
      [],
    );
    const index = indexFloodReports(input.reports),
      edges = input.graph.edgesByRoadId("road");
    expect(edges).toHaveLength(3);
    expect(edgeRisk(edges[0], input.graph, index, [])).toEqual(
      edgeRisk(edges[0], input.graph, new Map(), []),
    );
    expect(edgeRisk(edges[1], input.graph, index, []).cost).toBeGreaterThan(
      edgeRisk(edges[1], input.graph, new Map(), []).cost,
    );
    expect(edgeRisk(edges[2], input.graph, index, [])).toEqual(
      edgeRisk(edges[2], input.graph, new Map(), []),
    );
  });
  it("retains whole-road/whole-edge blocks when a precise report overlaps", () => {
    const graph = base(),
      low = report({ severity: "LOW", roadImpassable: false });
    for (const old of [
      report({ edgeRanges: null }),
      report({ edgeRanges: null, affectedEdgeIds: null }),
    ]) {
      const input = snapshot([low, old]);
      expect(calculateRoute(graph, a, point(0.4), "walking", input).found).toBe(
        false,
      );
    }
    const input = snapshot([low]);
    input.statusOverrides = [["road", "BLOCKED"]];
    expect(calculateRoute(graph, a, point(0.4), "walking", input).found).toBe(
      false,
    );
  });
  it("splits overlapping intervals at every boundary and keeps the strongest report", () => {
    const first = report({
        severity: "LOW",
        edgeRanges: [{ edgeId: "AB", startFraction: 0.2, endFraction: 0.5 }],
      }),
      second = report({
        id: "two",
        edgeRanges: [{ edgeId: "AB", startFraction: 0.4, endFraction: 0.7 }],
      });
    const prepared = prepareFloodRouting(base(), [first, second], []);
    expect(prepared.graph.edgesByRoadId("road")).toHaveLength(5);
    expect(
      calculateRoute(
        base(),
        point(0.2),
        point(0.4),
        "walking",
        snapshot([first, second]),
      ).found,
    ).toBe(true);
    expect(
      calculateRoute(
        base(),
        point(0.4),
        point(0.5),
        "walking",
        snapshot([first, second]),
      ).found,
    ).toBe(false);
  });
  it("reuses geometry while recomputing changed severity, and rejects invalid/stale ranges", () => {
    const graph = base();
    const first = prepareFloodRouting(graph, [report()], []),
      second = prepareFloodRouting(graph, [report({ severity: "LOW" })], []);
    expect(first.graph).toBe(second.graph);
    expect([...second.overrides.values()]).not.toContain("BLOCKED");
    expect(() =>
      prepareFloodRouting(
        graph,
        [
          report({
            edgeRanges: [
              { edgeId: "missing", startFraction: 0.2, endFraction: 0.6 },
            ],
          }),
        ],
        [],
      ),
    ).toThrow(/does not match/);
    expect(() =>
      prepareFloodRouting(
        graph,
        [
          report({
            edgeRanges: [
              { edgeId: "AB", startFraction: 0.7, endFraction: 0.2 },
            ],
          }),
        ],
        [],
      ),
    ).toThrow(/Invalid/);
  });
});
