export type AssistanceStatus =
  "PENDING" | "ACKNOWLEDGED" | "DISPATCHED" | "COMPLETED" | "CANCELLED";
export const ASSISTANCE_STATUSES: AssistanceStatus[] = [
  "PENDING",
  "ACKNOWLEDGED",
  "DISPATCHED",
  "COMPLETED",
  "CANCELLED",
];
export const ASSISTANCE_LABELS: Record<AssistanceStatus, string> = {
  PENDING: "Request Submitted",
  ACKNOWLEDGED: "Request Acknowledged",
  DISPATCHED: "Help Is on the Way",
  COMPLETED: "Assistance Completed",
  CANCELLED: "Cancelled",
};
export const ASSISTANCE_MESSAGES: Record<AssistanceStatus, string> = {
  PENDING:
    "Your emergency request has been submitted successfully. Waiting for CDRRMO acknowledgment.",
  ACKNOWLEDGED:
    "CDRRMO has received and acknowledged your emergency request. Your request is being reviewed. Assistance has not yet been dispatched.",
  DISPATCHED:
    "Help is on the way. CDRRMO has dispatched a response team to your reported location.",
  COMPLETED: "Your emergency assistance request has been marked as completed.",
  CANCELLED: "Your emergency assistance request has been cancelled.",
};
export interface AssistanceHistory {
  previous_status: AssistanceStatus | null;
  new_status: AssistanceStatus;
  version: number;
  changed_at: string;
  actor_kind: "PUBLIC_USER" | "CDRRMO" | "SYSTEM";
}
export interface TrackedRequest {
  id: string;
  status: AssistanceStatus;
  version: number;
  latitude: number;
  longitude: number;
  accuracy_meters: number;
  location_recorded_at: string;
  created_at: string;
  status_updated_at: string | null;
  tracking_expires_at?: string;
}
export interface TrackedAssistance {
  request: TrackedRequest;
  history: AssistanceHistory[];
}
export interface AssistanceCredentials {
  id: string;
  submissionKey?: string;
  trackingToken?: string;
  cached?: TrackedAssistance;
}
export const ASSISTANCE_STORAGE_KEY = "evacurosa-assistance-v1";
export const assistanceActive = (status: string) =>
  !["COMPLETED", "CANCELLED"].includes(status);
export function readAssistance(): AssistanceCredentials | null {
  try {
    const raw = localStorage.getItem(ASSISTANCE_STORAGE_KEY);
    if (!raw || raw.length > 50000) return null;
    const value = JSON.parse(raw);
    if (
      !/^[0-9a-f-]{36}$/i.test(value.id) ||
      (!/^[0-9a-f]{64}$/.test(value.submissionKey ?? "") &&
        !/^[A-Za-z0-9_-]{43}$/.test(value.trackingToken ?? ""))
    )
      return null;
    if (
      value.cached &&
      (!ASSISTANCE_STATUSES.includes(value.cached.request?.status) ||
        value.cached.request.id !== value.id ||
        !Number.isFinite(value.cached.request.latitude) ||
        !Number.isFinite(value.cached.request.longitude) ||
        !Number.isFinite(value.cached.request.accuracy_meters) ||
        !Number.isInteger(value.cached.request.version) ||
        value.cached.request.version < 1 ||
        !Array.isArray(value.cached.history))
    )
      delete value.cached;
    return value;
  } catch {
    return null;
  }
}
export function writeAssistance(value: AssistanceCredentials) {
  localStorage.setItem(ASSISTANCE_STORAGE_KEY, JSON.stringify(value));
}
export function newAssistanceCredentials(): AssistanceCredentials {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return {
    id: crypto.randomUUID(),
    submissionKey: Array.from(bytes, (b) =>
      b.toString(16).padStart(2, "0"),
    ).join(""),
  };
}
export function acceptAssistance(
  current: TrackedAssistance | null,
  next: TrackedAssistance,
) {
  return !current ||
    current.request.id !== next.request.id ||
    next.request.version >= current.request.version
    ? next
    : current;
}
// Authenticated fetch streaming keeps the tracking token out of URLs and logs.
export async function consumeAssistanceEvents(
  url: string,
  token: string,
  signal: AbortSignal,
  onChange: () => void,
  onConnection: (connected: boolean) => void,
) {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "text/event-stream" },
    cache: "no-store",
    signal,
  });
  if (!response.ok || !response.body)
    throw Error("Live connection unavailable");
  const reader = response.body.getReader(),
    decoder = new TextDecoder();
  let buffer = "";
  try {
    while (!signal.aborted) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      if (buffer.length > 65536) throw Error("Invalid event stream");
      let end;
      while ((end = buffer.indexOf("\n\n")) >= 0) {
        const block = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        for (const line of block.split("\n"))
          if (line.startsWith("data: ")) {
            const event = JSON.parse(line.slice(6));
            if (event.type === "changed") onChange();
            if (event.type === "connection") {
              onConnection(event.connected === true);
              if (event.connected) onChange();
            }
          }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
