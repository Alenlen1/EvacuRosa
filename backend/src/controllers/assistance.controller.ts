import type { Request, Response } from "express";
import type { RoleAwareRequest } from "../middleware/role.middleware";
import { getSupabase } from "../database/supabase";
import { isTravelMode, type TravelMode } from "../algorithms/astar/access";
import { createAssistanceLocationLookup } from "../services/assistanceLocation.service";
import {
  assistanceHistory,
  assistanceStatuses,
  assistanceStream,
  issueTrackingToken,
  notifyAssistance,
  ownedAssistance,
  privateResponse,
  requestColumns,
  trackingHash,
  validRequestId,
} from "../services/assistanceTracking.service";

interface Submission {
  id: string;
  submissionKey: string;
  consent: true;
  start: { latitude: number; longitude: number };
  accuracy: number;
  recordedAt: string;
  name?: string;
  contact?: string;
  travelMode: TravelMode;
  kind: "route" | "evacuation" | "emergency";
  destination?: { latitude: number; longitude: number };
}
function point(value: unknown): value is Submission["start"] {
  if (!value || typeof value !== "object") return false;
  const p = value as Submission["start"];
  return (
    Number.isFinite(p.latitude) &&
    Number.isFinite(p.longitude) &&
    Math.abs(p.latitude) <= 90 &&
    Math.abs(p.longitude) <= 180
  );
}
export function validSubmission(
  value: unknown,
  now = Date.now(),
): value is Submission {
  if (!value || typeof value !== "object") return false;
  const v = value as Submission;
  const age =
    typeof v.recordedAt === "string" ? now - Date.parse(v.recordedAt) : NaN;
  return (
    validRequestId(v.id) &&
    typeof v.submissionKey === "string" &&
    /^[0-9a-f]{64}$/.test(v.submissionKey) &&
    v.consent === true &&
    point(v.start) &&
    isTravelMode(v.travelMode) &&
    Number.isFinite(v.accuracy) &&
    v.accuracy >= 0 &&
    v.accuracy <= 100000 &&
    Number.isFinite(age) &&
    age >= -30000 &&
    age <= 120000 &&
    (v.name === undefined ||
      (typeof v.name === "string" && v.name.length <= 100)) &&
    (v.contact === undefined ||
      (typeof v.contact === "string" &&
        /^[0-9+() .-]{0,40}$/.test(v.contact))) &&
    ((v.kind === "route" && point(v.destination)) ||
      (["evacuation", "emergency"].includes(v.kind) &&
        v.destination === undefined))
  );
}
const attempts = new Map<string, { count: number; expires: number }>();
export function allowSubmission(ip: string, now = Date.now(), limit = 5) {
  for (const [key, entry] of attempts)
    if (entry.expires <= now) attempts.delete(key);
  const previous = attempts.get(ip);
  if (previous) return ++previous.count <= limit;
  if (attempts.size >= 10000) return false;
  attempts.set(ip, { count: 1, expires: now + 15 * 60_000 });
  return true;
}
export async function postAssistance(req: Request, res: Response) {
  privateResponse(res);
  if (
    !allowSubmission(`all:${req.ip ?? "unknown"}`, Date.now(), 60) ||
    !allowSubmission(
      `request:${req.ip ?? "unknown"}:${String(req.body?.id).slice(0, 36)}`,
    )
  ) {
    res.status(429).json({
      error:
        "Too many assistance submissions. Use the official emergency contact if urgent.",
    });
    return;
  }
  if (!validSubmission(req.body)) {
    res.status(400).json({
      error:
        "Explicit consent, a fresh GPS location and valid request details are required.",
    });
    return;
  }
  const db = getSupabase();
  if (!db) {
    res.status(503).json({
      error:
        "Assistance submission is unavailable. Use the official emergency contact.",
    });
    return;
  }
  const v = req.body;
  try {
    const token = issueTrackingToken(v.id, v.submissionKey);
    const { data, error } = await db.rpc("create_tracked_assistance", {
      p_request: {
        id: v.id,
        latitude: v.start.latitude,
        longitude: v.start.longitude,
        accuracy_meters: v.accuracy,
        location_recorded_at: v.recordedAt,
        display_name: v.name?.trim() || null,
        contact_number: v.contact?.trim() || null,
        travel_mode: v.travelMode,
        route_kind: v.kind,
        destination_latitude: v.destination?.latitude ?? null,
        destination_longitude: v.destination?.longitude ?? null,
        reason: "EMERGENCY",
      },
      p_token_hash: trackingHash(token),
    });
    if (error || !data) throw Error("Save failed");
    if (Date.parse(data.tracking_expires_at) <= Date.now())
      throw Error("Tracking expired");
    const history = await assistanceHistory(v.id, db, data.version);
    const safeRequest = Object.fromEntries(
      [...requestColumns.split(","), "tracking_expires_at"].map((key) => [
        key,
        data[key],
      ]),
    );
    notifyAssistance(v.id, data.version);
    res.status(201).json({
      id: data.id,
      trackingToken: token,
      request: safeRequest,
      history,
    });
  } catch {
    res.status(503).json({
      error:
        "Submission could not be confirmed. Retry this request; it will not be duplicated. Use the official emergency contact if urgent.",
    });
  }
}
export async function recoverTrackedAssistance(req: Request, res: Response) {
  privateResponse(res);
  if (
    !validRequestId(req.params.id) ||
    typeof req.body?.submissionKey !== "string" ||
    !/^[0-9a-f]{64}$/.test(req.body.submissionKey)
  ) {
    res.status(400).json({ error: "Invalid recovery details." });
    return;
  }
  try {
    const token = issueTrackingToken(req.params.id, req.body.submissionKey);
    req.headers.authorization = `Bearer ${token}`;
    const request = await ownedAssistance(req);
    if (!request) {
      res.status(404).json({
        error: "No saved request was confirmed. Retry the same submission.",
      });
      return;
    }
    res.json({
      trackingToken: token,
      request,
      history: await assistanceHistory(request.id, undefined, request.version),
    });
  } catch {
    res.status(503).json({
      error: "Submission recovery is unavailable. Retry the same request.",
    });
  }
}
export async function getTrackedAssistance(req: Request, res: Response) {
  privateResponse(res);
  try {
    const request = await ownedAssistance(req);
    if (!request) {
      res.status(404).json({
        error:
          "Tracking is unavailable or expired. Use the official emergency contact.",
      });
      return;
    }
    res.json({
      request,
      history: await assistanceHistory(request.id, undefined, request.version),
    });
  } catch {
    res.status(503).json({
      error:
        "Could not refresh your assistance status. The previous status may be outdated.",
    });
  }
}
export async function cancelTrackedAssistance(req: Request, res: Response) {
  privateResponse(res);
  try {
    const request = await ownedAssistance(req);
    if (!request) {
      res.status(404).json({ error: "Tracking is unavailable or expired." });
      return;
    }
    if (!["PENDING", "ACKNOWLEDGED", "DISPATCHED"].includes(request.status)) {
      res.status(409).json({ error: "This request is already closed." });
      return;
    }
    const { data, error } = await getSupabase()!
      .from("assistance_requests")
      .update({ status: "CANCELLED" })
      .eq("id", request.id)
      .eq("version", request.version)
      .eq("status", request.status)
      .select(requestColumns)
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      res.status(409).json({
        error: "The request changed. Refresh its status before cancelling.",
      });
      return;
    }
    notifyAssistance(data.id, data.version);
    res.json({
      request: data,
      history: await assistanceHistory(data.id, undefined, data.version),
    });
  } catch {
    res.status(503).json({
      error:
        "Cancellation could not be confirmed. Check the latest status before trying again.",
    });
  }
}
export async function publicAssistanceEvents(req: Request, res: Response) {
  privateResponse(res);
  try {
    const request = await ownedAssistance(req);
    if (!request) {
      res.status(404).json({ error: "Tracking unavailable or expired." });
      return;
    }
    assistanceStream(req, res, request.id, request.tracking_expires_at);
  } catch {
    res.status(503).json({
      error: "Live updates unavailable. Automatic status checks will continue.",
    });
  }
}
export async function adminAssistanceEvents(
  req: RoleAwareRequest,
  res: Response,
) {
  if (req.profile?.role !== "SUPER_ADMIN") {
    res.status(403).json({ error: "CDRRMO access required." });
    return;
  }
  assistanceStream(req, res, "*");
}
export async function listAssistance(req: RoleAwareRequest, res: Response) {
  privateResponse(res);
  if (!req.userSupabase || req.profile?.role !== "SUPER_ADMIN") {
    res.status(403).json({ error: "CDRRMO access required." });
    return;
  }
  let query = req.userSupabase
    .from("assistance_requests")
    .select(requestColumns)
    .order("created_at", { ascending: false })
    .limit(100);
  if (req.query.status) {
    if (!assistanceStatuses.includes(req.query.status as never)) {
      res.status(400).json({ error: "Invalid status filter." });
      return;
    }
    query = query.eq("status", req.query.status);
  }
  const { data, error } = await query;
  if (error) {
    res.status(503).json({ error: "Could not load assistance requests." });
    return;
  }
  const locationName = createAssistanceLocationLookup();
  res.json({
    requests: (data ?? []).map((row) => ({
      ...row,
      location_name: locationName(row.latitude, row.longitude),
      destination_name: locationName(
        row.destination_latitude,
        row.destination_longitude,
      ),
    })),
  });
}
export async function getAdminAssistance(req: RoleAwareRequest, res: Response) {
  privateResponse(res);
  if (!req.userSupabase || req.profile?.role !== "SUPER_ADMIN") {
    res.status(403).json({ error: "CDRRMO access required." });
    return;
  }
  if (!validRequestId(req.params.id)) {
    res.status(400).json({ error: "Invalid request ID." });
    return;
  }
  const { data, error } = await req.userSupabase
    .from("assistance_requests")
    .select(requestColumns)
    .eq("id", req.params.id)
    .maybeSingle();
  if (error) {
    res.status(503).json({ error: "Could not load assistance details." });
    return;
  }
  if (!data) {
    res.status(404).json({ error: "Request not found." });
    return;
  }
  try {
    res.json({
      request: data,
      history: await assistanceHistory(data.id, req.userSupabase, data.version),
    });
  } catch {
    res.status(503).json({ error: "Could not load status history." });
  }
}
export async function updateAssistanceStatus(
  req: RoleAwareRequest,
  res: Response,
) {
  privateResponse(res);
  if (!req.userSupabase || req.profile?.role !== "SUPER_ADMIN") {
    res.status(403).json({ error: "CDRRMO access required." });
    return;
  }
  const id = req.params.id,
    status = req.body?.status,
    version = req.body?.version;
  if (
    !validRequestId(id) ||
    !["ACKNOWLEDGED", "DISPATCHED", "COMPLETED", "CANCELLED"].includes(
      status,
    ) ||
    !Number.isInteger(version) ||
    version < 1 ||
    (["DISPATCHED", "COMPLETED", "CANCELLED"].includes(status) &&
      req.body?.confirmed !== true)
  ) {
    res.status(400).json({
      error:
        "A valid request, current version and explicit action confirmation are required.",
    });
    return;
  }
  try {
    const { data, error } = await req.userSupabase
      .from("assistance_requests")
      .update({ status })
      .eq("id", id)
      .eq("version", version)
      .in(
        "status",
        status === "ACKNOWLEDGED"
          ? ["PENDING"]
          : status === "DISPATCHED"
            ? ["ACKNOWLEDGED"]
            : status === "COMPLETED"
              ? ["DISPATCHED"]
              : ["PENDING", "ACKNOWLEDGED", "DISPATCHED"],
      )
      .select(requestColumns)
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      res.status(409).json({
        error:
          "The request changed or this status transition is not allowed. Refresh before updating.",
      });
      return;
    }
    notifyAssistance(data.id, data.version);
    res.json({ request: data });
  } catch {
    res.status(503).json({
      error: "Could not confirm status update. Refresh before trying again.",
    });
  }
}
export async function deleteAssistance(req: RoleAwareRequest, res: Response) {
  privateResponse(res);
  if (!req.userSupabase || req.profile?.role !== "SUPER_ADMIN") {
    res.status(403).json({ error: "CDRRMO access required." });
    return;
  }
  if (!validRequestId(req.params.id)) {
    res.status(400).json({ error: "Invalid assistance request ID." });
    return;
  }
  const { data, error } = await req.userSupabase
    .from("assistance_requests")
    .delete()
    .eq("id", req.params.id)
    .in("status", ["COMPLETED", "CANCELLED"])
    .select("id");
  if (error) {
    res.status(503).json({ error: "Could not confirm deletion." });
    return;
  }
  if (!data?.length) {
    res
      .status(409)
      .json({ error: "Only completed or cancelled requests can be deleted." });
    return;
  }
  notifyAssistance(req.params.id);
  res.status(204).end();
}
