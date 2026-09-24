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
    setCenters(data ?? []);
  }

  async function updateOccupancy(id: string, currentOccupancy: number) {
    if (!supabase) return;
    setSavingId(id);
    setError(null);
    const { data: session } = await supabase.auth.getSession();
    const token = session.session?.access_token;

    const res = await fetch(`${API_URL}/api/admin/evacuation-centers/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ currentOccupancy }),
    });
    setSavingId(null);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Update failed.");
      return;
    }
    loadCenters();
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
        <div className="space-y-3 p-4">
          {centers.map((center) => (
            <div
              key={center.id}
              id={`center-${center.id}`}
              className={`rounded-lg border bg-white p-3 transition-colors ${
                highlightedId === center.id
                  ? "border-blue-500 ring-2 ring-blue-200"
                  : "border-slate-200"
              }`}
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium">{center.name}</span>
                <span className="text-xs text-slate-500">{center.status}</span>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-600">Occupancy</label>
                <input
                  type="number"
                  defaultValue={center.current_occupancy}
                  className="w-20 rounded border border-slate-300 px-2 py-1 text-sm"
                  onBlur={(e) => updateOccupancy(center.id, Number(e.target.value))}
                />
                <span className="text-xs text-slate-500">/ {center.capacity}</span>
                {savingId === center.id && (
                  <span className="text-xs text-slate-400">Saving…</span>
                )}
              </div>
            </div>
          ))}
          {centers.length === 0 && !error && (
            <p className="text-sm text-slate-500">No centers assigned yet.</p>
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
