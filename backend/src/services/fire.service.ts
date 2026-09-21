import devFixture from "../data/fireIncidents.dev.json";
import { getSupabase } from "../database/supabase";
import type { FireIncident } from "../types/fire";
import type { RoadStatus } from "../algorithms/astar/edge";

let fixtureWarned = false;

function fromFixture(): FireIncident[] {
  if (!fixtureWarned && devFixture._disclaimer) {
    console.warn(`[fire-incidents] ${devFixture._disclaimer}`);
    fixtureWarned = true;
  }
  return devFixture.incidents as FireIncident[];
}

export async function getActiveFireIncidents(): Promise<FireIncident[]> {
  const supabase = getSupabase();
  if (!supabase) {
    return fromFixture().filter((f) => f.status === "ACTIVE");
  }

  const { data, error } = await supabase
    .from("fire_incidents")
    .select(
      "id, barangay_id, latitude, longitude, severity, radius_meters, status, confirmed_blocked_road_ids, notes, reported_at, updated_at, barangays(name)"
    )
    .eq("status", "ACTIVE");

  if (error) {
    console.error(
      "[fire-incidents] Supabase query failed, falling back to dev fixture:",
      error.message
    );
    return fromFixture().filter((f) => f.status === "ACTIVE");
  }

  return (data ?? []).map((row: any) => ({
    id: row.id,
    barangayId: row.barangay_id,
    barangayName: row.barangays?.name,
    latitude: row.latitude,
    longitude: row.longitude,
    severity: row.severity,
    radiusMeters: row.radius_meters,
    status: row.status,
    confirmedBlockedRoadIds: row.confirmed_blocked_road_ids ?? [],
    notes: row.notes,
    reportedAt: row.reported_at,
    updatedAt: row.updated_at,
  }));
}

/** Mirrors flood.service.ts's buildRoadStatusOverrides — the only thing
 * that ever hard-blocks a road here is an explicit confirmation, never
 * proximity to the fire itself. */
export async function buildFireStatusOverrides(): Promise<Map<string, RoadStatus>> {
  const incidents = await getActiveFireIncidents();
  const overrides = new Map<string, RoadStatus>();

  for (const incident of incidents) {
    for (const roadId of incident.confirmedBlockedRoadIds) {
      overrides.set(roadId, "BLOCKED");
    }
  }

  return overrides;
}
