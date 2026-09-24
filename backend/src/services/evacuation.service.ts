import { getSupabase } from "../database/supabase";
import type { EvacuationCenter, EvacuationCenterStatus } from "../types/evacuation";

/** Occupancy-driven status, per the project spec's thresholds — a manual
 * CLOSED always wins regardless of occupancy. */
export function deriveStatus(
  currentOccupancy: number,
  capacity: number,
  manualStatus?: string
): EvacuationCenterStatus {
  if (manualStatus === "CLOSED") return "CLOSED";
  if (capacity <= 0) return "CLOSED";
  const pct = (currentOccupancy / capacity) * 100;
  if (pct >= 90) return "FULL";
  if (pct >= 70) return "NEARLY_FULL";
  return "AVAILABLE";
}

export async function getAllCenters(): Promise<EvacuationCenter[]> {
  const supabase = getSupabase();
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from("evacuation_centers")
    .select(
      "id, barangay_id, name, address, latitude, longitude, capacity, current_occupancy, status, contact_information, notes, updated_at, barangays(name)"
    );

  if (error) {
    throw new Error(`Could not load evacuation centers: ${error.message}`);
  }

  return (data ?? []).map((row: any) => ({
    id: row.id,
    barangayId: row.barangay_id,
    barangayName: row.barangays?.name,
    name: row.name,
    address: row.address,
    latitude: row.latitude,
    longitude: row.longitude,
    capacity: row.capacity,
    currentOccupancy: row.current_occupancy,
    status: deriveStatus(row.current_occupancy, row.capacity, row.status),
    contactInformation: row.contact_information,
    notes: row.notes,
    updatedAt: row.updated_at,
  }));
}

export async function getAvailableCenters(): Promise<EvacuationCenter[]> {
  const all = await getAllCenters();
  return all.filter((c) => c.status !== "FULL" && c.status !== "CLOSED");
}
