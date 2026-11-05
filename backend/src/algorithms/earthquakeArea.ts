import type { RoadGraph } from "./astar/graph";
import { toLocalMeters } from "./astar/heuristic";
import { pointOnEdge, type SectionPoint } from "./floodSections";
import type { FloodEdgeRange } from "../types/flood";

export interface EarthquakeCircleArea extends SectionPoint {
  shape?: "circle";
  radiusMeters: number;
}

export interface EarthquakeRectangleArea extends SectionPoint {
  shape: "rectangle";
  widthMeters: number;
  heightMeters: number;
  /** Clockwise from the north-up rectangle; omitted on legacy records. */
  rotationDegrees?: number;
}

export type EarthquakeImpactArea =
  EarthquakeCircleArea | EarthquakeRectangleArea;

export function isImpactArea(value: unknown): value is EarthquakeImpactArea {
  if (!value || typeof value !== "object") return false;
  const area = value as Record<string, unknown>;
  const bounded = (n: unknown, min: number, max: number): n is number =>
    typeof n === "number" && Number.isFinite(n) && n >= min && n <= max;
  if (!bounded(area.latitude, -85, 85) || !bounded(area.longitude, -180, 180))
    return false;
  if (area.shape === "rectangle")
    return (
      bounded(area.widthMeters, 5, 500) &&
      bounded(area.heightMeters, 5, 500) &&
      (area.rotationDegrees === undefined ||
        (bounded(area.rotationDegrees, 0, 360) && area.rotationDegrees < 360))
    );
  return (
    (area.shape === undefined || area.shape === "circle") &&
    bounded(area.radiusMeters, 5, 250)
  );
}

const METERS_PER_DEGREE = (Math.PI * 6371000) / 180;

function rotateRectanglePoint(
  area: EarthquakeRectangleArea,
  x: number,
  y: number,
  inverse = false,
) {
  const angle = ((area.rotationDegrees ?? 0) * Math.PI) / 180;
  const cos = Math.cos(angle),
    sin = Math.sin(angle) * (inverse ? -1 : 1);
  return { x: x * cos + y * sin, y: -x * sin + y * cos };
}

/** Project rectangle-local metres (right/up) into geographic coordinates. */
export function rectanglePoint(
  area: EarthquakeRectangleArea,
  x: number,
  y: number,
): SectionPoint {
  const world = rotateRectanglePoint(area, x, y);
  return {
    latitude: area.latitude + world.y / METERS_PER_DEGREE,
    longitude:
      area.longitude +
      world.x / (METERS_PER_DEGREE * Math.cos((area.latitude * Math.PI) / 180)),
  };
}

/** Convert a geographic point into the rotated rectangle's local axes. */
export function rectangleLocalPoint(
  area: EarthquakeRectangleArea,
  point: SectionPoint,
) {
  const local = toLocalMeters(
    point.latitude,
    point.longitude,
    area.latitude,
    area.longitude,
  );
  return rotateRectanglePoint(area, local.x, local.y, true);
}

/** SW, SE, NE, NW in rectangle-local axes, before clockwise rotation. */
export function rectangleCorners(
  area: EarthquakeRectangleArea,
): [number, number][] {
  return [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ].map(([x, y]) => {
    const point = rectanglePoint(
      area,
      (x * area.widthMeters) / 2,
      (y * area.heightMeters) / 2,
    );
    return [point.latitude, point.longitude];
  });
}

/** Geographic enclosing bounds; use rectangleCorners to draw the footprint. */
export function rectangleBounds(
  area: EarthquakeRectangleArea,
): [[number, number], [number, number]] {
  const corners = rectangleCorners(area);
  return [
    [
      Math.min(...corners.map(([lat]) => lat)),
      Math.min(...corners.map(([, lng]) => lng)),
    ],
    [
      Math.max(...corners.map(([lat]) => lat)),
      Math.max(...corners.map(([, lng]) => lng)),
    ],
  ];
}

/** Resize along the rotated axes while keeping the opposite corner fixed. */
export function resizeRectangleFromCorner(
  area: EarthquakeRectangleArea,
  cornerIndex: number,
  point: SectionPoint,
): EarthquakeRectangleArea {
  const signs = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ][cornerIndex];
  if (!signs) return area;
  const [sx, sy] = signs;
  const anchor = rectanglePoint(
    area,
    (-sx * area.widthMeters) / 2,
    (-sy * area.heightMeters) / 2,
  );
  const delta = rectangleLocalPoint({ ...area, ...anchor }, point);
  const widthMeters = Math.max(5, Math.min(500, sx * delta.x));
  const heightMeters = Math.max(5, Math.min(500, sy * delta.y));
  const offset = rotateRectanglePoint(
    area,
    (sx * widthMeters) / 2,
    (sy * heightMeters) / 2,
  );
  const latitude = anchor.latitude + offset.y / METERS_PER_DEGREE;
  return {
    ...area,
    latitude,
    longitude:
      anchor.longitude +
      offset.x / (METERS_PER_DEGREE * Math.cos((latitude * Math.PI) / 180)),
    widthMeters,
    heightMeters,
  };
}

