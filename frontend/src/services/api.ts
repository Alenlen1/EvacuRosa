import type { AssistanceStatus, TrackedAssistance } from "@/lib/assistance";
export type { AssistanceStatus } from "@/lib/assistance";
import type { TravelMode } from "@/lib/travelTime";
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export class RoutingError extends Error {
  constructor(
    message: string,
    public readonly failureReason?: string,
  ) {
    super(message);
    this.name = "RoutingError";
  }
}

export interface AssistanceContext {
  kind: "route" | "evacuation" | "emergency";
  travelMode: TravelMode;
  destination?: LatLng;
}

export async function shareAssistanceLocation(
  data: AssistanceContext & {
    id: string;
    submissionKey: string;
    consent: true;
    start: LatLng;
    accuracy: number;
    recordedAt: string;
    name?: string;
    contact?: string;
  },
): Promise<TrackedAssistance & { id: string; trackingToken: string }> {
  const response = await fetch(`${API_URL}/api/assistance-requests`, {
    method: "POST",
    cache: "no-store",
    signal: AbortSignal.timeout(30000),
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  }).catch(() => {
    throw Error(
      "Submission could not be confirmed. Retry this request; it will not be duplicated. Use official emergency communication channels if urgent.",
    );
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(
      body.error ?? "Could not confirm submission. Please retry.",
    );
  return body;
}

export async function updateAssistanceStatus(
  token: string,
  id: string,
  status: AssistanceStatus,
  version: number,
  confirmed = false,
) {
  const response = await fetch(
    API_URL + "/api/admin/assistance-requests/" + encodeURIComponent(id),
    {
      method: "PATCH",
      cache: "no-store",
      signal: AbortSignal.timeout(30000),
      headers: {
        Authorization: "Bearer " + token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status, version, confirmed }),
    },
  ).catch(() => {
    throw Error(
      "Could not confirm the status update. Refresh before trying again.",
    );
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(
      body.error ?? "Could not update request status. Refresh and try again.",
    );
  return body.request as Pick<
    AssistanceRequest,
    "id" | "status" | "status_updated_at" | "version"
  >;
}

export interface AssistanceRequest {
  version: number;
  status: AssistanceStatus;
  status_updated_at: string | null;
  id: string;
  latitude: number;
  longitude: number;
  accuracy_meters: number;
  location_recorded_at: string;
  created_at: string;
  display_name: string | null;
  contact_number: string | null;
  travel_mode: TravelMode;
  route_kind: "route" | "evacuation" | "emergency";
  destination_latitude: number | null;
  destination_longitude: number | null;
  location_name?: { roadName: string; distanceMeters: number } | null;
  destination_name?: { roadName: string; distanceMeters: number } | null;
}

export async function deleteAssistanceRequest(
  token: string,
  id: string,
): Promise<void> {
  const response = await fetch(
    `${API_URL}/api/admin/assistance-requests/${encodeURIComponent(id)}`,
    {
      method: "DELETE",
      cache: "no-store",
      signal: AbortSignal.timeout(30000),
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(
      body.error ??
        "Could not confirm deletion. Refresh the list before trying again.",
    );
  }
}

export async function fetchAssistanceRequests(
  token: string,
  signal?: AbortSignal,
  status?: AssistanceStatus,
): Promise<AssistanceRequest[]> {
  const response = await fetch(
    `${API_URL}/api/admin/assistance-requests${status ? `?status=${status}` : ""}`,
    {
      cache: "no-store",
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(15000)])
        : AbortSignal.timeout(15000),
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  if (!response.ok)
    throw new Error(
      "Unable to load shared locations. Check your connection and CDRRMO access.",
    );
  return (await response.json()).requests;
}

export const assistanceEventsUrl = (id?: string) =>
  id
    ? `${API_URL}/api/assistance-requests/${encodeURIComponent(id)}/events`
    : `${API_URL}/api/admin/assistance-requests/events`;
export async function recoverAssistance(
  id: string,
  submissionKey: string,
  signal?: AbortSignal,
): Promise<(TrackedAssistance & { trackingToken: string }) | null> {
  const response = await fetch(
    `${API_URL}/api/assistance-requests/${encodeURIComponent(id)}/recover`,
    {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ submissionKey }),
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(15000)])
        : AbortSignal.timeout(15000),
    },
  );
  if (response.status === 404) return null;
  if (!response.ok) throw Error("Could not recover the previous submission.");
  return response.json();
}
export class AssistanceTrackingError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "AssistanceTrackingError";
  }
}
export async function fetchTrackedAssistance(
  id: string,
  token: string,
  signal?: AbortSignal,
): Promise<TrackedAssistance> {
  const response = await fetch(
    `${API_URL}/api/assistance-requests/${encodeURIComponent(id)}`,
    {
      cache: "no-store",
      headers: { Authorization: `Bearer ${token}` },
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(15000)])
        : AbortSignal.timeout(15000),
    },
  ).catch(() => {
    throw new AssistanceTrackingError(
      "Status could not be refreshed. The previous status may be outdated.",
      0,
    );
  });
  if (!response.ok)
    throw new AssistanceTrackingError(
      response.status === 404
        ? "Tracking is unavailable or expired. Use the official emergency contact."
        : "Status could not be refreshed. The previous status may be outdated.",
      response.status,
    );
  return response.json();
}
export async function cancelMyAssistance(
  id: string,
  token: string,
): Promise<TrackedAssistance> {
  const response = await fetch(
    `${API_URL}/api/assistance-requests/${encodeURIComponent(id)}/cancel`,
    {
      method: "POST",
      cache: "no-store",
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(20000),
    },
  ).catch(() => {
    throw Error(
      "Cancellation could not be confirmed. Check the latest status before retrying.",
    );
  });
  const body = await response.json();
  if (!response.ok)
    throw Error(body.error ?? "Cancellation could not be confirmed.");
  return body;
}
export async function fetchAssistanceDetails(
  token: string,
  id: string,
): Promise<TrackedAssistance> {
  const response = await fetch(
    `${API_URL}/api/admin/assistance-requests/${encodeURIComponent(id)}`,
    {
      cache: "no-store",
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15000),
    },
  );
  if (!response.ok) throw Error("Could not load request history.");
  return response.json();
}

