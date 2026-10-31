import type { EarthquakeRoadImpact } from "./earthquake";
import type { RoadStatus } from "../algorithms/astar/edge";
import { edgeOverrideKey } from "./floodScope";

// Precise ranges must first be expanded to routing subedges. Null means a
// legacy whole-road report; an empty section must never become a whole road.
export const earthquakeImpactKeys = (impact: EarthquakeRoadImpact) =>
  impact.edgeRanges != null
    ? []
    : impact.affectedEdgeIds == null
      ? [impact.roadId]
      : impact.affectedEdgeIds.map(edgeOverrideKey);

export function earthquakeStatusOverridesForImpacts(
  impacts: EarthquakeRoadImpact[],
) {
  const overrides = new Map<string, RoadStatus>();
  for (const impact of impacts)
    if (impact.confirmedBlocked)
      for (const key of earthquakeImpactKeys(impact))
        overrides.set(key, "BLOCKED");
  return overrides;
}

export function earthquakeImpactByRoadId(impacts: EarthquakeRoadImpact[]) {
  const index = new Map<string, number>();
  const levels = { LOW: 1, MODERATE: 2, HIGH: 3 };
  for (const impact of impacts)
    for (const key of earthquakeImpactKeys(impact))
      index.set(
        key,
        Math.max(index.get(key) ?? 0, levels[impact.impactLevel] ?? 0),
      );
  return index;
}
