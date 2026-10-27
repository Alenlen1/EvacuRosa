"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import { House, RefreshCw } from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { EvacuationCenter } from "@/services/api";
import { MapSkeleton } from "./LoadingSkeleton";

const AdminEvacuationMap = dynamic(() => import("./AdminEvacuationMap"), {
  ssr: false,
  loading: () => (
    <MapSkeleton
      className="barangay-overview-map"
      label="Loading evacuation map..."
    />
  ),
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
  const focusedBarangayId = focusedBarangay?.id;
  const matchingCenters = useMemo(() => {
    const all = centers ?? EMPTY_CENTERS;
    return focusedBarangayId !== undefined
      ? all.filter((center) => center.barangayId === focusedBarangayId)
      : all;
  }, [centers, focusedBarangayId]);
  const mappedCenters = useMemo(
    () =>
      matchingCenters.filter(
        (center) =>
          Number.isFinite(center.latitude) &&
          Number.isFinite(center.longitude) &&
          Math.abs(center.latitude) <= 90 &&
          Math.abs(center.longitude) <= 180,
      ),
    [matchingCenters],
  );
  const missingLocations = matchingCenters.length - mappedCenters.length;
  const areaName = focusedBarangay?.name ?? "Santa Rosa";
  let mapCaption = focusedBarangay
    ? `Showing only shelters in ${areaName}.`
    : "Showing the Santa Rosa city overview.";
  if (loading) mapCaption = `Loading shelter locations for ${areaName}...`;
  else if (error)
    mapCaption =
      centers === null
        ? `Shelter locations for ${areaName} are unavailable.`
        : `Showing last loaded shelter locations for ${areaName}.`;
  else if (focusedBarangay && matchingCenters.length === 0)
    mapCaption = `No shelters registered in ${areaName}. Showing the barangay area.`;
  else if (focusedBarangay && mappedCenters.length === 0)
    mapCaption = `No shelter locations are available for ${areaName}. Showing the barangay area.`;

  return (
    <section className="barangay-overview" aria-labelledby="barangay-map-title">
      <div className="barangay-overview-heading">
        <div>
          <h2 id="barangay-map-title">
            {focusedBarangay
              ? `${areaName} shelters`
              : "City evacuation centers"}
          </h2>
          <p>Select a shelter to view its details.</p>
        </div>
        <button
          type="button"
          className="secondary-button"
          aria-label={loading ? "Refreshing..." : "Refresh map"}
          disabled={loading}
          onClick={onRefresh}
        >
          <RefreshCw size={15} aria-hidden="true" />
          <span className="barangay-map-refresh-label">
            {loading ? "Refreshing..." : "Refresh map"}
          </span>
        </button>
      </div>
      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}
      <p
        className="barangay-map-focus-caption"
        role="status"
        aria-live="polite"
      >
        {mapCaption}
      </p>
      {loading && centers === null ? (
        <MapSkeleton
          className="barangay-overview-map"
          label="Loading evacuation centers..."
        />
      ) : (
        <AdminEvacuationMap
          centers={mappedCenters}
          focusedBarangay={focusedBarangay}
        />
      )}
      {centers !== null ? (
        <div className="barangay-map-footer">
          {!loading && !error && (
            <div className="barangay-map-totals">
              <span>
                {mappedCenters.length}{" "}
                {mappedCenters.length === 1 ? "shelter" : "shelters"} on map
              </span>
              {missingLocations > 0 && (
                <span>{missingLocations} without a map location</span>
              )}
            </div>
          )}
          <div
            className="barangay-overview-legend"
            aria-label="Evacuation center status legend"
          >
            {(["AVAILABLE", "NEARLY_FULL", "FULL", "CLOSED"] as const).map(
              (status) => (
                <StatusBadge key={status} status={status} />
              ),
            )}
          </div>
          {!focusedBarangay &&
            !loading &&
            !error &&
            matchingCenters.length === 0 && (
              <div className="barangay-shelter-empty">
                <span
                  className="barangay-empty-illustration"
                  aria-hidden="true"
                >
                  <House size={32} strokeWidth={1.4} />
                </span>
                <strong>No shelters registered yet</strong>
                <p>
                  Registered evacuation centers will appear here with their
                  locations and current status.
                </p>
              </div>
            )}
        </div>
      ) : null}
    </section>
  );
}
