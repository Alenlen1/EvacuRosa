import type { Response } from "express";
import type { RoleAwareRequest } from "../middleware/role.middleware";
import { isFloodImpassable, isFloodSeverity } from "../types/floodPassability";
import {
  isInsideSantaRosa,
  HAZARD_CITY_ERROR,
  HAZARD_ROAD_ERROR,
} from "../geography/santaRosa";
import { loadRoadGraph } from "../services/road.service";
import { isSantaRosaRoad } from "../services/hazardScope.service";
import type { FloodEdgeRange } from "../types/flood";
import {
  selectFloodSection,
  type SectionPoint,
} from "../algorithms/floodSections";

function validSectionPoint(value: unknown): value is SectionPoint {
  const point = value as SectionPoint | null;
  return (
    !!point &&
    typeof point === "object" &&
    Number.isFinite(point.latitude) &&
    Number.isFinite(point.longitude) &&
    isInsideSantaRosa(point.latitude, point.longitude)
  );
}

export { updateCenter as updateEvacuationCenter } from "./centerManagement.controller";

export async function createFloodReport(req: RoleAwareRequest, res: Response) {
  const {
    roadId,
    barangayId,
    severity,
    waterLevelMeters,
    notes,
    sectionStart,
    sectionEnd,
    coverage,
  } = req.body ?? {};

  if (!req.userSupabase) {
    res.status(401).json({ error: "Not authenticated." });
    return;
  }
  if (typeof roadId !== "string" || !isFloodSeverity(severity)) {
    res
      .status(400)
      .json({ error: "roadId and a valid flood severity are required." });
    return;
  }

  if (!isSantaRosaRoad(loadRoadGraph(), roadId)) {
    res.status(400).json({ error: HAZARD_ROAD_ERROR });
    return;
  }

  let affectedEdgeIds: string[] | null = null;
  let edgeRanges: FloodEdgeRange[] | null = null;
  if (
    coverage !== undefined &&
    coverage !== "section" &&
    coverage !== "entire-road"
  ) {
    res.status(400).json({ error: "Invalid flood coverage." });
    return;
  }
  if (
    coverage === "section" ||
    sectionStart !== undefined ||
    sectionEnd !== undefined
  ) {
    if (
      coverage === "entire-road" ||
      !validSectionPoint(sectionStart) ||
      !validSectionPoint(sectionEnd)
    ) {
      res.status(400).json({
        error:
          "Select a valid start and end inside Santa Rosa for the flooded road section.",
      });
      return;
    }
    try {
      const selection = selectFloodSection(
        loadRoadGraph(),
        roadId,
        sectionStart,
        sectionEnd,
        (candidate) => isSantaRosaRoad(loadRoadGraph(), candidate),
      );
      affectedEdgeIds = selection.edgeIds;
      edgeRanges = selection.edgeRanges;
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : "Invalid road section.",
      });
      return;
    }
  }

  // Runs AS the calling user's JWT — the SUPER_ADMIN-only RLS policy on
  // flood_reports decides whether this insert actually succeeds.
  const { data, error } = await req.userSupabase
    .from("flood_reports")
    .insert({
      road_id: roadId,
      affected_edge_ids: affectedEdgeIds,
      edge_ranges: edgeRanges,
      barangay_id: barangayId ?? null,
      severity,
      water_level_meters:
        typeof waterLevelMeters === "number" ? waterLevelMeters : null,
      road_impassable: isFloodImpassable(severity),
      status: "ACTIVE",
      notes: typeof notes === "string" ? notes : null,
      reported_by: req.profile?.id,
    })
    .select()
    .single();

  if (error) {
    if (
      (error.code === "42703" || error.code === "PGRST204") &&
      /affected_edge_ids|edge_ranges/.test(error.message)
    ) {
      res.status(503).json({
        error:
          "Flood section database setup is incomplete. Run migrations 0015 and 0016 in the Supabase project used by this backend, then retry.",
      });
      return;
    }
    res
      .status(403)
      .json({ error: "Could not create flood report — check permissions." });
    return;
  }

  res.status(201).json({ report: data });
}

