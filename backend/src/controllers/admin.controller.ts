import type { Response } from "express";
import type { RoleAwareRequest } from "../middleware/role.middleware";

export async function updateEvacuationCenter(req: RoleAwareRequest, res: Response) {
  const { id } = req.params;
  const { currentOccupancy, capacity, status, notes } = req.body ?? {};

  if (!req.userSupabase) {
    res.status(401).json({ error: "Not authenticated." });
    return;
  }

  const updates: Record<string, unknown> = {};
  if (typeof currentOccupancy === "number") updates.current_occupancy = currentOccupancy;
  if (typeof capacity === "number") updates.capacity = capacity;
  if (typeof status === "string") updates.status = status;
  if (typeof notes === "string") updates.notes = notes;
  if (req.profile) updates.updated_by = req.profile.id;

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "No recognized fields to update." });
    return;
  }

  // Runs AS the calling user's JWT — RLS decides whether this row is
  // actually writable for them, regardless of what this code intends.
  const { data, error } = await req.userSupabase
    .from("evacuation_centers")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    res.status(403).json({
      error: "Update rejected — check that this center belongs to your barangay.",
    });
    return;
  }

  res.json({ center: data });
}

export async function createFloodReport(req: RoleAwareRequest, res: Response) {
  const { roadId, barangayId, severity, waterLevelMeters, roadImpassable, notes } =
    req.body ?? {};

  if (!req.userSupabase) {
    res.status(401).json({ error: "Not authenticated." });
    return;
  }
  if (typeof roadId !== "string" || typeof severity !== "string") {
    res.status(400).json({ error: "roadId and severity are required." });
    return;
  }

  // Runs AS the calling user's JWT — the SUPER_ADMIN-only RLS policy on
  // flood_reports decides whether this insert actually succeeds.
  const { data, error } = await req.userSupabase
    .from("flood_reports")
    .insert({
      road_id: roadId,
      barangay_id: barangayId ?? null,
      severity,
      water_level_meters: typeof waterLevelMeters === "number" ? waterLevelMeters : null,
      road_impassable: Boolean(roadImpassable),
      status: "ACTIVE",
      notes: typeof notes === "string" ? notes : null,
      reported_by: req.profile?.id,
    })
    .select()
    .single();

  if (error) {
    res.status(403).json({ error: "Could not create flood report — check permissions." });
    return;
  }

  res.status(201).json({ report: data });
}

export async function updateFloodReport(req: RoleAwareRequest, res: Response) {
  const { id } = req.params;
  const { severity, waterLevelMeters, roadImpassable, status, notes } = req.body ?? {};

  if (!req.userSupabase) {
    res.status(401).json({ error: "Not authenticated." });
    return;
  }

  const updates: Record<string, unknown> = {};
  if (typeof severity === "string") updates.severity = severity;
  if (typeof waterLevelMeters === "number") updates.water_level_meters = waterLevelMeters;
  if (typeof roadImpassable === "boolean") updates.road_impassable = roadImpassable;
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

  const { error } = await req.userSupabase.from("flood_reports").delete().eq("id", id);

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
    res.status(403).json({ error: "Could not create fire incident — check permissions." });
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

  const { error } = await req.userSupabase.from("fire_incidents").delete().eq("id", id);

  if (error) {
    res.status(403).json({ error: "Delete rejected." });
    return;
  }

  res.status(204).send();
}

export async function updateEarthquakeEvent(req: RoleAwareRequest, res: Response) {
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

export async function deleteEarthquakeEvent(req: RoleAwareRequest, res: Response) {
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

export async function createEarthquakeRoadImpact(req: RoleAwareRequest, res: Response) {
  const { earthquakeEventId, roadId, impactLevel, confirmedBlocked, notes } = req.body ?? {};

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
    res.status(403).json({ error: "Could not record road impact — check permissions." });
    return;
  }

  res.status(201).json({ roadImpact: data });
}

export async function deleteEarthquakeRoadImpact(req: RoleAwareRequest, res: Response) {
  const { id } = req.params;

  if (!req.userSupabase) {
    res.status(401).json({ error: "Not authenticated." });
    return;
  }

  const { error } = await req.userSupabase.from("earthquake_road_impacts").delete().eq("id", id);

  if (error) {
    res.status(403).json({ error: "Delete rejected." });
    return;
  }

  res.status(204).send();
}
