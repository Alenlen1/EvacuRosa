export type FireSeverity = "LOW" | "MODERATE" | "HIGH" | "SEVERE";
export type FireIncidentStatus = "ACTIVE" | "CONTAINED" | "RESOLVED";

export interface FireIncident {
  id: string;
  barangayId?: string | null;
  barangayName?: string;
  latitude: number;
  longitude: number;
  severity: FireSeverity;
  radiusMeters: number;
  status: FireIncidentStatus;
  /** Section 30's hard rule, mirrored from flood: proximity alone never
   * blocks a road. Only a roadId explicitly confirmed here does. */
  confirmedBlockedRoadIds: string[];
  notes?: string;
  reportedAt: string;
  updatedAt: string;
}
