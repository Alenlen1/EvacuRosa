import { loadRoadGraph } from "./road.service";
import {
  roadStatusOverridesForReports,
  getActiveFloodReports,
} from "./flood.service";
import {
  fireStatusOverridesForIncidents,
  getActiveFireIncidents,
} from "./fire.service";
import {
  getVerifiedRoadImpacts,
  earthquakeStatusOverridesForImpacts,
  earthquakeImpactByRoadId,
} from "./earthquake.service";
import type { RoadStatus } from "../algorithms/astar/edge";
import type { TravelMode } from "../algorithms/astar/access";
import {
  createRouteCalculator,
  type LatLng,
  type RouteResult,
} from "../algorithms/routing";
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

export async function computeRoute(
  start: LatLng,
  destination: LatLng,
  travelMode: TravelMode = "walking",
): Promise<RouteResult> {
  const calculate = await createRoutePlanner();
  return calculate(start, destination, travelMode);
}

/** One fresh hazard read per source per request, shared by all candidate centers. */
export async function createRoutePlanner() {
  const graph = loadRoadGraph();
  const [floodReports, fireIncidents, impacts] = await Promise.all([
    getActiveFloodReports(),
    getActiveFireIncidents(),
    getVerifiedRoadImpacts(),
  ]);
  return createRouteCalculator(graph, {
    statusOverrides: [
      ...mergeOverrides(
        roadStatusOverridesForReports(floodReports),
        fireStatusOverridesForIncidents(fireIncidents),
        earthquakeStatusOverridesForImpacts(impacts),
      ),
    ],
    floodReports,
    fireIncidents,
    earthquakeImpacts: [...earthquakeImpactByRoadId(impacts)],
    earthquakeRoadImpacts: impacts,
  });
}