export interface LatLng {
  latitude: number;
  longitude: number;
}

export interface RouteResponse {
  destinationApproach?: DestinationApproach;
  route: LatLng[];
  distance: number;
  affectedRoads: number;
  warnings: string[];
  riskLevel: string | null;
  updatedAt: string;
  source?: "online" | "offline";
}

export interface DestinationApproach {
  from: LatLng;
  to: LatLng;
  distanceMeters: number;
}

export async function fetchRoute(
  start: LatLng,
  destination: LatLng,
  travelMode: TravelMode = "walking",
): Promise<RouteResponse> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    const offline = await import("../lib/offline/routing");
    return offline.calculateOfflineRoute(start, destination, travelMode);
  }
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/route`, {
      method: "POST",
      signal: AbortSignal.timeout(12000),
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ start, destination, travelMode }),
    });
    if (res.status >= 500)
      throw new RoutingError("Routing server unavailable.");
  } catch {
    // A backend failure does not prove that saved hazards are current. Only
    // use the offline path when the browser actually reports disconnection.
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      const offline = await import("../lib/offline/routing");
      return offline.calculateOfflineRoute(start, destination, travelMode);
    }
    throw new RoutingError(
      "The routing server is unavailable. Current road closures could not be verified. Please retry shortly.",
    );
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new RoutingError(
      body.warnings?.[0] ?? body.error ?? "Could not calculate a route.",
      res.status === 422 ? body.failureReason : undefined,
    );
  }

  return res.json();
}

export type EvacuationCenterStatus =
  "AVAILABLE" | "NEARLY_FULL" | "FULL" | "CLOSED";

export interface EvacuationCenter {
  id: string;
  barangayId: string | null;
  barangayName?: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  capacity: number;
  currentOccupancy: number;
  status: EvacuationCenterStatus;
  waterStatus?: "unknown" | "adequate" | "low" | "unavailable";
  foodStatus?: "unknown" | "adequate" | "low" | "unavailable";
  medicalStatus?: "unknown" | "adequate" | "low" | "unavailable";
  suppliesUpdatedAt?: string | null;
  contactInformation?: string;
  entranceInformation?: string;
  notes?: string;
  updatedAt: string;
}

export async function fetchEvacuationCenters(): Promise<EvacuationCenter[]> {
  const res = await fetch(`${API_URL}/api/evacuation-centers`);
  if (!res.ok) throw new Error("Could not load evacuation centers.");
  const body = await res.json();
  return body.centers;
}

export interface EvacuationRouteResponse {
  destinationApproach?: DestinationApproach;
  recommendedCenter: EvacuationCenter;
  route: LatLng[];
  distance: number;
  riskLevel: string | null;
  warnings: string[];
  lastUpdated: string;
  source?: "online" | "offline";
}

export async function fetchEvacuationRoute(
  start: LatLng,
  travelMode: TravelMode = "walking",
): Promise<EvacuationRouteResponse> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    const offline = await import("../lib/offline/routing");
    return offline.calculateOfflineEvacuationRoute(start, travelMode);
  }
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/evacuation-route`, {
      method: "POST",
      signal: AbortSignal.timeout(12000),
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ start, travelMode }),
    });
    if (res.status >= 500)
      throw new RoutingError("Routing server unavailable.");
  } catch {
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      const offline = await import("../lib/offline/routing");
      return offline.calculateOfflineEvacuationRoute(start, travelMode);
    }
    throw new RoutingError(
      "The routing server is unavailable. Current road closures could not be verified. Please retry shortly.",
    );
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new RoutingError(
      body.warnings?.[0] ??
        body.error ??
        "Could not find an evacuation center.",
      res.status === 422 ? body.failureReason : undefined,
    );
  }

  return res.json();
}