export async function updateFloodReport(req: RoleAwareRequest, res: Response) {
  const { id } = req.params;
  const { severity, waterLevelMeters, status, notes } = req.body ?? {};

  if (!req.userSupabase) {
    res.status(401).json({ error: "Not authenticated." });
    return;
  }

  const updates: Record<string, unknown> = {};
  if (severity !== undefined) {
    if (!isFloodSeverity(severity)) {
      res.status(400).json({ error: "Invalid flood severity." });
      return;
    }
    updates.severity = severity;
    updates.road_impassable = isFloodImpassable(severity);
  }
  if (typeof waterLevelMeters === "number")
    updates.water_level_meters = waterLevelMeters;
  if (typeof status === "string") updates.status = status;
  if (typeof notes === "string") updates.notes = notes;

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "No recognized fields to update." });
    return;
  }

  const { data, error } = await req.userSupabase
    .from("flood_reports")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    res.status(403).json({ error: "Update rejected." });
    return;
  }

  res.json({ report: data });
}

export async function deleteFloodReport(req: RoleAwareRequest, res: Response) {
  const { id } = req.params;

  if (!req.userSupabase) {
    res.status(401).json({ error: "Not authenticated." });
    return;
  }

  const { error } = await req.userSupabase
    .from("flood_reports")
    .delete()
    .eq("id", id);

  if (error) {
    res.status(403).json({ error: "Delete rejected." });
    return;
  }

  res.status(204).send();
}

export async function createFireIncident(req: RoleAwareRequest, res: Response) {
  const { barangayId, latitude, longitude, severity, radiusMeters, notes } =
    req.body ?? {};

  if (!req.userSupabase) {
    res.status(401).json({ error: "Not authenticated." });
    return;
  }
  if (
    typeof latitude !== "number" ||
    typeof longitude !== "number" ||
    typeof severity !== "string" ||
    typeof radiusMeters !== "number"
  ) {
    res.status(400).json({
      error: "latitude, longitude, severity, and radiusMeters are required.",
    });
    return;
  }

  if (!isInsideSantaRosa(latitude, longitude)) {
    res.status(400).json({ error: HAZARD_CITY_ERROR });
    return;
  }

  const { data, error } = await req.userSupabase
    .from("fire_incidents")
    .insert({
      barangay_id: barangayId ?? null,
      latitude,
      longitude,
      severity,
      radius_meters: radiusMeters,
      status: "ACTIVE",
      confirmed_blocked_road_ids: [],
      notes: typeof notes === "string" ? notes : null,
      reported_by: req.profile?.id,
    })
    .select()
    .single();

  if (error) {
    res
      .status(403)
      .json({ error: "Could not create fire incident — check permissions." });
    return;
  }

  res.status(201).json({ incident: data });
}

export async function updateFireIncident(req: RoleAwareRequest, res: Response) {
  const { id } = req.params;
  const { severity, radiusMeters, status, confirmedBlockedRoadIds, notes } =
    req.body ?? {};

  if (!req.userSupabase) {
    res.status(401).json({ error: "Not authenticated." });
    return;
  }

  const updates: Record<string, unknown> = {};
  if (typeof severity === "string") updates.severity = severity;
  if (typeof radiusMeters === "number") updates.radius_meters = radiusMeters;
  if (typeof status === "string") updates.status = status;
  if (Array.isArray(confirmedBlockedRoadIds)) {
    if (
      confirmedBlockedRoadIds.some(
        (id) => typeof id !== "string" || !isSantaRosaRoad(loadRoadGraph(), id),
      )
    ) {
      res.status(400).json({ error: HAZARD_ROAD_ERROR });
      return;
    }
    updates.confirmed_blocked_road_ids = confirmedBlockedRoadIds;
  }
  if (typeof notes === "string") updates.notes = notes;

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "No recognized fields to update." });
    return;
  }

  const { data, error } = await req.userSupabase
    .from("fire_incidents")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    res.status(403).json({ error: "Update rejected." });
    return;
  }

  res.json({ incident: data });
}

