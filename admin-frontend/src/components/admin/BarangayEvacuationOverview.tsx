"use client";

import dynamic from "next/dynamic";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { EvacuationCenter } from "@/services/api";
import { findBarangayLocation } from "@/lib/barangayLocations";

const AdminEvacuationMap = dynamic(() => import("./AdminEvacuationMap"), {
  ssr: false,
  loading: () => <p role="status">Loading evacuation map...</p>,
});
const EMPTY_CENTERS: EvacuationCenter[] = [];

export function BarangayEvacuationOverview({
  focusedBarangay,
  centers,
  loading,
  error,
  onRefresh,
}: {
  focusedBarangay?: { id: string; name: string } | null;
  centers: EvacuationCenter[] | null;
  loading: boolean;
  error: string;
  onRefresh: () => void;
}) {
  const location = focusedBarangay
    ? findBarangayLocation(focusedBarangay.name)
    : undefined;

  return (
    <section className="barangay-overview" aria-labelledby="barangay-map-title">
      <div className="barangay-overview-heading">
        <div>
          <h2 id="barangay-map-title">City evacuation centers</h2>
          <p>
            View all registered centers across Santa Rosa. Select a marker for
            its address, occupancy and availability.
          </p>
        </div>
        <button
          type="button"
          className="secondary-button"
          disabled={loading}
          onClick={onRefresh}
        >
          {loading ? "Refreshing..." : "Refresh map"}
        </button>
      </div>
      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}
      <p className="barangay-map-focus-caption" role="status" aria-live="polite">
        {location
          ? `Showing ${location.name} on the map. The pin marks the barangay area.`
          : "Showing the Santa Rosa city overview."}
      </p>
      <AdminEvacuationMap
        centers={centers ?? EMPTY_CENTERS}
        focusedBarangay={focusedBarangay}
      />
      {centers !== null ? (
        <>
          <div
            className="barangay-overview-legend"
            aria-label="Evacuation center status legend"
          >
            <span>{centers.length} evacuation centers</span>
            {(["AVAILABLE", "NEARLY_FULL", "FULL", "CLOSED"] as const).map(
              (status) => (
                <StatusBadge key={status} status={status} />
              ),
            )}
          </div>
          {centers.length === 0 && (
            <p>No evacuation centers have been registered yet.</p>
          )}
        </>
      ) : loading ? (
        <p role="status">Loading evacuation centers...</p>
      ) : null}
    </section>
  );
}
