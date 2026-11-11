"use client";

import { useMemo } from "react";
import type { ManagedCenter } from "./CenterManager";
import type { EvacuationCenter } from "@/services/api";
import { BarangayEvacuationOverview } from "./BarangayEvacuationOverview";

export function BarangayAssignedMap({
  centers,
  barangayId,
  barangayName,
  loading,
  error,
  onRefresh,
}: {
  centers: (ManagedCenter & { updated_at?: string | null })[];
  barangayId: string;
  barangayName: string;
  loading: boolean;
  error: string;
  onRefresh: () => void;
}) {
  const focusedBarangay = useMemo(
    () => ({ id: barangayId, name: barangayName }),
    [barangayId, barangayName],
  );
  // Use the same authenticated center snapshot as the occupancy cards.
  // No citywide request or editable location markers are needed here.
  const mapCenters = useMemo<EvacuationCenter[]>(
    () =>
      centers
        .filter((center) => center.barangay_id === barangayId)
        .map((center) => ({
          id: center.id,
          barangayId: center.barangay_id,
          barangayName,
          name: center.name,
          address: center.address,
          latitude: center.latitude,
          longitude: center.longitude,
          capacity: center.capacity,
          currentOccupancy: center.current_occupancy,
          status: (["AVAILABLE", "NEARLY_FULL", "FULL"] as string[]).includes(
            center.status,
          )
            ? (center.status as EvacuationCenter["status"])
            : "CLOSED",
          contactInformation: center.contact_information,
          updatedAt: center.updated_at ?? "",
        })),
    [centers, barangayId, barangayName],
  );
  return (
    <div id="barangay-map" className="barangay-workspace-map">
      <BarangayEvacuationOverview
        focusedBarangay={focusedBarangay}
        centers={mapCenters}
        loading={loading}
        error={error}
        onRefresh={onRefresh}
      />
    </div>
  );
}
