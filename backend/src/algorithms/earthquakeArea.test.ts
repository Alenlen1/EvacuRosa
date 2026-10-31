import { describe, expect, it } from "vitest";
import { RoadGraph } from "./astar/graph";
import { selectEarthquakeArea, isImpactArea } from "./earthquakeArea";
import { calculateRoute } from "./routing";
import { prepareFloodRouting } from "./floodGraph";
import { earthquakeImpactByRoadId } from "../types/earthquakeScope";
import { edgeRisk } from "../services/riskWeighting.service";
import type { EarthquakeRoadImpact } from "../types/earthquake";
import type { FloodReport } from "../types/flood";

const point = (fraction: number) => ({
  latitude: 14.3 + 0.01 * fraction,
  longitude: 121.1,
});
const base = () =>
  new RoadGraph({
    nodes: [
      { id: "A", ...point(0) },
      { id: "B", ...point(1) },
      { id: "C", latitude: 14.3, longitude: 121.102 },
      { id: "D", latitude: 14.31, longitude: 121.102 },
    ],
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
      {
        id: "CD",
        roadId: "nearby",
        fromNodeId: "C",
        toNodeId: "D",
        distanceMeters: 1112,
        status: "OPEN",
      },
    ],
  });
const area = { ...point(0.5), radiusMeters: 25 };
const impact = (
  fields: Partial<EarthquakeRoadImpact> = {},
): EarthquakeRoadImpact => ({
  id: "debris",
  earthquakeEventId: null,
  roadId: "road",
  impactLevel: "HIGH",
  confirmedBlocked: true,
  verifiedAt: "2026-10-31T00:00:00Z",
  impactArea: area,
  affectedEdgeIds: ["AB"],
  edgeRanges: [{ edgeId: "AB", startFraction: 0.4, endFraction: 0.6 }],
  ...fields,
});
const snapshot = (
  impacts: EarthquakeRoadImpact[],
  floods: FloodReport[] = [],
) => ({
  statusOverrides: [],
  earthquakeImpacts: [],
  earthquakeRoadImpacts: impacts,
  floodReports: floods,
  fireIncidents: [],
});

describe("verified earthquake debris footprints", () => {
  it("clips a long road to the circle and excludes nearby roads outside it", () => {
    const roads = selectEarthquakeArea(base(), area);
    expect(roads).toHaveLength(1);
    expect(roads[0].roadId).toBe("road");
    expect(roads[0].distanceMeters).toBeCloseTo(50, 0);
    expect(roads[0].edgeRanges[0].startFraction).toBeGreaterThan(0.47);
    expect(roads[0].edgeRanges[0].endFraction).toBeLessThan(0.53);
  });
  it("finds multiple intersecting roads but respects the city's road filter", () => {
    expect(
      selectEarthquakeArea(base(), { ...area, radiusMeters: 250 }),
    ).toHaveLength(2);
    expect(
      selectEarthquakeArea(
        base(),
        { ...area, radiusMeters: 250 },
        (id) => id === "road",
      ),
    ).toHaveLength(1);
  });
  it("does not snap an off-road debris area onto a distant street", () => {
    expect(
      selectEarthquakeArea(base(), { ...area, longitude: 121.11 }),
    ).toEqual([]);
  });
  it.each([0, 4, 251, Infinity, NaN, "25"])(
    "rejects invalid radius %s",
    (radiusMeters) => {
      expect(isImpactArea({ ...area, radiusMeters })).toBe(false);
    },
  );
  it("blocks only the confirmed interval in both directions and leaves the base graph intact", () => {
    const graph = base(),
      input = snapshot([impact()]);
    for (const [start, end] of [
      [point(0), point(0.4)],
      [point(0.4), point(0)],
      [point(0.6), point(1)],
      [point(1), point(0.6)],
    ])
      expect(calculateRoute(graph, start, end, "walking", input).found).toBe(
        true,
      );
    for (const [start, end] of [
      [point(0), point(1)],
      [point(1), point(0)],
    ])
      expect(
        calculateRoute(graph, start, end, "walking", input).failureReason,
      ).toBe("HAZARD_BLOCKED");
    const nearbyStart = { latitude: 14.3, longitude: 121.102 },
      nearbyEnd = { latitude: 14.31, longitude: 121.102 };
    expect(
      calculateRoute(graph, nearbyStart, nearbyEnd, "walking", input).found,
    ).toBe(true);
    expect(graph.edgesByRoadId("road")).toHaveLength(1);
  });
  it("keeps non-blocked damage routable and preserves one-way access", () => {
    const graph = base(),
      input = snapshot([impact({ confirmedBlocked: false })]);
    expect(
      calculateRoute(graph, point(0), point(1), "car", input).distanceMeters,
    ).toBe(1112);
    expect(calculateRoute(graph, point(1), point(0), "car", input).found).toBe(
      false,
    );
    expect(
      calculateRoute(graph, point(1), point(0), "walking", input).found,
    ).toBe(true);
  });
  it("raises fuzzy risk only inside the footprint, including reverse edges", () => {
    const prepared = prepareFloodRouting(
      base(),
      [],
      [],
      [impact({ confirmedBlocked: false })],
    );
    const index = earthquakeImpactByRoadId(prepared.impacts);
    const edges = prepared.graph.edgesByRoadId("road");
    for (const i of [0, 2])
      expect(edgeRisk(edges[i], prepared.graph, new Map(), [], index)).toEqual(
        edgeRisk(edges[i], prepared.graph, new Map(), []),
      );
    expect(
      edgeRisk(edges[1], prepared.graph, new Map(), [], index).cost,
    ).toBeGreaterThan(edgeRisk(edges[1], prepared.graph, new Map(), []).cost);
    const reverse = prepared.graph
      .neighbors(edges[1].toNodeId)
      .find((edge) => edge.id === `${edges[1].id}-r`)!;
    expect(edgeRisk(reverse, prepared.graph, new Map(), [], index).cost).toBe(
      edgeRisk(edges[1], prepared.graph, new Map(), [], index).cost,
    );
  });
  it("partitions overlapping flood and debris ranges together and keeps the stronger closure", () => {
    const flood: FloodReport = {
      id: "flood",
      roadId: "road",
      affectedEdgeIds: ["AB"],
      edgeRanges: [{ edgeId: "AB", startFraction: 0.2, endFraction: 0.5 }],
      severity: "LOW",
      roadImpassable: false,
      status: "ACTIVE",
      reportedAt: "2026-10-31T00:00:00Z",
      updatedAt: "2026-10-31T00:00:00Z",
    };
    const graph = base(),
      input = snapshot([impact()], [flood]);
    expect(
      calculateRoute(graph, point(0.2), point(0.4), "walking", input).found,
    ).toBe(true);
    expect(
      calculateRoute(graph, point(0.4), point(0.5), "walking", input).found,
    ).toBe(false);
    expect(
      calculateRoute(graph, point(0.6), point(1), "walking", input).found,
    ).toBe(true);
  });
  it("retains legacy whole-road closures and never treats empty scoped impacts as whole roads", () => {
    expect(
      calculateRoute(
        base(),
        point(0),
        point(0.4),
        "walking",
        snapshot([impact({ edgeRanges: null, affectedEdgeIds: null })]),
      ).found,
    ).toBe(false);
    expect(
      calculateRoute(
        base(),
        point(0),
        point(1),
        "walking",
        snapshot([impact({ edgeRanges: [], affectedEdgeIds: [] })]),
      ).found,
    ).toBe(true);
  });
});
