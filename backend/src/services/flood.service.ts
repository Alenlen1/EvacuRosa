import { getSupabase } from "../database/supabase";
import type { FloodReport } from "../types/flood";
import type { RoadStatus } from "../algorithms/astar/edge";

export async function getActiveFloodReports(): Promise<FloodReport[]> {
  const supabase = getSupabase();
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from("flood_reports")
    .select(
      "id, road_id, barangay_id, severity, water_level_meters, road_impassable, status, notes, reported_at, updated_at, barangays(name)"
    )
    .eq("status", "ACTIVE");

  if (error) {
    throw new Error(`Could not load flood reports: ${error.message}`);
  }

  return (data ?? []).map((row: any) => ({
    id: row.id,
    roadId: row.road_id,
    barangayId: row.barangay_id,
    barangayName: row.barangays?.name,
    severity: row.severity,
    waterLevelMeters: row.water_level_meters,
    roadImpassable: row.road_impassable,
    status: row.status,
    notes: row.notes,
    reportedAt: row.reported_at,
    updatedAt: row.updated_at,
  }));
}

/**
 * The spec's hard rule (section 29): a severe flood does NOT automatically
 * block a road — only a confirmed-impassable report does. Everything else
 * just marks the road FLOODED (shows up in affected-road counts; has no
 * effect on route selection until fuzzy-logic risk weighting exists).
 * A BLOCKED override from one report is never downgraded by another.
 */
export async function buildRoadStatusOverrides(): Promise<Map<string, RoadStatus>> {
  const reports = await getActiveFloodReports();
  return roadStatusOverridesForReports(reports);
}

export function roadStatusOverridesForReports(
  reports: FloodReport[]
): Map<string, RoadStatus> {
  const overrides = new Map<string, RoadStatus>();

  for (const report of reports) {
    if (!report.roadId) continue;
    if (report.roadImpassable) {
      overrides.set(report.roadId, "BLOCKED");
    } else if (report.severity !== "NONE" && overrides.get(report.roadId) !== "BLOCKED") {
      overrides.set(report.roadId, "FLOODED");
    }
  }

  return overrides;
}
