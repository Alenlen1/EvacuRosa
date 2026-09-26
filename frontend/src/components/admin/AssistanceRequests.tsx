"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { fetchAssistanceRequests, type AssistanceRequest } from "@/services/api";
import { TRAVEL_MODES } from "@/lib/travelTime";

export function AssistanceRequests() {
  const [requests, setRequests] = useState<AssistanceRequest[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [updated, setUpdated] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    async function load() {
      try {
        const session = await supabase?.auth.getSession();
        const token = session?.data.session?.access_token;
        if (!token) throw new Error("Sign in again to view shared locations.");
        const items = await fetchAssistanceRequests(token, AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]));
        if (!cancelled) { setRequests(items); setError(null); setUpdated(new Date().toLocaleTimeString()); }
      } catch (cause) {
        if (!cancelled) {
          setRequests([]);
          setError(cause instanceof Error ? cause.message : "Could not refresh shared locations.");
        }
      } finally {
        if (!cancelled) { setLoading(false); timer = setTimeout(load, 30000); }
      }
    }
    setLoading(true);
    void load();
    return () => { cancelled = true; controller.abort(); clearTimeout(timer); };
  }, [refresh]);

  return <section className="admin-assistance" aria-labelledby="assistance-requests-title">
    <div className="assistance-list-heading"><h2 id="assistance-requests-title">Shared locations — hazard-blocked routes</h2>
      <button type="button" className="secondary-button" disabled={loading} onClick={() => setRefresh(n => n + 1)}>{loading ? "Refreshing…" : "Refresh"}</button>
    </div>
    <p>Latest 100 submissions. Refreshes every 30 seconds. These are user-submitted location snapshots, not verified incidents or dispatched rescues.</p>
    <p role="status">{loading ? "Loading requests…" : error ? "Refresh failed." : `Last refreshed ${updated} · ${requests.length} request(s)`}</p>
    {error && <p role="alert">{error}</p>}
    {!loading && !error && requests.length === 0 && <p>No locations shared yet.</p>}
    <div className="assistance-list">{requests.map(item => <article className="assistance-record" key={item.id}>
      <h3>{item.display_name || "Name not provided"}</h3>
      <p><strong>Contact:</strong> {item.contact_number || "Not provided"}</p>
      <p><strong>Location:</strong> {item.latitude.toFixed(6)}, {item.longitude.toFixed(6)}</p>
      <p>Reported accuracy: ±{Math.round(item.accuracy_meters)} m · {TRAVEL_MODES[item.travel_mode].label}</p>
      <p>Location recorded: {new Date(item.location_recorded_at).toLocaleString()}</p>
      <p>Received: {new Date(item.created_at).toLocaleString()}</p>
      <p>{item.route_kind === "evacuation" ? "Could not reach an available evacuation center." : `Destination: ${item.destination_latitude?.toFixed(6)}, ${item.destination_longitude?.toFixed(6)}`}</p>
      <small>Reference: {item.id}</small>
    </article>)}</div>
  </section>;
}
