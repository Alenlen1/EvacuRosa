export interface RawEarthquakeEvent {
  externalEventId: string;
  latitude: number;
  longitude: number;
  magnitude: number;
  depthKm: number | null;
  occurredAt: string; // ISO 8601
  source: string;
}

/** Isolates the external earthquake data source from the rest of the
 * system, per section 45 — swap the implementation without touching
 * anything that consumes EarthquakeEvent. */
export interface EarthquakeProvider {
  fetchRecentEarthquakes(): Promise<RawEarthquakeEvent[]>;
}
