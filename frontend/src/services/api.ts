import type { TravelMode } from "@/lib/travelTime";
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export interface LatLng {
  latitude: number;
  longitude: number;
}

export interface RouteResponse {
  route: LatLng[];
  distance: number;
  affectedRoads: number;
  warnings: string[];
  riskLevel: string | null;
  updatedAt: string;
}

export async function fetchRoute(
  start: LatLng,
  destination: LatLng,
  travelMode: TravelMode = "walking"
): Promise<RouteResponse> {
  const res = await fetch(`${API_URL}/api/route`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ start, destination, travelMode }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      body.warnings?.[0] ?? body.error ?? "Could not calculate a route."
    );
  }

  return res.json();
}

export type EvacuationCenterStatus = "AVAILABLE" | "NEARLY_FULL" | "FULL" | "CLOSED";

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
  contactInformation?: string;
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
  recommendedCenter: EvacuationCenter;
  route: LatLng[];
  distance: number;
  riskLevel: string | null;
  warnings: string[];
  lastUpdated: string;
}

export async function fetchEvacuationRoute(
  start: LatLng,
  travelMode: TravelMode = "walking"
): Promise<EvacuationRouteResponse> {
  const res = await fetch(`${API_URL}/api/evacuation-route`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ start, travelMode }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      body.warnings?.[0] ?? body.error ?? "Could not find an evacuation center."
    );
  }

  return res.json();
}

export type FloodSeverity = "NONE" | "LOW" | "MODERATE" | "HIGH" | "SEVERE";

export interface FloodReport {
  id: string;
  roadId: string;
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
  source: string;
  status: string;
  notes?: string;
}

export interface EarthquakeRoadImpact {
  id: string;
  earthquakeEventId: string;
  roadId: string;
  impactLevel: string;
  confirmedBlocked: boolean;
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
}

export async function fetchNearestRoads(
  latitude: number,
  longitude: number,
  limit = 3
): Promise<NearestRoad[]> {
  const res = await fetch(
    `${API_URL}/api/roads/nearest?lat=${latitude}&lng=${longitude}&limit=${limit}`
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
    severity: FloodSeverity;
    waterLevelMeters?: number;
    roadImpassable: boolean;
    notes?: string;
  }
) {
  return adminPost("/api/admin/floods", token, data);
}

export function createFireIncident(
  token: string,
  data: {
    latitude: number;
    longitude: number;
    severity: FireSeverity;
    radiusMeters: number;
    notes?: string;
  }
) {
  return adminPost("/api/admin/fires", token, data);
}

export function createEarthquakeRoadImpact(
  token: string,
  data: {
    earthquakeEventId: string;
    roadId: string;
    impactLevel: "LOW" | "MODERATE" | "HIGH";
    confirmedBlocked: boolean;
    notes?: string;
  }
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
  adminDelete(`/api/admin/earthquake-road-impacts/${encodeURIComponent(id)}`, token);

export const deleteEarthquakeEvent = (token: string, id: string) =>
  adminDelete(`/api/admin/earthquakes/${encodeURIComponent(id)}`, token);
