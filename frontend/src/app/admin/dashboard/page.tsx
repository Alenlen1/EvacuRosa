"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import {
  fetchFloodReports,
  fetchFireIncidents,
  fetchEarthquakes,
  type FloodReport,
  type FireIncident,
  type EarthquakeEvent,
  type EarthquakeRoadImpact,
} from "@/services/api";

const AdminEvacuationMap = dynamic(() => import("@/components/admin/AdminEvacuationMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-64 w-full items-center justify-center bg-slate-100 text-xs text-slate-500">
      Loading map…
    </div>
  ),
});

const HazardPlacementMap = dynamic(() => import("@/components/admin/HazardPlacementMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-64 w-full items-center justify-center bg-slate-100 text-xs text-slate-500">
      Loading map…
    </div>
  ),
});

interface AdminCenter {
  id: string;
  name: string;
  capacity: number;
  current_occupancy: number;
  status: string;
  latitude: number | null;
  longitude: number | null;
}

interface Profile {
  role: "BARANGAY_ADMIN" | "SUPER_ADMIN";
  barangay_id: string | null;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export default function AdminDashboardPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [centers, setCenters] = useState<AdminCenter[]>([]);
  const [occupancyDrafts, setOccupancyDrafts] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const [floodReports, setFloodReports] = useState<FloodReport[]>([]);
  const [fireIncidents, setFireIncidents] = useState<FireIncident[]>([]);
  const [earthquakeEvents, setEarthquakeEvents] = useState<EarthquakeEvent[]>([]);
  const [earthquakeRoadImpacts, setEarthquakeRoadImpacts] = useState<EarthquakeRoadImpact[]>([]);

  useEffect(() => {
    if (!supabase) {
      setError("Supabase isn't configured yet — see supabase/README.md.");
      setReady(true);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        router.push("/admin/login");
        return;
      }
      loadCenters().finally(() => setReady(true));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (profile?.role !== "SUPER_ADMIN") return;
    fetchFloodReports().then(setFloodReports).catch(() => setFloodReports([]));
    fetchFireIncidents().then(setFireIncidents).catch(() => setFireIncidents([]));
    fetchEarthquakes()
      .then(({ events, roadImpacts }) => {
        setEarthquakeEvents(events);
        setEarthquakeRoadImpacts(roadImpacts);
      })
      .catch(() => {
        setEarthquakeEvents([]);
        setEarthquakeRoadImpacts([]);
      });
  }, [profile]);

  async function loadCenters() {
    if (!supabase) return;
    const { data: session } = await supabase.auth.getSession();
    const userId = session.session?.user.id;
    if (!userId) return;

    const { data: profileRow } = await supabase
      .from("profiles")
      .select("barangay_id, role")
      .eq("id", userId)
      .single();
    if (profileRow) setProfile(profileRow as Profile);

    if (profileRow?.role === "SUPER_ADMIN") {
      setCenters([]);
      setOccupancyDrafts({});
      return;
    }

    let query = supabase
      .from("evacuation_centers")
      .select("id, name, capacity, current_occupancy, status, latitude, longitude");
    if (profileRow?.role === "BARANGAY_ADMIN" && profileRow.barangay_id) {
      query = query.eq("barangay_id", profileRow.barangay_id);
    }

    const { data, error: fetchError } = await query;
    if (fetchError) {
      setError(fetchError.message);
      return;
    }
    const rows = data ?? [];
    setCenters(rows);
    setOccupancyDrafts(Object.fromEntries(rows.map((center) => [center.id, String(center.current_occupancy)])));
  }

