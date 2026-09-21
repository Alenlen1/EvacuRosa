export type FloodSeverity = "NONE" | "LOW" | "MODERATE" | "HIGH" | "SEVERE";
export type FloodReportStatus = "ACTIVE" | "MONITORING" | "RESOLVED";

export interface FloodReport {
  id: string;
  roadId: string;
  barangayId?: string | null;
  barangayName?: string;
  severity: FloodSeverity;
  waterLevelMeters?: number | null;
  /** The section-29 hard rule: only THIS triggers a routing BLOCKED
   * status. Severity alone never does. */
  roadImpassable: boolean;
  status: FloodReportStatus;
  notes?: string;
  reportedAt: string;
  updatedAt: string;
}
