"use client";

import { idbGet, idbSet } from "./indexedDb";
import type {
  EvacuationCenter,
  FloodReport,
  FireIncident,
  EarthquakeEvent,
  EarthquakeRoadImpact,
} from "@/services/api";

export interface CachedValue<T> {
  data: T;
  cachedAt: string;
}

const KEYS = {
  evacuationCenters: "evacuationCenters",
  floodReports: "floodReports",
  fireIncidents: "fireIncidents",
  earthquakeEvents: "earthquakeEvents",
  earthquakeRoadImpacts: "earthquakeRoadImpacts",
} as const;

// Only public, non-admin data is ever cached here (section 43/47's rule) —
// there is deliberately no cache function for admin session data, profile
// info, or anything from the /admin/* routes.

export const cacheEvacuationCenters = (data: EvacuationCenter[]) =>
  idbSet(KEYS.evacuationCenters, data);
export const getCachedEvacuationCenters = () =>
  idbGet<EvacuationCenter[]>(KEYS.evacuationCenters);

export const cacheFloodReports = (data: FloodReport[]) => idbSet(KEYS.floodReports, data);
export const getCachedFloodReports = () => idbGet<FloodReport[]>(KEYS.floodReports);

export const cacheFireIncidents = (data: FireIncident[]) => idbSet(KEYS.fireIncidents, data);
export const getCachedFireIncidents = () => idbGet<FireIncident[]>(KEYS.fireIncidents);

export const cacheEarthquakeEvents = (data: EarthquakeEvent[]) =>
  idbSet(KEYS.earthquakeEvents, data);
export const getCachedEarthquakeEvents = () => idbGet<EarthquakeEvent[]>(KEYS.earthquakeEvents);

export const cacheEarthquakeRoadImpacts = (data: EarthquakeRoadImpact[]) =>
  idbSet(KEYS.earthquakeRoadImpacts, data);
export const getCachedEarthquakeRoadImpacts = () =>
  idbGet<EarthquakeRoadImpact[]>(KEYS.earthquakeRoadImpacts);