  async function updateOccupancy(id: string) {
    if (!supabase) return;
    const center = centers.find((item) => item.id === id);
    const draft = occupancyDrafts[id] ?? "";
    const currentOccupancy = Number(draft);
    if (!center || draft.trim() === "" || !Number.isInteger(currentOccupancy) || currentOccupancy < 0 || currentOccupancy > center.capacity) {
      setError(`Enter a whole number from 0 to ${center?.capacity ?? "the center's capacity"}.`);
      return;
    }
    setSavingId(id);
    setError(null);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (!token) throw new Error("Your session has expired. Please sign in again.");
      const res = await fetch(`${API_URL}/api/admin/evacuation-centers/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ currentOccupancy }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Update failed.");
      }
      await loadCenters();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Update failed.");
    } finally {
      setSavingId(null);
    }
  }

  function getOccupancyStatus(center: AdminCenter, occupancy: number) {
    if (center.status === "CLOSED") return "CLOSED";
    if (center.capacity <= 0 || occupancy >= center.capacity) return "FULL";
    if (occupancy / center.capacity >= 0.8) return "NEARLY FULL";
    return "AVAILABLE";
  }

  function handleSelectCenterOnMap(id: string) {
    setHighlightedId(id);
    document.getElementById(`center-${id}`)?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
    setTimeout(() => setHighlightedId((current) => (current === id ? null : current)), 2000);
  }

  async function getAuthToken(): Promise<string | undefined> {
    if (!supabase) return undefined;
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token;
  }

  if (!ready) {
    return (
      <main className="flex h-dvh items-center justify-center text-sm text-slate-500">
        Loading…
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-slate-50 pb-8">
      <div className="border-b border-slate-200 bg-white p-4">
        <h1 className="text-lg font-semibold text-blue-700">
          {profile?.role === "SUPER_ADMIN"
            ? "CDRRMO — Hazard Management"
            : "Assigned evacuation centers"}
        </h1>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </div>

      {profile?.role !== "SUPER_ADMIN" && (
        <div className="border-b border-slate-200">
          <AdminEvacuationMap centers={centers} onSelectCenter={handleSelectCenterOnMap} />
        </div>
      )}

      {profile?.role !== "SUPER_ADMIN" && (
        <div className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-3">
          {centers.map((center) => (
            <div
              key={center.id}
              id={`center-${center.id}`}
              className={`rounded-xl border bg-white p-4 shadow-sm transition-colors ${
                highlightedId === center.id
                  ? "border-blue-500 ring-2 ring-blue-200"
                  : "border-slate-200"
              }`}
            >
              {(() => {
                const draft = occupancyDrafts[center.id] ?? String(center.current_occupancy);
                const occupancy = Number(draft);
                const valid = draft.trim() !== "" && Number.isInteger(occupancy) && occupancy >= 0 && occupancy <= center.capacity;
                const status = getOccupancyStatus(center, Number.isFinite(occupancy) ? occupancy : 0);
                const statusClass = status === "AVAILABLE"
                  ? "bg-emerald-50 text-emerald-700"
                  : status === "NEARLY FULL"
                    ? "bg-amber-50 text-amber-700"
                    : status === "FULL"
                      ? "bg-red-50 text-red-700"
                      : "bg-slate-100 text-slate-600";
                const percent = center.capacity > 0 && Number.isFinite(occupancy)
                  ? Math.max(0, Math.min(100, (occupancy / center.capacity) * 100))
                  : 0;
                return (
                  <>
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <div>
                        <h2 className="font-semibold text-slate-900">{center.name}</h2>
                        <p className="mt-1 text-xs text-slate-500">Evacuation center</p>
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusClass}`}>{status}</span>
                    </div>
                    <div className="mb-2 flex items-baseline justify-between">
                      <span className="text-sm text-slate-600">Current occupancy</span>
                      <span className="text-sm font-semibold tabular-nums text-slate-900">
                        {draft} <span className="font-normal text-slate-500">/ {center.capacity}</span>
                      </span>
                    </div>
                    <div
                      role="progressbar"
                      aria-label={`${center.name} occupancy`}
                      aria-valuemin={0}
                      aria-valuemax={center.capacity}
                      aria-valuenow={Math.max(0, Math.min(center.capacity, Number.isFinite(occupancy) ? occupancy : 0))}
                      className="mb-4 h-2 overflow-hidden rounded-full bg-slate-100"
                    >
                      <div className="h-full rounded-full bg-blue-600 transition-[width]" style={{ width: `${percent}%` }} />
                    </div>
                    <div className="flex flex-wrap items-end gap-2">
                      <label className="flex-1 text-xs font-medium text-slate-600">
                        Update occupancy
                        <input
                          type="number"
                          min={0}
                          max={center.capacity}
                          step={1}
                          value={draft}
                          onChange={(event) => setOccupancyDrafts((drafts) => ({ ...drafts, [center.id]: event.target.value }))}
                          className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => updateOccupancy(center.id)}
                        disabled={!valid || savingId !== null || String(center.current_occupancy) === draft}
                        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                      >
                        {savingId === center.id ? "Saving…" : "Save"}
                      </button>
                    </div>
                  </>
                );
              })()}
            </div>
          ))}
          {centers.length === 0 && !error && (
            <div className="col-span-full rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center">
              <p className="font-medium text-slate-700">No evacuation centers are assigned to your account.</p>
              <p className="mt-1 text-sm text-slate-500">Ask your CDRRMO administrator to verify your barangay assignment and register its evacuation centers.</p>
            </div>
          )}
        </div>
      )}

      {profile?.role === "SUPER_ADMIN" && (
        <div className="p-4">
          <h2 className="mb-2 text-sm font-semibold text-slate-700">
            Hazard management — flood, fire, earthquake
          </h2>
          <p className="mb-3 text-xs text-slate-500">
            Use the Santa Rosa map to mark hazards.
            Flood and earthquake reports snap to a nearby road; fire incidents
            use a point and radius. Existing records can be removed below.
          </p>
          <HazardPlacementMapWrapper
            floodReports={floodReports}
            fireIncidents={fireIncidents}
            earthquakeEvents={earthquakeEvents}
            earthquakeRoadImpacts={earthquakeRoadImpacts}
            getAuthToken={getAuthToken}
            onCreated={() => {
              fetchFloodReports().then(setFloodReports).catch(() => {});
              fetchFireIncidents().then(setFireIncidents).catch(() => {});
              fetchEarthquakes()
                .then(({ events, roadImpacts }) => {
                  setEarthquakeEvents(events);
                  setEarthquakeRoadImpacts(roadImpacts);
                })
                .catch(() => {});
            }}
          />
        </div>
      )}
    </main>
  );
}

/** HazardPlacementMap needs a real token string, not a getter — this small
 * wrapper resolves the token once before the map (which needs it
 * synchronously available for its submit handler) ever mounts. */
function HazardPlacementMapWrapper({
  getAuthToken,
  ...rest
}: {
  floodReports: FloodReport[];
  fireIncidents: FireIncident[];
  earthquakeEvents: EarthquakeEvent[];
  earthquakeRoadImpacts: EarthquakeRoadImpact[];
  getAuthToken: () => Promise<string | undefined>;
  onCreated: () => void;
}) {
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    getAuthToken().then((t) => setToken(t ?? null));
  }, [getAuthToken]);

  if (!token) {
    return <p className="text-xs text-slate-400">Preparing hazard tools…</p>;
  }

  return <HazardPlacementMap {...rest} authToken={token} />;
}
