export type FloodSeverity = "NONE" | "LOW" | "MODERATE" | "HIGH" | "SEVERE";
export type FloodReportStatus = "ACTIVE" | "MONITORING" | "RESOLVED";

export interface FloodReport {
  id: string;
  roadId: string;
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
