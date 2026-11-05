import type { FloodEdgeRange } from "./flood";
import type { EarthquakeImpactArea } from "../algorithms/earthquakeArea";

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

/** Only records associated with a road feed verified damage into routing.
 * Area-only records and raw magnitude/depth never imply road damage. */
export interface EarthquakeRoadImpact {
  id: string;
  earthquakeEventId: string | null;
  /** Null identifies an informational footprint with no road routing effect. */
  roadId: string | null;
  affectedEdgeIds?: string[] | null;
  edgeRanges?: FloodEdgeRange[] | null;
  impactArea?: EarthquakeImpactArea | null;
  impactLevel: EarthquakeImpactLevel;
  confirmedBlocked: boolean;
  notes?: string;
  verifiedAt: string;
}
