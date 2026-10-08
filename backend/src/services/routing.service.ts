import { loadRoadGraph } from "./road.service";
import { buildRoadStatusOverrides, getActiveFloodReports } from "./flood.service";
import { buildFireStatusOverrides, getActiveFireIncidents } from "./fire.service";
import { buildEarthquakeStatusOverrides, buildEarthquakeImpactByRoadId } from "./earthquake.service";
import type { RoadStatus } from "../algorithms/astar/edge";
import type { TravelMode } from "../algorithms/astar/access";
import { calculateRoute, type LatLng, type RouteResult } from "../algorithms/routing";
export type { LatLng, RouteResult } from "../algorithms/routing";

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
  return calculateRoute(graph, start, destination, travelMode, {
    statusOverrides: [...mergeOverrides(floodOverrides, fireOverrides, earthquakeOverrides)],
    floodReports, fireIncidents, earthquakeImpacts: [...earthquakeImpactByRoadId],
  });
}
