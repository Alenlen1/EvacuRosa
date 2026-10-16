export type FloodSeverity = "NONE" | "LOW" | "MODERATE" | "HIGH" | "SEVERE";
export type FloodReportStatus = "ACTIVE" | "MONITORING" | "RESOLVED";

export interface FloodEdgeRange {
  edgeId: string;
  startFraction: number;
  endFraction: number;
}

export interface FloodReport {
  id: string;
  roadId: string;
  /** null/absent means the entire mapped road (including legacy reports). */
  affectedEdgeIds?: string[] | null;
  /** Exact covered interval on each forward edge. Absent for older reports. */
  edgeRanges?: FloodEdgeRange[] | null;
  barangayId?: string | null;
  barangayName?: string;
  severity: FloodSeverity;
  waterLevelMeters?: number | null;
  /** Derived from severity: HIGH/SEVERE block routing. */
  roadImpassable: boolean;
  status: FloodReportStatus;
  notes?: string;
  reportedAt: string;
  updatedAt: string;
}