export type FloodSeverity = "NONE" | "LOW" | "MODERATE" | "HIGH" | "SEVERE";

export interface FloodReport {
  id: string;
  roadId: string;
  affectedEdgeIds?: string[] | null;
  edgeRanges?:
    { edgeId: string; startFraction: number; endFraction: number }[] | null;
  barangayId?: string | null;
  barangayName?: string;
  severity: FloodSeverity;
  waterLevelMeters?: number | null;
  roadImpassable: boolean;
  status: string;
  notes?: string;
  reportedAt: string;
  updatedAt: string;
  affectedSegments: LatLng[][];
}

export async function fetchFloodReports(): Promise<FloodReport[]> {
  const res = await fetch(`${API_URL}/api/floods`);
  if (!res.ok) throw new Error("Could not load flood reports.");
  const body = await res.json();
  return body.reports;
}

export type FireSeverity = "LOW" | "MODERATE" | "HIGH" | "SEVERE";

export interface FireIncident {
  id: string;
  barangayId?: string | null;
  barangayName?: string;
  latitude: number;
  longitude: number;
  severity: FireSeverity;
  radiusMeters: number;
  status: string;
  confirmedBlockedRoadIds: string[];
  notes?: string;
  reportedAt: string;
  updatedAt: string;
}

export async function fetchFireIncidents(): Promise<FireIncident[]> {
  const res = await fetch(`${API_URL}/api/fires`);
  if (!res.ok) throw new Error("Could not load fire incidents.");
  const body = await res.json();
  return body.incidents;
}

export interface EarthquakeEvent {
  id: string;
  externalEventId: string;
  latitude: number;
  longitude: number;
  magnitude: number;
  depthKm?: number | null;
  occurredAt: string;
  createdAt?: string;
  source: string;
  status: string;
  notes?: string;
}

export interface EarthquakeRoadImpact {
  id: string;
  earthquakeEventId: string | null;
  roadId: string;
  impactLevel: string;
  confirmedBlocked: boolean;
  notes?: string;
  verifiedAt?: string;
  affectedSegments?: LatLng[][];
  affectedEdgeIds?: string[] | null;
  edgeRanges?:
    { edgeId: string; startFraction: number; endFraction: number }[] | null;
  impactArea?: EarthquakeImpactArea | null;
}

export interface EarthquakeImpactArea extends LatLng {
  radiusMeters: number;
}

export interface EarthquakeAreaRoad {
  roadId: string;
  roadName?: string;
  distanceMeters: number;
  affectedSegments: LatLng[][];
}

