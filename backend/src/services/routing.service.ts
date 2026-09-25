import { loadRoadGraph } from "./road.service";
import { findPath } from "../algorithms/astar/astar";
import { buildRoadStatusOverrides, getActiveFloodReports } from "./flood.service";
import { buildFireStatusOverrides, getActiveFireIncidents } from "./fire.service";
import {
  buildEarthquakeStatusOverrides,
  buildEarthquakeImpactByRoadId,
} from "./earthquake.service";
import { edgeRisk, riskLevelRank } from "./riskWeighting.service";
import type { RiskLevel } from "../algorithms/fuzzy/types";
import type { RoadStatus, GraphEdge } from "../algorithms/astar/edge";
import type { TravelMode } from "../algorithms/astar/access";

export interface LatLng {
  latitude: number;
  longitude: number;
}

export interface RouteResult {
  found: boolean;
  path: LatLng[];
  distanceMeters: number;
  affectedRoads: number;
  riskLevel: RiskLevel | null;
  warnings: string[];
}

function mergeOverrides(
  ...maps: Map<string, RoadStatus>[]
): Map<string, RoadStatus> {
  const merged = new Map<string, RoadStatus>();
  for (const map of maps) {
    for (const [roadId, status] of map) {
      // BLOCKED from any single source wins outright — never downgraded
      // by a less severe override from another source.
      if (status === "BLOCKED" || merged.get(roadId) !== "BLOCKED") {
        merged.set(roadId, status);
      }
    }
  }
  return merged;
}

export async function computeRoute(start: LatLng, destination: LatLng, travelMode: TravelMode = "walking"): Promise<RouteResult> {
  const graph = loadRoadGraph();
  const startNode = graph.nearestAccessibleNode(start.latitude, start.longitude, travelMode);
  const goalNode = graph.nearestAccessibleNode(destination.latitude, destination.longitude, travelMode);

  if (!startNode || !goalNode) {
    return {
      found: false,
      path: [],
      distanceMeters: 0,
      affectedRoads: 0,
      riskLevel: null,
      warnings: ["No accessible road within 250 m of the start or destination for this travel mode."],
    };
  }

  const [
    floodOverrides,
    fireOverrides,
    earthquakeOverrides,
    floodReports,
    fireIncidents,
    earthquakeImpactByRoadId,
  ] = await Promise.all([
    buildRoadStatusOverrides(),
    buildFireStatusOverrides(),
    buildEarthquakeStatusOverrides(),
    getActiveFloodReports(),
    getActiveFireIncidents(),
    buildEarthquakeImpactByRoadId(),
  ]);
  const overrides = mergeOverrides(floodOverrides, fireOverrides, earthquakeOverrides);
  const floodByRoadId = new Map(floodReports.map((r) => [r.roadId, r]));

  // A* evaluates edgeCost on every edge expansion, and each call runs the
  // full fuzzy rule set — on a real OSM graph that's tens of thousands of
  // evaluations per route. Memoize per request. Forward and reverse edges
  // of the same segment ("E12" / "E12-r") are geometrically identical, so
  // they share a cache entry.
  const riskCache = new Map<string, ReturnType<typeof edgeRisk>>();
  const cachedEdgeRisk = (edge: GraphEdge) => {
    const key = edge.id.endsWith("-r") ? edge.id.slice(0, -2) : edge.id;
    let cached = riskCache.get(key);
    if (!cached) {
      cached = edgeRisk(edge, graph, floodByRoadId, fireIncidents, earthquakeImpactByRoadId);
      riskCache.set(key, cached);
    }
    return cached;
  };

  // The hybrid step: A* selects a path by risk-weighted cost (flood, fire
  // proximity, verified earthquake impact, road condition), not raw
  // distance. BLOCKED status is still a hard exclusion regardless of cost.
  const result = findPath(graph, startNode.id, goalNode.id, {
    travelMode,
    statusOverrides: overrides,
    edgeCost: (edge) => cachedEdgeRisk(edge).cost,
  });

  if (!result.found) {
    return {
      found: false,
      path: [],
      distanceMeters: 0,
      affectedRoads: 0,
      riskLevel: null,
      warnings: [
        "No route could be found using the available road network and current restrictions.",
      ],
    };
  }

  const path = result.nodeIds
    .map((id) => graph.getNode(id))
    .filter((n): n is NonNullable<typeof n> => !!n)
    .map((n) => ({ latitude: n.latitude, longitude: n.longitude }));

  const affectedRoads = result.edges.filter(
    (e) => (overrides.get(e.roadId) ?? e.status) !== "OPEN"
  ).length;

  // Overall route risk is the worst segment along it, not an average.
  const riskLevel: RiskLevel =
    result.edges.length === 0
      ? "VERY_LOW"
      : result.edges.reduce<RiskLevel>((worst, e) => {
          const level = cachedEdgeRisk(e).risk.riskLevel;
          return riskLevelRank(level) > riskLevelRank(worst) ? level : worst;
        }, "VERY_LOW");

  return {
    found: true,
    path,
    distanceMeters: Math.round(result.distanceMeters),
    affectedRoads,
    riskLevel,
    warnings: [],
  };
}
