export type EarthquakeEventStatus = "UNREVIEWED" | "REVIEWED" | "ARCHIVED";
export type EarthquakeImpactLevel = "LOW" | "MODERATE" | "HIGH";

export interface EarthquakeEvent {
  id: string;
  externalEventId: string;
  latitude: number;
  longitude: number;
  magnitude: number;
  depthKm?: number | null;
  occurredAt: string;
  source: string;
  status: EarthquakeEventStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

/** The ONLY thing that ever feeds earthquake data into routing. No row for
 * a road means that road is unaffected — raw magnitude/depth never imply
 * damage on their own (section 31's explicit rule). */
export interface EarthquakeRoadImpact {
  id: string;
  earthquakeEventId: string;
  roadId: string;
  impactLevel: EarthquakeImpactLevel;
  confirmedBlocked: boolean;
  notes?: string;
  verifiedAt: string;
}