export async function fetchEarthquakeArea(
  area: EarthquakeImpactArea,
  signal?: AbortSignal,
): Promise<EarthquakeAreaRoad[]> {
  const query = new URLSearchParams({
    lat: String(area.latitude),
    lng: String(area.longitude),
    radius: String(area.radiusMeters),
  });
  const res = await fetch(`${API_URL}/api/roads/earthquake-area?${query}`, {
    signal,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "Could not preview affected roads.");
  }
  return (await res.json()).roads;
}

export async function fetchEarthquakes(): Promise<{
  events: EarthquakeEvent[];
  roadImpacts: EarthquakeRoadImpact[];
}> {
  const res = await fetch(`${API_URL}/api/earthquakes`);
  if (!res.ok) throw new Error("Could not load earthquake data.");
  return res.json();
}

export interface NearestRoad {
  roadId: string;
  roadName?: string;
  distanceMeters: number;
  affectedSegments?: LatLng[][];
}

export async function fetchNearestRoads(
  latitude: number,
  longitude: number,
  limit = 3,
  santaRosaOnly = false,
): Promise<NearestRoad[]> {
  const res = await fetch(
    `${API_URL}/api/roads/nearest?lat=${latitude}&lng=${longitude}&limit=${limit}${santaRosaOnly ? "&scope=santa-rosa" : ""}`,
  );
  if (!res.ok) throw new Error("Could not look up nearby roads.");
  const body = await res.json();
  return body.roads;
}

async function adminPost(path: string, token: string, body: unknown) {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.error ?? "Request failed.");
  }
  return res.json();
}

export function createFloodReport(
  token: string,
  data: {
    roadId: string;
    coverage?: "section" | "entire-road";
    sectionStart?: LatLng;
    sectionEnd?: LatLng;
    severity: FloodSeverity;
    waterLevelMeters?: number;
    roadImpassable: boolean;
    notes?: string;
  },
) {
  return adminPost("/api/admin/floods", token, data);
}

export interface FloodSectionPreview {
  edgeRanges: { edgeId: string; startFraction: number; endFraction: number }[];
  snappedStart: LatLng;
  snappedEnd: LatLng;
  edgeIds: string[];
  affectedSegments: LatLng[][];
  distanceMeters: number;
}

export async function fetchFloodSection(
  roadId: string,
  start: LatLng,
  end: LatLng,
  signal?: AbortSignal,
): Promise<FloodSectionPreview> {
  const query = new URLSearchParams({
    roadId,
    startLat: String(start.latitude),
    startLng: String(start.longitude),
    endLat: String(end.latitude),
    endLng: String(end.longitude),
  });
  const response = await fetch(`${API_URL}/api/roads/section?${query}`, {
    signal,
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error ?? "Could not preview the flooded section.");
  }
  return response.json();
}

export function createFireIncident(
  token: string,
  data: {
    latitude: number;
    longitude: number;
    severity: FireSeverity;
    radiusMeters: number;
    notes?: string;
  },
) {
  return adminPost("/api/admin/fires", token, data);
}

export function createEarthquakeRoadImpact(
  token: string,
  data: {
    earthquakeEventId?: string | null;
    roadId?: string;
    impactArea?: EarthquakeImpactArea;
    selectedRoadIds?: string[];
    impactLevel: "LOW" | "MODERATE" | "HIGH";
    confirmedBlocked: boolean;
    notes?: string;
  },
) {
  return adminPost("/api/admin/earthquake-road-impacts", token, data);
}

async function adminDelete(path: string, token: string): Promise<void> {
  const res = await fetch(`${API_URL}${path}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.error ?? "Could not remove this record.");
  }
}

export const deleteFloodReport = (token: string, id: string) =>
  adminDelete(`/api/admin/floods/${encodeURIComponent(id)}`, token);

export const deleteFireIncident = (token: string, id: string) =>
  adminDelete(`/api/admin/fires/${encodeURIComponent(id)}`, token);

export const deleteEarthquakeRoadImpact = (token: string, id: string) =>
  adminDelete(
    `/api/admin/earthquake-road-impacts/${encodeURIComponent(id)}`,
    token,
  );

export const deleteEarthquakeEvent = (token: string, id: string) =>
  adminDelete(`/api/admin/earthquakes/${encodeURIComponent(id)}`, token);
