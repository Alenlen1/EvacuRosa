import type { FloodReport } from "./flood";
import type { GraphEdge, RoadStatus } from "../algorithms/astar/edge";
import { severityToNumeric } from "../algorithms/fuzzy/fuzzyEngine";
import { isFloodImpassable } from "./floodPassability";

export const canonicalEdgeId = (id: string) =>
  id.endsWith("-r") ? id.slice(0, -2) : id;
export const edgeOverrideKey = (id: string) => `edge:${canonicalEdgeId(id)}`;
export const floodReportKeys = (report: FloodReport) =>
  report.edgeRanges != null
    ? []
    : report.affectedEdgeIds == null
      ? [report.roadId]
      : report.affectedEdgeIds.map(edgeOverrideKey);

/** Precise ranges are expanded to routing subedges before this is used. */
export function floodStatusOverrides(
  reports: FloodReport[],
): Map<string, RoadStatus> {
  const overrides = new Map<string, RoadStatus>();
  for (const report of reports) {
    if (!report.roadId) continue;
    for (const key of floodReportKeys(report)) {
      if (isFloodImpassable(report.severity)) overrides.set(key, "BLOCKED");
      else if (report.severity !== "NONE" && overrides.get(key) !== "BLOCKED")
        overrides.set(key, "FLOODED");
    }
  }
  return overrides;
}

export function effectiveEdgeStatus(
  edge: GraphEdge,
  overrides?: Map<string, RoadStatus>,
): RoadStatus {
  const road = overrides?.get(edge.roadId);
  const segment = overrides?.get(edgeOverrideKey(edge.id));
  if (edge.status === "BLOCKED" || road === "BLOCKED" || segment === "BLOCKED")
    return "BLOCKED";
  return segment ?? road ?? edge.status;
}

function combine(a: FloodReport | undefined, b: FloodReport): FloodReport {
  if (!a) return b;
  const worst =
    severityToNumeric(a.severity) >= severityToNumeric(b.severity) ? a : b;
  const levels = [a.waterLevelMeters, b.waterLevelMeters].filter(
    (value): value is number => typeof value === "number",
  );
  return {
    ...worst,
    waterLevelMeters: levels.length ? Math.max(...levels) : null,
  };
}

export function indexFloodReports(reports: FloodReport[]) {
  const index = new Map<string, FloodReport>();
  for (const report of reports)
    for (const key of floodReportKeys(report))
      index.set(key, combine(index.get(key), report));
  return index;
}

export function floodForEdge(edge: GraphEdge, index: Map<string, FloodReport>) {
  const whole = index.get(edge.roadId);
  const section = index.get(edgeOverrideKey(edge.id));
  return section ? combine(whole, section) : whole;
}
