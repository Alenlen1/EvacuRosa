import { evaluateRoadRisk, severityToNumeric } from "../algorithms/fuzzy/fuzzyEngine";
import type { FuzzyRiskResult } from "../algorithms/fuzzy/fuzzyEngine";
import type { RiskLevel } from "../algorithms/fuzzy/types";
import type { GraphEdge } from "../algorithms/astar/edge";
import type { RoadGraph } from "../algorithms/astar/graph";
import { distanceMetersToSegment } from "../algorithms/astar/heuristic";
import type { FloodReport } from "../types/flood";
import type { FireIncident } from "../types/fire";
/**
 * How much a maximally-risky (VERY_HIGH, normalizedRisk=1) road inflates
 * its own cost in the A* search, relative to its physical distance. At
 * RISK_WEIGHT=2, a VERY_HIGH-risk road costs 3x its real distance — A*
 * will happily detour up to that much to avoid it, but it's a soft cost,
 * not a wall (unlike BLOCKED, which is a hard exclusion regardless of this
 * weight). Documented here per the spec's "avoid unexplained magic
 * numbers" rule — tune this constant, not the formula, if routes feel too
 * hazard-averse or not averse enough once real usage data exists.
 */
export const RISK_WEIGHT = 2;

/** How far past its own radius a fire's soft risk keeps tapering off
 * before hitting zero. 1.5x is a judgment call, not a measured value —
 * fire risk to a road (smoke, heat, falling debris, evacuation traffic)
 * plausibly extends a bit past the fire's own footprint, but shouldn't be
 * treated as sharply as flood water actually touching a road. */
const FIRE_INFLUENCE_MULTIPLIER = 1.5;

const RISK_LEVEL_ORDER: RiskLevel[] = ["VERY_LOW", "LOW", "MODERATE", "HIGH", "VERY_HIGH"];

export function riskLevelRank(level: RiskLevel): number {
  return RISK_LEVEL_ORDER.indexOf(level);
}

/** Never fabricates a precise reading — only used as a rough proxy when a
 * flood report has a severity category but no measured water level. */
function approximateWaterLevelFromSeverity(level: number): number {
  const table = [0, 0.1, 0.3, 0.5, 0.8];
  return table[level] ?? 0;
}

function fireSeverityForEdge(
  fromNode: { latitude: number; longitude: number },
  toNode: { latitude: number; longitude: number },
  fireIncidents: FireIncident[]
): number {
  let worst = 0;
  for (const fire of fireIncidents) {
    const influenceRadius = fire.radiusMeters * FIRE_INFLUENCE_MULTIPLIER;
    const distance = distanceMetersToSegment(fire, fromNode, toNode);
    if (distance >= influenceRadius) continue;

    const falloff = 1 - distance / influenceRadius;
    const severityNum = severityToNumeric(fire.severity);
    worst = Math.max(worst, severityNum * falloff);
  }
  return worst;
}

export interface EdgeRisk {
  cost: number;
  risk: FuzzyRiskResult;
}

/**
 * Builds the fuzzy inputs for one edge from what's actually known about it
 * today (flood report, nearby fire incidents by proximity, condition,
 * distance, and any CDRRMO-verified earthquake impact) and evaluates its
 * risk. earthquakeImpactByRoadId only ever contains entries for roads with
 * an explicit human-verified assessment — see earthquake.service.ts.
 */
export function edgeRisk(
  edge: GraphEdge,
  graph: RoadGraph,
  floodReportsByRoadId: Map<string, FloodReport>,
  fireIncidents: FireIncident[],
  earthquakeImpactByRoadId: Map<string, number> = new Map()
): EdgeRisk {
  const floodReport = floodReportsByRoadId.get(edge.roadId);
  const floodLevel = floodReport ? severityToNumeric(floodReport.severity) : 0;
  const floodWaterLevelMeters =
    floodReport?.waterLevelMeters ?? approximateWaterLevelFromSeverity(floodLevel);

  const fromNode = graph.getNode(edge.fromNodeId);
  const toNode = graph.getNode(edge.toNodeId);
  const fireLevel =
    fromNode && toNode ? fireSeverityForEdge(fromNode, toNode, fireIncidents) : 0;

  const earthquakeImpactLevel = earthquakeImpactByRoadId.get(edge.roadId) ?? 0;

  const roadConditionLevel =
    edge.condition === "POOR" ? 2 : edge.condition === "FAIR" ? 1 : 0;

  // Composite exposure — the worst of flood/fire severity, scaled to 0-2.
  // Earthquake deliberately isn't folded into this composite: exposure is
  // meant to represent ongoing environmental hazard, whereas a verified
  // earthquake impact is closer to road condition (a static, already-done
  // fact about the road) — it's carried through its own dedicated input.
  const hazardExposureLevel = (Math.max(floodLevel, fireLevel) / 4) * 2;

  const risk = evaluateRoadRisk({
    floodWaterLevelMeters,
    fireSeverityLevel: fireLevel,
    roadConditionLevel,
    distanceMeters: edge.distanceMeters,
    hazardExposureLevel,
    earthquakeImpactLevel,
  });

  const normalizedRisk = risk.riskScore / 4;
  const cost = edge.distanceMeters * (1 + RISK_WEIGHT * normalizedRisk);

  return { cost, risk };
}
