"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { EvacuationCenter } from "@/services/api";
import { findBarangayLocation } from "@/lib/barangayLocations";

const AdminEvacuationMap = dynamic(() => import("./AdminEvacuationMap"), {
  ssr: false,
  loading: () => <p role="status">Loading evacuation map...</p>,
});
const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const EMPTY_CENTERS: EvacuationCenter[] = [];

export function BarangayEvacuationOverview({
  focusedBarangay,
}: {
  focusedBarangay?: { id: string; name: string } | null;
}) {
  const [centers, setCenters] = useState<EvacuationCenter[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const location = focusedBarangay
    ? findBarangayLocation(focusedBarangay.name)
    : undefined;

  useEffect(() => {
    const abort = new AbortController();
    let active = true;
    setLoading(true);
    setError("");
    // Citywide display uses the existing public data endpoint. Editing stays scoped.
    void fetch(`${API}/api/evacuation-centers`, {
      cache: "no-store",
      signal: AbortSignal.any([abort.signal, AbortSignal.timeout(20000)]),
    })
      .then(async (response) => {
        if (!response.ok) throw Error("Could not load evacuation centers.");
        const body = await response.json();
        if (!Array.isArray(body.centers)) throw Error("Invalid center list.");
        if (active) setCenters(body.centers);
      })
      .catch(() => {
        if (active)
          setError(
            "Could not refresh evacuation center information. Any displayed center details may be outdated. You can still search for your barangay and enter its access code.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      abort.abort();
    };
  }, [refresh]);

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
          onClick={() => setRefresh((value) => value + 1)}
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
