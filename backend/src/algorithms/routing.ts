import { findPath } from "./astar/astar";
import type { RoadGraph } from "./astar/graph";
import type { GraphEdge, RoadStatus } from "./astar/edge";
import type { TravelMode } from "./astar/access";
import type { RiskLevel } from "./fuzzy/types";
import { edgeRisk, riskLevelRank } from "../services/riskWeighting.service";
import type { FloodReport } from "../types/flood";
import type { FireIncident } from "../types/fire";
import { effectiveEdgeStatus, indexFloodReports } from "../types/floodScope";
import { prepareFloodRouting } from "./floodGraph";
import { haversineMeters } from "./astar/heuristic";

export interface LatLng {
  latitude: number;
  longitude: number;
}

export interface RouteResult {
  failureReason?: "HAZARD_BLOCKED";
  found: boolean;
  path: LatLng[];
  distanceMeters: number;
  affectedRoads: number;
  riskLevel: RiskLevel | null;
  warnings: string[];
}

export interface RoutingSnapshot {
  statusOverrides: [string, RoadStatus][];
  floodReports: FloodReport[];
  fireIncidents: FireIncident[];
  earthquakeImpacts: [string, number][];
}

export function calculateRoute(
  graph: RoadGraph,
  start: LatLng,
  destination: LatLng,
  travelMode: TravelMode,
  snapshot: RoutingSnapshot,
): RouteResult {
  return createRouteCalculator(graph, snapshot)(start, destination, travelMode);
}

/** Reuse graph preparation and fuzzy edge scores only within one request.
 * A new request always builds a calculator from freshly loaded hazards. */
export function createRouteCalculator(
  graph: RoadGraph,
  snapshot: RoutingSnapshot,
) {
  const prepared = prepareFloodRouting(
    graph,
    snapshot.floodReports,
    snapshot.statusOverrides,
  );
  graph = prepared.graph;
  const overrides = prepared.overrides;
  const floodReports = prepared.reports;
  const fireIncidents = snapshot.fireIncidents;
  const earthquakeImpactByRoadId = new Map(snapshot.earthquakeImpacts);
  const floodByRoadId = indexFloodReports(floodReports);

  // A* evaluates edgeCost on every edge expansion, and each call runs the
  // full fuzzy rule set — on a real OSM graph that's tens of thousands of
  // evaluations per route. Memoize per request. Forward and reverse edges
  // of the same segment ("E12" / "E12-r") are geometrically identical, so
  // they share a cache entry.
  const riskCache = new Map<string, { cost: number; riskLevel: RiskLevel }>();
  const cachedEdgeRisk = (edge: GraphEdge) => {
    const key = edge.id.endsWith("-r") ? edge.id.slice(0, -2) : edge.id;
    let cached = riskCache.get(key);
    if (!cached) {
      const evaluated = edgeRisk(
        edge,
        graph,
        floodByRoadId,
        fireIncidents,
        earthquakeImpactByRoadId,
      );
      // Routing needs the score, not thousands of retained rule explanations.
      cached = { cost: evaluated.cost, riskLevel: evaluated.risk.riskLevel };
      riskCache.set(key, cached);
    }
    return cached;
  };

  return (
    start: LatLng,
    destination: LatLng,
    travelMode: TravelMode,
  ): RouteResult => {
    let startNode = graph.nearestAccessibleNode(
      start.latitude,
      start.longitude,
      travelMode,
    );
    let goalNode = graph.nearestAccessibleNode(
      destination.latitude,
      destination.longitude,
      travelMode,
    );

    if (!startNode || !goalNode) {
      return {
        found: false,
        path: [],
        distanceMeters: 0,
        affectedRoads: 0,
        riskLevel: null,
        warnings: [
          "No accessible road within 250 m of the start or destination for this travel mode.",
        ],
      };
    }

    // The hybrid step: A* selects a path by risk-weighted cost (flood, fire
    // proximity, verified earthquake impact, road condition), not raw
    // distance. BLOCKED status is still a hard exclusion regardless of cost.
    const options = {
      travelMode,
      statusOverrides: overrides,
      edgeCost: (edge: GraphEdge) => cachedEdgeRisk(edge).cost,
    };
    let result = findPath(graph, startNode.id, goalNode.id, options);
    const warnings: string[] = [];

    // OSM sometimes contains an isolated footpath beside the connected road.
    // Only reconsider endpoint matching for a genuine gap in the source graph,
    // never when a restriction or hazard prevents travel within that graph.
    if (
      !result.found &&
      graph.componentId(startNode.id) !== graph.componentId(goalNode.id)
    ) {
      const starts = graph.nearbyAccessibleNodes(
        start.latitude,
        start.longitude,
        travelMode,
      );
      const goals = graph.nearbyAccessibleNodes(
        destination.latitude,
        destination.longitude,
        travelMode,
      );
      const goalsByComponent = new Map<number, (typeof goals)[number]>();
      for (const candidate of goals) {
        const component = graph.componentId(candidate.node.id)!;
        if (!goalsByComponent.has(component))
          goalsByComponent.set(component, candidate);
      }
      let best:
        | { start: (typeof starts)[number]; goal: (typeof goals)[number] }
        | undefined;
      for (const candidate of starts) {
        const goal = goalsByComponent.get(
          graph.componentId(candidate.node.id)!,
        );
        if (
          goal &&
          (!best ||
            candidate.distance + goal.distance <
              best.start.distance + best.goal.distance)
        )
          best = { start: candidate, goal };
      }
      if (best) {
        const approachWarning = (
          point: LatLng,
          node: LatLng,
          endpoint: string,
        ) =>
          `The mapped route ${endpoint} approximately ${Math.round(haversineMeters(point.latitude, point.longitude, node.latitude, node.longitude))} m from your selected location. The approach between that point and the road is not mapped or verified; check local access and conditions.`;
        if (best.start.node.id !== startNode.id)
          warnings.push(approachWarning(start, best.start.node, "starts"));
        if (best.goal.node.id !== goalNode.id)
          warnings.push(approachWarning(destination, best.goal.node, "ends"));
        startNode = best.start.node;
        goalNode = best.goal.node;
        // Choose endpoints before checking hazards. Do not keep moving them
        // until a closed road or one-way rule can be avoided.
        result = findPath(graph, startNode.id, goalNode.id, options);
      }
    }

    if (!result.found) {
      // Diagnostic only: keep access/one-way rules, remove hazard overrides.
      // Never return this potentially unsafe path to the caller.
      const hazardBlocked =
        [...overrides.values()].includes("BLOCKED") &&
        findPath(graph, startNode.id, goalNode.id, { travelMode }).found;
      return {
        failureReason: hazardBlocked ? "HAZARD_BLOCKED" : undefined,
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
      (e) => effectiveEdgeStatus(e, overrides) !== "OPEN",
    ).length;

    // Overall route risk is the worst segment along it, not an average.
    const riskLevel: RiskLevel =
      result.edges.length === 0
        ? "VERY_LOW"
        : result.edges.reduce<RiskLevel>((worst, e) => {
            const level = cachedEdgeRisk(e).riskLevel;
            return riskLevelRank(level) > riskLevelRank(worst) ? level : worst;
          }, "VERY_LOW");

    return {
      found: true,
      path,
      distanceMeters: Math.round(result.distanceMeters),
      affectedRoads,
      riskLevel,
      warnings,
    };
  };
}