export function rectangleFromCorners(
  a: SectionPoint,
  b: SectionPoint,
): EarthquakeRectangleArea {
  const latitude = (a.latitude + b.latitude) / 2;
  return {
    shape: "rectangle",
    latitude,
    longitude: (a.longitude + b.longitude) / 2,
    widthMeters:
      Math.abs(a.longitude - b.longitude) *
      METERS_PER_DEGREE *
      Math.cos((latitude * Math.PI) / 180),
    heightMeters: Math.abs(a.latitude - b.latitude) * METERS_PER_DEGREE,
  };
}

/** Clip the parametric edge to a rectangle without extending it or snapping roads. */
function rectangleInterval(
  a: { x: number; y: number },
  b: { x: number; y: number },
  area: EarthquakeRectangleArea,
): [number, number] | null {
  a = rotateRectanglePoint(area, a.x, a.y, true);
  b = rotateRectanglePoint(area, b.x, b.y, true);
  let start = 0,
    end = 1;
  for (const [origin, delta, half] of [
    [a.x, b.x - a.x, area.widthMeters / 2],
    [a.y, b.y - a.y, area.heightMeters / 2],
  ]) {
    if (delta === 0) {
      if (Math.abs(origin) > half) return null;
      continue;
    }
    const t1 = (-half - origin) / delta,
      t2 = (half - origin) / delta;
    start = Math.max(start, Math.min(t1, t2));
    end = Math.min(end, Math.max(t1, t2));
    if (end <= start) return null;
  }
  return [start, end];
}

export interface EarthquakeAreaRoad {
  roadId: string;
  roadName?: string;
  edgeRanges: FloodEdgeRange[];
  affectedSegments: SectionPoint[][];
  distanceMeters: number;
}

/** Intersect road segments with an operator's verified debris footprint.
 * This is not an epicentre or an inferred earthquake damage radius. */
export function selectEarthquakeArea(
  graph: RoadGraph,
  area: EarthquakeImpactArea,
  roadAllowed: (roadId: string) => boolean = () => true,
): EarthquakeAreaRoad[] {
  if (!isImpactArea(area))
    throw new Error(
      "Draw a debris rectangle between 5 and 500 metres on each side.",
    );
  const roads = new Map<string, EarthquakeAreaRoad>();
  for (const edge of graph.getData().edges) {
    const from = graph.getNode(edge.fromNodeId),
      to = graph.getNode(edge.toNodeId);
    if (!from || !to) continue;
    const a = toLocalMeters(
      from.latitude,
      from.longitude,
      area.latitude,
      area.longitude,
    );
    const b = toLocalMeters(
      to.latitude,
      to.longitude,
      area.latitude,
      area.longitude,
    );
    const dx = b.x - a.x,
      dy = b.y - a.y;
    const lengthSq = dx * dx + dy * dy;
    if (!lengthSq) continue;
    let start: number, end: number;
    if (area.shape === "rectangle") {
      const interval = rectangleInterval(a, b, area);
      if (!interval) continue;
      [start, end] = interval;
    } else {
      const projection = -(a.x * dx + a.y * dy) / lengthSq;
      const closest = Math.max(0, Math.min(1, projection));
      if (
        Math.hypot(a.x + closest * dx, a.y + closest * dy) >= area.radiusMeters
      )
        continue;
      const perpendicularSq = Math.max(
        0,
        a.x * a.x + a.y * a.y - projection * projection * lengthSq,
      );
      const half = Math.sqrt(
        Math.max(0, (area.radiusMeters ** 2 - perpendicularSq) / lengthSq),
      );
      start = Math.max(0, projection - half);
      end = Math.min(1, projection + half);
    }
    if ((end - start) * edge.distanceMeters < 0.1 || !roadAllowed(edge.roadId))
      continue;
    const road = roads.get(edge.roadId) ?? {
      roadId: edge.roadId,
      roadName: edge.roadName,
      edgeRanges: [],
      affectedSegments: [],
      distanceMeters: 0,
    };
    road.edgeRanges.push({
      edgeId: edge.id,
      startFraction: start,
      endFraction: end,
    });
    road.affectedSegments.push([
      pointOnEdge(graph, edge, start),
      pointOnEdge(graph, edge, end),
    ]);
    road.distanceMeters += edge.distanceMeters * (end - start);
    roads.set(edge.roadId, road);
  }
  return [...roads.values()].map((road) => ({
    ...road,
    distanceMeters: Math.round(road.distanceMeters),
  }));
}
