"use client";

import { useEffect, useState } from "react";
import type { EvacuationCenter } from "@/services/api";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

// The map and access cards must always describe the same center snapshot.
export function useBarangayCenters(enabled: boolean) {
  const [centers, setCenters] = useState<EvacuationCenter[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    const abort = new AbortController();
    let active = true;
    setLoading(true);
    setError("");
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
            "Could not refresh shelter status. Card statuses are unavailable and any displayed map details may be outdated. You can still search for your barangay and enter its access code.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      abort.abort();
    };
  }, [enabled, refreshKey]);

  return {
    centers,
    loading,
    error,
    refresh: () => setRefreshKey((value) => value + 1),
  };
}
