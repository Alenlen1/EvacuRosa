import type { Response } from "express";
import type { RoleAwareRequest } from "../middleware/role.middleware";
import { loadRoadGraph } from "../services/road.service";
import {
  privateResponse,
  validRequestId,
} from "../services/assistanceTracking.service";

export type HazardArchiveKind = "flood" | "fire" | "impact" | "event";

function cdrrmo(req: RoleAwareRequest, res: Response) {
  privateResponse(res);
  if (!req.userSupabase || req.profile?.role !== "SUPER_ADMIN") {
    res.status(403).json({ error: "CDRRMO access required." });
    return false;
  }
  return true;
}

export async function archiveHazard(
  req: RoleAwareRequest,
  res: Response,
  kind: HazardArchiveKind,
) {
  if (!cdrrmo(req, res)) return;
  if (!validRequestId(req.params.id)) {
    res.status(400).json({ error: "Invalid hazard ID." });
    return;
  }
  const { data, error } = await req.userSupabase!.rpc("archive_hazard", {
    p_kind: kind,
    p_id: req.params.id,
  });
  if (error) {
    res.status(503).json({
      error:
        "Could not archive the hazard. Check permissions and apply migration 0025_cdrrmo_hazard_archives.sql before retrying.",
    });
    return;
  }
  if (!data) {
    res.status(404).json({ error: "Hazard not found. Refresh the records." });
    return;
  }
  res.status(204).send();
}

export async function listHazardArchives(req: RoleAwareRequest, res: Response) {
  if (!cdrrmo(req, res)) return;
  const offset = Number(req.query.offset ?? 0);
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > 100000) {
    res.status(400).json({ error: "Invalid archive page." });
    return;
  }
  const { data, error } = await req
    .userSupabase!.from("hazard_archives")
    .select("id,hazard_type,original_id,snapshot,archived_at")
    .order("archived_at", { ascending: false })
    .order("id", { ascending: false })
    .range(offset, offset + 50);
  if (error) {
    res.status(503).json({
      error:
        "Could not load hazard archives. Apply migration 0025_cdrrmo_hazard_archives.sql and try again.",
    });
    return;
  }
  const graph = loadRoadGraph();
  res.json({
    archives: (data ?? []).slice(0, 50).map((row) => ({
      ...row,
      roadName:
        typeof row.snapshot?.road_id === "string"
          ? graph.edgesByRoadId(row.snapshot.road_id)[0]?.roadName
          : undefined,
    })),
    hasMore: (data?.length ?? 0) > 50,
  });
}

export async function restoreHazard(req: RoleAwareRequest, res: Response) {
  if (!cdrrmo(req, res)) return;
  if (!validRequestId(req.params.id) || req.body?.confirmed !== true) {
    res
      .status(400)
      .json({ error: "A valid archive ID and confirmation are required." });
    return;
  }
  const { data, error } = await req.userSupabase!.rpc("restore_hazard", {
    p_archive_id: req.params.id,
  });
  if (error) {
    res
      .status(error.code === "23505" || error.code === "23503" ? 409 : 503)
      .json({
        error:
          error.code === "23505"
            ? "This hazard already exists. The archive has been kept. Refresh before retrying."
            : error.code === "23503"
              ? "A linked record is missing. For older earthquake reports, restore the event first. The archive has been kept."
              : "Could not restore this hazard. The archive has been kept. Check permissions and database migrations.",
      });
    return;
  }
  if (!data) {
    res.status(404).json({ error: "Archive not found or already restored." });
    return;
  }
  res.status(204).send();
}

export async function deleteHazardArchive(
  req: RoleAwareRequest,
  res: Response,
) {
  if (!cdrrmo(req, res)) return;
  if (!validRequestId(req.params.id) || req.body?.confirmed !== true) {
    res.status(400).json({
      error:
        "A valid archive ID and explicit deletion confirmation are required.",
    });
    return;
  }
  const { data, error } = await req.userSupabase!.rpc("delete_hazard_archive", {
    p_archive_id: req.params.id,
    p_confirmed: true,
  });
  if (error) {
    res.status(503).json({
      error:
        "Could not confirm archive deletion. Refresh before retrying and check migration 0026_delete_hazard_archives.sql.",
    });
    return;
  }
  if (!data) {
    res
      .status(404)
      .json({ error: "Archive not found, already restored or deleted." });
    return;
  }
  res.status(204).send();
}

export async function deleteActiveHazard(req: RoleAwareRequest, res: Response) {
  if (!cdrrmo(req, res)) return;
  const kind = req.params.kind;
  if (
    !validRequestId(req.params.id) ||
    !["flood", "fire", "impact"].includes(String(kind)) ||
    req.body?.confirmed !== true
  ) {
    res
      .status(400)
      .json({
        error:
          "A valid hazard type, ID and explicit deletion confirmation are required.",
      });
    return;
  }
  const { data, error } = await req.userSupabase!.rpc("delete_active_hazard", {
    p_kind: kind,
    p_id: req.params.id,
    p_confirmed: true,
  });
  if (error) {
    res
      .status(503)
      .json({
        error:
          "Could not confirm permanent deletion. Refresh before retrying and check migration 0027_delete_active_hazards.sql.",
      });
    return;
  }
  if (!data) {
    res
      .status(404)
      .json({
        error: "Hazard not found or already removed. Refresh the records.",
      });
    return;
  }
  res.status(204).send();
}