export async function deleteFireIncident(req: RoleAwareRequest, res: Response) {
  const { id } = req.params;

  if (!req.userSupabase) {
    res.status(401).json({ error: "Not authenticated." });
    return;
  }

  const { error } = await req.userSupabase
    .from("fire_incidents")
    .delete()
    .eq("id", id);

  if (error) {
    res.status(403).json({ error: "Delete rejected." });
    return;
  }

  res.status(204).send();
}

export async function updateEarthquakeEvent(
  req: RoleAwareRequest,
  res: Response,
) {
  const { id } = req.params;
  const { status, notes } = req.body ?? {};

  if (!req.userSupabase) {
    res.status(401).json({ error: "Not authenticated." });
    return;
  }

  const updates: Record<string, unknown> = {};
  if (typeof status === "string") updates.status = status;
  if (typeof notes === "string") updates.notes = notes;

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "No recognized fields to update." });
    return;
  }

  const { data, error } = await req.userSupabase
    .from("earthquake_events")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    res.status(403).json({ error: "Update rejected." });
    return;
  }

  res.json({ event: data });
}

export async function deleteEarthquakeEvent(
  req: RoleAwareRequest,
  res: Response,
) {
  const { id } = req.params;

  if (!req.userSupabase) {
    res.status(401).json({ error: "Not authenticated." });
    return;
  }

  const { error } = await req.userSupabase
    .from("earthquake_events")
    .delete()
    .eq("id", id);

  if (error) {
    res.status(403).json({ error: "Could not remove earthquake event." });
    return;
  }

  res.status(204).send();
}

export async function createEarthquakeRoadImpact(
  req: RoleAwareRequest,
  res: Response,
) {
  const { earthquakeEventId, roadId, impactLevel, confirmedBlocked, notes } =
    req.body ?? {};

  if (!req.userSupabase) {
    res.status(401).json({ error: "Not authenticated." });
    return;
  }
  if (
    typeof earthquakeEventId !== "string" ||
    typeof roadId !== "string" ||
    typeof impactLevel !== "string"
  ) {
    res.status(400).json({
      error: "earthquakeEventId, roadId, and impactLevel are required.",
    });
    return;
  }

  if (!isSantaRosaRoad(loadRoadGraph(), roadId)) {
    res.status(400).json({ error: HAZARD_ROAD_ERROR });
    return;
  }

  // This insert IS the "CDRRMO Review / Verified Impact" step from the
  // spec's flow diagram — nothing about this earthquake affects routing
  // until this row exists.
  const { data, error } = await req.userSupabase
    .from("earthquake_road_impacts")
    .insert({
      earthquake_event_id: earthquakeEventId,
      road_id: roadId,
      impact_level: impactLevel,
      confirmed_blocked: Boolean(confirmedBlocked),
      notes: typeof notes === "string" ? notes : null,
      verified_by: req.profile?.id,
    })
    .select()
    .single();

  if (error) {
    res
      .status(403)
      .json({ error: "Could not record road impact — check permissions." });
    return;
  }

  res.status(201).json({ roadImpact: data });
}

export async function deleteEarthquakeRoadImpact(
  req: RoleAwareRequest,
  res: Response,
) {
  const { id } = req.params;

  if (!req.userSupabase) {
    res.status(401).json({ error: "Not authenticated." });
    return;
  }

  const { error } = await req.userSupabase
    .from("earthquake_road_impacts")
    .delete()
    .eq("id", id);

  if (error) {
    res.status(403).json({ error: "Delete rejected." });
    return;
  }

  res.status(204).send();
}
