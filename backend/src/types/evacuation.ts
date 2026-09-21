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
