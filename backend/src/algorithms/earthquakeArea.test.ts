import { describe, expect, it } from "vitest";
import { RoadGraph } from "./astar/graph";
import {
  selectEarthquakeArea,
  isImpactArea,
  rectangleBounds,
  rectangleCorners,
  rectangleFromCorners,
  rectangleLocalPoint,
  rectanglePoint,
  resizeRectangleFromCorner,
  type EarthquakeRectangleArea,
} from "./earthquakeArea";
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
  const rectangle: EarthquakeRectangleArea = {
    ...point(0.5),
    shape: "rectangle",
    widthMeters: 30,
    heightMeters: 60,
  };
  it("clips a rectangle to the affected interval and leaves a parallel nearby road alone", () => {
    const roads = selectEarthquakeArea(base(), rectangle);
    expect(roads.map((r) => r.roadId)).toEqual(["road"]);
    expect(roads[0].distanceMeters).toBe(60);
    expect(roads[0].edgeRanges[0].startFraction).toBeCloseTo(0.473, 3);
    expect(roads[0].edgeRanges[0].endFraction).toBeCloseTo(0.527, 3);
  });
  it("supports dragging in either direction and round trips geographic corners", () => {
    const bounds = rectangleBounds(rectangle);
    const a = { latitude: bounds[0][0], longitude: bounds[0][1] };
    const b = { latitude: bounds[1][0], longitude: bounds[1][1] };
    const forward = rectangleFromCorners(a, b);
    expect(rectangleFromCorners(b, a)).toEqual(forward);
    expect(forward.widthMeters).toBeCloseTo(30, 6);
    expect(forward.heightMeters).toBeCloseTo(60, 6);
    expect(forward.latitude).toBeCloseTo(rectangle.latitude, 10);
  });
  it("keeps legacy rectangles north-up and clips a quarter-turn using the rotated width", () => {
    expect(
      selectEarthquakeArea(base(), { ...rectangle, rotationDegrees: 0 }),
    ).toEqual(selectEarthquakeArea(base(), rectangle));
    const rotated = { ...rectangle, rotationDegrees: 90 };
    const roads = selectEarthquakeArea(base(), rotated);
    expect(roads.map((road) => road.roadId)).toEqual(["road"]);
    expect(roads[0].distanceMeters).toBe(30);
    const bounds = rectangleBounds(rotated);
    const dimensions = rectangleFromCorners(
      { latitude: bounds[0][0], longitude: bounds[0][1] },
      { latitude: bounds[1][0], longitude: bounds[1][1] },
    );
    expect(dimensions.widthMeters).toBeCloseTo(60, 6);
    expect(dimensions.heightMeters).toBeCloseTo(30, 6);
  });
  it("clips diagonal roads to the actual rotated footprint instead of its enclosing bounds", () => {
    const metersPerDegree = (Math.PI * 6371000) / 180;
    const position = (x: number, y: number) => ({
      latitude: rectangle.latitude + y / metersPerDegree,
      longitude:
        rectangle.longitude +
        x / (metersPerDegree * Math.cos((rectangle.latitude * Math.PI) / 180)),
    });
    const graph = new RoadGraph({
      nodes: [
        { id: "A", ...position(-100, -100) },
        { id: "B", ...position(100, 100) },
        { id: "C", ...position(28, -30) },
        { id: "D", ...position(32, -30) },
      ],
      edges: [
        {
          id: "AB",
          roadId: "diagonal",
          fromNodeId: "A",
          toNodeId: "B",
          distanceMeters: Math.hypot(200, 200),
          status: "OPEN",
        },
        {
          id: "CD",
          roadId: "outside",
          fromNodeId: "C",
          toNodeId: "D",
          distanceMeters: 4,
          status: "OPEN",
        },
      ],
    });
    const roads = selectEarthquakeArea(graph, {
      ...rectangle,
      widthMeters: 20,
      heightMeters: 100,
      rotationDegrees: 45,
    });
    expect(roads.map((road) => road.roadId)).toEqual(["diagonal"]);
    expect(roads[0].distanceMeters).toBe(100);
    expect(roads[0].edgeRanges[0].startFraction).toBeCloseTo(0.3232233, 6);
    expect(roads[0].edgeRanges[0].endFraction).toBeCloseTo(0.6767767, 6);
  });
  it("projects clockwise corners and converts geographic points back into rotated axes", () => {
    const rotated = { ...rectangle, rotationDegrees: 90 };
    const north = rectanglePoint(rotated, 0, 20);
    expect(north.latitude).toBeCloseTo(rectangle.latitude, 10);
    expect(north.longitude).toBeGreaterThan(rectangle.longitude);
    const corners = rectangleCorners(rotated);
    expect(corners).toHaveLength(4);
    for (const angle of [0, 37, 90, 180, 270, 359.9]) {
      const area = { ...rectangle, rotationDegrees: angle };
      const local = rectangleLocalPoint(area, rectanglePoint(area, -7, 21));
      expect(local.x).toBeCloseTo(-7, 6);
      expect(local.y).toBeCloseTo(21, 6);
    }
  });
  it.each([0, 1, 2, 3])(
    "resizes rotated corner %s while retaining its opposite corner and angle",
    (index) => {
      const rotated = { ...rectangle, rotationDegrees: 137.9 };
      const [sx, sy] = [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ][index];
      const anchor = rectangleCorners(rotated)[(index + 2) % 4];
      const resized = resizeRectangleFromCorner(
        rotated,
        index,
        rectanglePoint(
          rotated,
          sx * (rotated.widthMeters / 2 + 25),
          sy * (rotated.heightMeters / 2 + 10),
        ),
      );
      expect(resized.rotationDegrees).toBe(137.9);
      expect(resized.widthMeters).toBeCloseTo(55, 2);
      expect(resized.heightMeters).toBeCloseTo(70, 2);
      const nextAnchor = rectangleCorners(resized)[(index + 2) % 4];
      expect(nextAnchor[0]).toBeCloseTo(anchor[0], 10);
      expect(nextAnchor[1]).toBeCloseTo(anchor[1], 10);
      expect(isImpactArea(resized)).toBe(true);
    },
  );
  it("keeps resized dimensions within supported bounds without moving the anchor", () => {
    const rotated = { ...rectangle, rotationDegrees: 45 };
    const anchor = rectangleCorners(rotated)[0];
    const enlarged = resizeRectangleFromCorner(
      rotated,
      2,
      rectanglePoint(rotated, 2000, 2000),
    );
    expect(enlarged.widthMeters).toBe(500);
    expect(enlarged.heightMeters).toBe(500);
    const collapsed = resizeRectangleFromCorner(
      rotated,
      2,
      rectanglePoint(rotated, -100, -100),
    );
    expect(collapsed.widthMeters).toBe(5);
    expect(collapsed.heightMeters).toBe(5);
    for (const next of [enlarged, collapsed]) {
      const nextAnchor = rectangleCorners(next)[0];
      expect(nextAnchor[0]).toBeCloseTo(anchor[0], 10);
      expect(nextAnchor[1]).toBeCloseTo(anchor[1], 10);
    }
  });
  it("clips diagonal edges and keeps entirely enclosed edges", () => {
    const graph = new RoadGraph({
      nodes: [
        { id: "A", latitude: 14.304, longitude: 121.099 },
        { id: "B", latitude: 14.306, longitude: 121.101 },
        { id: "C", latitude: 14.305, longitude: 121.1 },
        { id: "D", latitude: 14.30505, longitude: 121.1 },
      ],
      edges: [
        {
          id: "AB",
          roadId: "diagonal",
          fromNodeId: "A",
          toNodeId: "B",
          distanceMeters: 310,
          status: "OPEN",
        },
        {
          id: "CD",
          roadId: "inside",
          fromNodeId: "C",
          toNodeId: "D",
          distanceMeters: 5.56,
          status: "OPEN",
        },
      ],
    });
    const roads = selectEarthquakeArea(graph, rectangle);
    const diagonal = roads.find((r) => r.roadId === "diagonal")!;
    expect(diagonal.edgeRanges[0].startFraction).toBeGreaterThan(0.4);
    expect(diagonal.edgeRanges[0].endFraction).toBeLessThan(0.6);
    expect(roads.find((r) => r.roadId === "inside")!.edgeRanges[0]).toEqual({
      edgeId: "CD",
      startFraction: 0,
      endFraction: 1,
    });
    expect(
      selectEarthquakeArea(graph, { ...rectangle, longitude: 121.11 }),
    ).toEqual([]);
  });
  it.each([
    { widthMeters: 0 },
    { heightMeters: 4 },
    { widthMeters: 501 },
    { heightMeters: Infinity },
    { widthMeters: "30" },
    { shape: "polygon" },
    { shape: "rectangle", radiusMeters: 25, widthMeters: undefined },
    { latitude: NaN },
    { rotationDegrees: -1 },
    { rotationDegrees: 360 },
    { rotationDegrees: Infinity },
    { rotationDegrees: NaN },
    { rotationDegrees: "45" },
    { rotationDegrees: null },
  ])("rejects malformed rectangles: %j", (fields) => {
    expect(isImpactArea({ ...rectangle, ...fields })).toBe(false);
  });
  it("applies a rotated closure only to the newly clipped road interval", () => {
    const rotated = { ...rectangle, rotationDegrees: 90 };
    const road = selectEarthquakeArea(base(), rotated)[0];
    const input = snapshot([
      impact({ impactArea: rotated, edgeRanges: road.edgeRanges }),
    ]);
    expect(
      calculateRoute(base(), point(0), point(1), "walking", input)
        .failureReason,
    ).toBe("HAZARD_BLOCKED");
    expect(
      calculateRoute(base(), point(0.475), point(0.48), "walking", input).found,
    ).toBe(true);
    expect(road.edgeRanges[0].startFraction).toBeGreaterThan(0.48);
  });
  it("blocks only the rectangle's confirmed interval in both directions", () => {
    const road = selectEarthquakeArea(base(), rectangle)[0];
    const input = snapshot([
      impact({ impactArea: rectangle, edgeRanges: road.edgeRanges }),
    ]);
    for (const [start, end] of [
      [point(0), point(1)],
      [point(1), point(0)],
    ])
      expect(
        calculateRoute(base(), start, end, "walking", input).failureReason,
      ).toBe("HAZARD_BLOCKED");
    expect(
      calculateRoute(base(), point(0), point(0.4), "walking", input).found,
    ).toBe(true);
    expect(
      calculateRoute(
        base(),
        { latitude: 14.3, longitude: 121.102 },
        { latitude: 14.31, longitude: 121.102 },
        "walking",
        input,
      ).found,
    ).toBe(true);
  });
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
