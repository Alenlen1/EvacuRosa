import type { RoadGraph } from "./astar/graph";
import { toLocalMeters } from "./astar/heuristic";
import { pointOnEdge, type SectionPoint } from "./floodSections";
import type { FloodEdgeRange } from "../types/flood";

export interface EarthquakeImpactArea extends SectionPoint {
  radiusMeters: number;
}

export function isImpactArea(value: unknown): value is EarthquakeImpactArea {
  const area = value as EarthquakeImpactArea | null;
  return (
    !!area &&
    typeof area === "object" &&
    Number.isFinite(area.latitude) &&
    Number.isFinite(area.longitude) &&
    Number.isFinite(area.radiusMeters) &&
    area.radiusMeters >= 5 &&
    area.radiusMeters <= 250
  );
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
    throw new Error("Choose an affected radius between 5 and 250 metres.");
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
    const projection = -(a.x * dx + a.y * dy) / lengthSq;
    const closest = Math.max(0, Math.min(1, projection));
    if (Math.hypot(a.x + closest * dx, a.y + closest * dy) >= area.radiusMeters)
      continue;
    const perpendicularSq = Math.max(
      0,
      a.x * a.x + a.y * a.y - projection * projection * lengthSq,
    );
    const half = Math.sqrt(
      Math.max(0, (area.radiusMeters ** 2 - perpendicularSq) / lengthSq),
    );
    const start = Math.max(0, projection - half),
      end = Math.min(1, projection + half);
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
