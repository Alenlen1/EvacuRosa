import devFixture from "../data/earthquakeEvents.dev.json";
import { getSupabase } from "../database/supabase";
import type { EarthquakeEvent, EarthquakeRoadImpact } from "../types/earthquake";
import type { RoadStatus } from "../algorithms/astar/edge";

let fixtureWarned = false;

function warnFixtureOnce() {
  if (!fixtureWarned && devFixture._disclaimer) {
    console.warn(`[earthquakes] ${devFixture._disclaimer}`);
    fixtureWarned = true;
  }
}

export async function getRecentEarthquakes(): Promise<EarthquakeEvent[]> {
  const supabase = getSupabase();
  if (!supabase) {
    warnFixtureOnce();
    return devFixture.events as EarthquakeEvent[];
  }

  const { data, error } = await supabase
    .from("earthquake_events")
    .select(
      "id, external_event_id, latitude, longitude, magnitude, depth_km, occurred_at, source, status, notes, created_at, updated_at"
    )
    .order("occurred_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error(
      "[earthquakes] Supabase query failed, falling back to dev fixture:",
      error.message
    );
    warnFixtureOnce();
    return devFixture.events as EarthquakeEvent[];
  }

  return (data ?? []).map((row: any) => ({
    id: row.id,
    externalEventId: row.external_event_id,
    latitude: row.latitude,
    longitude: row.longitude,
    magnitude: row.magnitude,
    depthKm: row.depth_km,
    occurredAt: row.occurred_at,
    source: row.source,
    status: row.status,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function getVerifiedRoadImpacts(): Promise<EarthquakeRoadImpact[]> {
  const supabase = getSupabase();
  if (!supabase) {
    warnFixtureOnce();
    return devFixture.roadImpacts as EarthquakeRoadImpact[];
  }

  const { data, error } = await supabase
    .from("earthquake_road_impacts")
    .select("id, earthquake_event_id, road_id, impact_level, confirmed_blocked, notes, verified_at");

  if (error) {
    console.error(
      "[earthquakes] Supabase query failed, falling back to dev fixture:",
      error.message
    );
    warnFixtureOnce();
    return devFixture.roadImpacts as EarthquakeRoadImpact[];
  }

  return (data ?? []).map((row: any) => ({
    id: row.id,
    earthquakeEventId: row.earthquake_event_id,
    roadId: row.road_id,
    impactLevel: row.impact_level,
    confirmedBlocked: row.confirmed_blocked,
    notes: row.notes,
    verifiedAt: row.verified_at,
  }));
}

/** Section 31's hard rule, stricter than flood/fire: raw earthquake data —
 * magnitude, depth, proximity — NEVER touches routing. Only an explicit,
 * human-verified road impact does. There is deliberately no geometric
 * proximity calculation here at all, unlike fire's radius-based falloff. */
export async function buildEarthquakeStatusOverrides(): Promise<Map<string, RoadStatus>> {
  const impacts = await getVerifiedRoadImpacts();
  const overrides = new Map<string, RoadStatus>();
  for (const impact of impacts) {
    if (impact.confirmedBlocked) {
      overrides.set(impact.roadId, "BLOCKED");
    }
  }
  return overrides;
}

const IMPACT_LEVEL_TO_NUMERIC: Record<string, number> = {
  LOW: 1,
  MODERATE: 2,
  HIGH: 3,
};

/** Verified impact level per road, for the fuzzy engine's earthquake
 * input — 0 for any road with no verified impact record, by design. */
export async function buildEarthquakeImpactByRoadId(): Promise<Map<string, number>> {
  const impacts = await getVerifiedRoadImpacts();
  const byRoad = new Map<string, number>();
  for (const impact of impacts) {
    const level = IMPACT_LEVEL_TO_NUMERIC[impact.impactLevel] ?? 0;
    byRoad.set(impact.roadId, Math.max(byRoad.get(impact.roadId) ?? 0, level));
  }
  return byRoad;
}

/** Dedupes by externalEventId — the same USGS event can appear again on a
 * later sync run (updated magnitude estimate, etc.) and must not create a
 * duplicate row (section 45's explicit requirement). Only meaningful once
 * Supabase is configured; this is what scripts/fetch-earthquakes.ts calls. */
export async function upsertEarthquakeEvents(
  events: { externalEventId: string; latitude: number; longitude: number; magnitude: number; depthKm: number | null; occurredAt: string; source: string }[]
): Promise<{ inserted: number; updated: number }> {
  const supabase = getSupabase();
  if (!supabase) {
    throw new Error(
      "Supabase isn't configured — set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before syncing real earthquake data."
    );
  }

  let inserted = 0;
  let updated = 0;

  for (const event of events) {
    const { data: existing } = await supabase
      .from("earthquake_events")
      .select("id")
      .eq("external_event_id", event.externalEventId)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("earthquake_events")
        .update({
          magnitude: event.magnitude,
          depth_km: event.depthKm,
          occurred_at: event.occurredAt,
        })
        .eq("id", existing.id);
      updated += 1;
    } else {
      await supabase.from("earthquake_events").insert({
        external_event_id: event.externalEventId,
        latitude: event.latitude,
        longitude: event.longitude,
        magnitude: event.magnitude,
        depth_km: event.depthKm,
        occurred_at: event.occurredAt,
        source: event.source,
        status: "UNREVIEWED",
      });
      inserted += 1;
    }
  }

  return { inserted, updated };
}
