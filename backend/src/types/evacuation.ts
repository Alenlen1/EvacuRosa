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
  waterStatus?: "unknown" | "adequate" | "low" | "unavailable";
  foodStatus?: "unknown" | "adequate" | "low" | "unavailable";
  medicalStatus?: "unknown" | "adequate" | "low" | "unavailable";
  suppliesUpdatedAt?: string | null;
  contactInformation?: string;
  notes?: string;
  updatedAt: string;
}
