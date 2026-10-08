import { RoadGraph } from "../../../../backend/src/algorithms/astar/graph";
import { calculateRoute, type LatLng } from "../../../../backend/src/algorithms/routing";
import { RISK_WEIGHT, riskLevelRank } from "../../../../backend/src/services/riskWeighting.service";
import type { TravelMode } from "../travelTime";
import type { OfflinePackage } from "../../../../backend/src/algorithms/offline";

export class OfflineRoutingEngine {
  private graph: RoadGraph;
  constructor(private data: OfflinePackage) {
    this.graph = new RoadGraph(data.graph.data);
  }
  calculate(start: LatLng, destination: LatLng | null, travelMode: TravelMode) {
    const snapshot = this.data.snapshot;
    const warnings = [
      `Offline route — saved hazard and center data as of ${new Date(snapshot.updatedAt).toLocaleString()}. Conditions and center availability may have changed.`,
    ];
    if (!snapshot.hazardsAvailable) warnings.push("Hazard data is unavailable. Route risk is unknown.");
    const routeTo = (point: LatLng) => calculateRoute(this.graph, start, point, travelMode, snapshot);
    if (destination) {
      const result = routeTo(destination);
      if (!result.found) return { error: result.warnings[0], failureReason: result.failureReason };
      return { result: {
        route: result.path, distance: result.distanceMeters, affectedRoads: result.affectedRoads,
        riskLevel: snapshot.hazardsAvailable ? result.riskLevel : null,
        updatedAt: snapshot.updatedAt, warnings, source: "offline" as const,
      } };
    }
    let best: { score: number; result: ReturnType<typeof routeTo>; center: OfflinePackage["snapshot"]["centers"][number] } | null = null;
    let hazardBlocked = false;
    for (const center of snapshot.centers) {
      if (center.status === "FULL" || center.status === "CLOSED") continue;
      const result = routeTo(center);
      hazardBlocked ||= result.failureReason === "HAZARD_BLOCKED";
      if (!result.found || !result.riskLevel) continue;
      const score = result.distanceMeters * (1 + RISK_WEIGHT * riskLevelRank(result.riskLevel) / 4);
      if (!best || score < best.score) best = { score, result, center };
    }
    if (!best) return { error: "No reachable evacuation center was found in the saved data.",
      failureReason: hazardBlocked ? "HAZARD_BLOCKED" : undefined };
    return { result: {
      recommendedCenter: best.center, route: best.result.path, distance: best.result.distanceMeters,
      riskLevel: snapshot.hazardsAvailable ? best.result.riskLevel : null,
      warnings, lastUpdated: snapshot.updatedAt, source: "offline" as const,
    } };
  }
}
