import { getAvailableCenters } from "./evacuation.service";
import { computeRoute, type LatLng } from "./routing.service";
import { RISK_WEIGHT, riskLevelRank } from "./riskWeighting.service";
import type { RiskLevel } from "../algorithms/fuzzy/types";
import type { EvacuationCenter } from "../types/evacuation";

export interface EvacuationRouteResult {
  found: boolean;
  recommendedCenter: EvacuationCenter | null;
  route: LatLng[];
  distanceMeters: number;
  riskLevel: RiskLevel | null;
  warnings: string[];
}

/**
 * Ranks candidates the same way A* now ranks individual roads: by a
 * risk-weighted score, not raw distance — see RISK_WEIGHT in
 * riskWeighting.service.ts for the reasoning and the exact formula. This
 * is what makes the spec's own example real: "Center A: 1.5km, HIGH RISK"
 * losing out to "Center B: 2.2km, LOW RISK" only happens once distance
 * alone stops being the sole criterion, which it now isn't.
 */
export async function computeEvacuationRoute(start: LatLng): Promise<EvacuationRouteResult> {
  const candidates = await getAvailableCenters();

  if (candidates.length === 0) {
    return {
      found: false,
      recommendedCenter: null,
      route: [],
      distanceMeters: 0,
      riskLevel: null,
      warnings: ["No evacuation centers are currently available (all full or closed)."],
    };
  }

  let best: {
    center: EvacuationCenter;
    distanceMeters: number;
    path: LatLng[];
    riskLevel: RiskLevel;
    score: number;
  } | null = null;

  for (const center of candidates) {
    const result = await computeRoute(start, {
      latitude: center.latitude,
      longitude: center.longitude,
    });
    if (!result.found || !result.riskLevel) continue;

    const normalizedRisk = riskLevelRank(result.riskLevel) / 4;
    const score = result.distanceMeters * (1 + RISK_WEIGHT * normalizedRisk);

    if (!best || score < best.score) {
      best = {
        center,
        distanceMeters: result.distanceMeters,
        path: result.path,
        riskLevel: result.riskLevel,
        score,
      };
    }
  }

  if (!best) {
    return {
      found: false,
      recommendedCenter: null,
      route: [],
      distanceMeters: 0,
      riskLevel: null,
      warnings: ["No reachable evacuation center was found using the available road network."],
    };
  }

  return {
    found: true,
    recommendedCenter: best.center,
    route: best.path,
    distanceMeters: best.distanceMeters,
    riskLevel: best.riskLevel,
    warnings: [],
  };
}
