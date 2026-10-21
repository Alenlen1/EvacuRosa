import { createHmac, createHash } from "node:crypto";
import type { Request, Response } from "express";
import { getSupabase } from "../database/supabase";

export const assistanceStatuses = [
  "PENDING",
  "ACKNOWLEDGED",
  "DISPATCHED",
  "COMPLETED",
  "CANCELLED",
] as const;
export type AssistanceStatus = (typeof assistanceStatuses)[number];
export const activeAssistance = (status: string) =>
  !["COMPLETED", "CANCELLED"].includes(status);
export const validRequestId = (id: unknown): id is string =>
  typeof id === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    id,
  );
export const requestColumns =
  "id,latitude,longitude,accuracy_meters,location_recorded_at,display_name,contact_number,travel_mode,route_kind,destination_latitude,destination_longitude,created_at,status,status_updated_at,version,acknowledged_at,dispatched_at,completed_at,cancelled_at";
export function privateResponse(res: Response) {
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Referrer-Policy", "no-referrer");
}
export function issueTrackingToken(id: string, submissionKey: string) {
  const secret = process.env.ASSISTANCE_TRACKING_SECRET;
  if (!secret || Buffer.byteLength(secret) < 32)
    throw Error("Tracking configuration is unavailable.");
  return createHmac("sha256", secret)
    .update(`assistance-v1:${id}:${submissionKey}`)
    .digest("base64url");
}
export const trackingHash = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export async function ownedAssistance(req: Request) {
  const db = getSupabase();
  const id = req.params.id;
  const authorization = req.headers.authorization ?? "";
  const token = authorization.startsWith("Bearer ")
    ? authorization.slice(7)
    : "";
  if (!db) throw Error("Tracking database is unavailable.");
  if (!validRequestId(id) || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const { data, error } = await db
    .from("assistance_requests")
    .select(`${requestColumns},tracking_expires_at`)
    .eq("id", id)
    .eq("tracking_token_hash", trackingHash(token))
    .maybeSingle();
  if (error) throw Error("Could not retrieve the request.");
  if (!data || Date.parse(data.tracking_expires_at) <= Date.now()) return null;
  return data;
}
export async function assistanceHistory(
  id: string,
  client = getSupabase(),
  version?: number,
) {
  if (!client) throw Error("Unavailable");
  let query = client
    .from("assistance_status_history")
    .select("previous_status,new_status,version,changed_at,actor_kind")
    .eq("request_id", id);
  if (version !== undefined) query = query.lte("version", version);
  const { data, error } = await query.order("version");
  if (error) throw Error("Could not load request history.");
  return data ?? [];
}

type Notice =
  | { type: "changed"; id: string; version?: number }
  | { type: "connection"; connected: boolean };
type Listener = (notice: Notice) => void;
const listeners = new Map<string, Set<Listener>>();
let channel: ReturnType<
  NonNullable<ReturnType<typeof getSupabase>>["channel"]
> | null = null;
let connected = false;
export function notifyAssistance(id: string, version?: number) {
  for (const scope of [id, "*"])
    for (const callback of listeners.get(scope) ?? [])
      callback({ type: "changed", id, version });
}
function connectionNotice(value: boolean) {
  connected = value;
  for (const set of listeners.values())
    for (const callback of set)
      callback({ type: "connection", connected: value });
}
export function subscribeAssistance(scope: string, callback: Listener) {
  const set = listeners.get(scope) ?? new Set<Listener>();
  set.add(callback);
  listeners.set(scope, set);
  callback({ type: "connection", connected });
  if (!channel) {
    const db = getSupabase();
    if (db) {
      channel = db
        .channel("backend-private-assistance")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "assistance_requests" },
          (payload) => {
            const row = (
              payload.eventType === "DELETE" ? payload.old : payload.new
            ) as { id?: string; version?: number };
            if (row.id) notifyAssistance(row.id, row.version);
          },
        )
        .subscribe((status) => connectionNotice(status === "SUBSCRIBED"));
    }
  }
  return () => {
    set.delete(callback);
    if (!set.size) listeners.delete(scope);
    if (!listeners.size && channel) {
      const old = channel;
      channel = null;
      connected = false;
      void getSupabase()?.removeChannel(old);
    }
  };
}
const streamsPerScope = new Map<string, number>();
export function assistanceStream(
  req: Request,
  res: Response,
  scope: string,
  expiresAt?: string,
) {
  // Bound long-lived sockets for each private request and globally.
  if (
    (streamsPerScope.get(scope) ?? 0) >= 3 ||
    [...streamsPerScope.values()].reduce((a, b) => a + b, 0) >= 500
  ) {
    res.status(429).json({
      error:
        "Too many tracking connections. Automatic status checks will continue.",
    });
    return;
  }
  streamsPerScope.set(scope, (streamsPerScope.get(scope) ?? 0) + 1);
  privateResponse(res);
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();
  let closed = false;
  const send = (data: Notice) => {
    if (!closed && !res.write(`data: ${JSON.stringify(data)}\n\n`)) cleanup();
  };
  let unsubscribe = () => {};
  const cleanup = () => {
    if (closed) return;
    closed = true;
    clearInterval(heartbeat);
    clearTimeout(lifetime);
    unsubscribe();
    const n = (streamsPerScope.get(scope) ?? 1) - 1;
    if (n) streamsPerScope.set(scope, n);
    else streamsPerScope.delete(scope);
    res.end();
  };
  const heartbeat = setInterval(() => {
    if (expiresAt && Date.parse(expiresAt) <= Date.now()) {
      cleanup();
      return;
    }
    if (!res.write(": heartbeat\n\n")) cleanup();
  }, 20000);
  // Renew authorization regularly, including for staff whose role may be revoked.
  const lifetime = setTimeout(cleanup, 5 * 60_000);
  unsubscribe = subscribeAssistance(scope, send);
  if (closed) unsubscribe();
  res.on("close", cleanup);
  res.on("error", cleanup);
}
