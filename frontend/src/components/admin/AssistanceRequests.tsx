"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { deleteAssistanceRequest, fetchAssistanceRequests, type AssistanceRequest } from "@/services/api";
import { TRAVEL_MODES } from "@/lib/travelTime";
import { MapPin, Phone, RefreshCw, ShieldAlert, Trash2 } from "lucide-react";

export function AssistanceRequests() {
  const [requests, setRequests] = useState<AssistanceRequest[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [updated, setUpdated] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const pendingDelete = useRef(false);
  const removedIds = useRef(new Set<string>());
  const mounted = useRef(true);
  const refreshButton = useRef<HTMLButtonElement>(null);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  async function removeAfterRescue(item: AssistanceRequest) {
    if (pendingDelete.current) return;
    const confirmed = window.confirm(
      `Confirm the person has been rescued before deleting this request.\n\n${item.display_name || "Name not provided"}\nLocation: ${item.latitude.toFixed(6)}, ${item.longitude.toFixed(6)}\nReference: ${item.id}\n\nThis permanently deletes their shared location and contact details. It cannot be undone in the app.`,
    );
    if (!confirmed) return;
    pendingDelete.current = true;
    setDeleting(item.id); setDeleteError(null); setNotice(null);
    try {
      const session = await supabase?.auth.getSession();
      const token = session?.data.session?.access_token;
      if (!token) throw new Error("Sign in again to delete this request.");
      if (!mounted.current) return;
      await deleteAssistanceRequest(token, item.id);
      if (!mounted.current) return;
      // A poll begun before deletion must not put the removed card back.
      removedIds.current.add(item.id);
      setRequests(items => items.filter(request => request.id !== item.id));
      setNotice("Request deleted. Its shared location and contact details were permanently removed.");
      refreshButton.current?.focus();
    } catch (cause) {
      if (mounted.current) setDeleteError(cause instanceof Error && cause.name !== "TimeoutError"
        ? cause.message : "Could not confirm deletion. Refresh the list before trying again.");
    } finally {
      pendingDelete.current = false;
      if (mounted.current) setDeleting(null);
    }
  }
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
        if (!cancelled) { setRequests(items.filter(item => !removedIds.current.has(item.id))); setError(null); setUpdated(new Date().toLocaleTimeString()); }
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
    <div className="assistance-list-heading">
      <div><span className="assistance-eyebrow">CDRRMO · LOCATION REQUESTS</span>
        <h2 id="assistance-requests-title">Shared locations <span className="assistance-count" aria-label={`${requests.length} loaded requests`}>{requests.length}</span></h2>
        <p className="assistance-caption">People who shared their location after a hazard-blocked route.</p>
      </div>
      <button ref={refreshButton} type="button" className="secondary-button" disabled={loading} onClick={() => { setNotice(null); setDeleteError(null); setRefresh(n => n + 1); }}><RefreshCw size={16} aria-hidden="true" />{loading ? "Refreshing…" : "Refresh"}</button>
    </div>
    <div className="assistance-toolbar"><span role="status">{loading ? "Loading requests…" : error ? "Refresh failed" : `Updated ${updated}`}</span><span>Auto-refresh 30s · Latest 100</span></div>
    <div className="assistance-disclaimer"><ShieldAlert size={17} aria-hidden="true" /><span>User-reported snapshots, not live tracking or confirmed rescue dispatch. Road names are approximate references from local OpenStreetMap data.</span></div>
    {error && <p className="assistance-feedback is-error" role="alert">{error}</p>}
    {deleteError && <p className="assistance-feedback is-error" role="alert">{deleteError}</p>}
    {notice && <p className="assistance-feedback is-success" role="status">{notice}</p>}
    {!loading && !error && requests.length === 0 && <div className="assistance-empty"><MapPin size={24} aria-hidden="true" /><strong>No shared locations</strong><span>New submissions will appear here automatically.</span></div>}
    <div className="assistance-list">{requests.map(item => <article className="assistance-record" key={item.id}>
      <header className="assistance-record-heading"><h3>{item.display_name || "Name not provided"}</h3><span className="assistance-mode">{TRAVEL_MODES[item.travel_mode].label}</span></header>
      <div className="assistance-location"><MapPin size={20} aria-hidden="true" /><div>
        <span className="assistance-field-label">Shared location</span>
        <strong>{item.location_name ? `Near ${item.location_name.roadName}` : "Street name unavailable"}</strong>
        <span className="assistance-coordinates">{item.latitude.toFixed(6)}, {item.longitude.toFixed(6)}</span>
        {item.location_name && <small>Approx. {item.location_name.distanceMeters} m from mapped road</small>}
      </div></div>
      <div className="assistance-key-details">
        <div><span className="assistance-field-label"><Phone size={13} aria-hidden="true" />Contact number</span><strong>{item.contact_number || "Not provided"}</strong></div>
        <div><span className="assistance-field-label">Reported GPS accuracy</span><strong>±{Math.round(item.accuracy_meters)} m</strong><small>Position may vary within this radius</small></div>
      </div>
      <details className="assistance-record-details"><summary>Request details</summary>
        <dl><div><dt>Location recorded</dt><dd><time dateTime={item.location_recorded_at}>{new Date(item.location_recorded_at).toLocaleString()}</time></dd></div>
          <div><dt>Received</dt><dd><time dateTime={item.created_at}>{new Date(item.created_at).toLocaleString()}</time></dd></div>
          <div><dt>Destination</dt><dd>{item.route_kind === "evacuation" ? "Search for an available evacuation center" : <>
            {item.destination_name && <span>Near {item.destination_name.roadName}<br /></span>}
            {item.destination_latitude?.toFixed(6)}, {item.destination_longitude?.toFixed(6)}
          </>}</dd></div>
          <div><dt>Reference ID</dt><dd className="assistance-reference">{item.id}</dd></div>
        </dl>
      </details>
      <div className="assistance-record-actions">
        <button type="button" className="secondary-button assistance-delete-button" disabled={deleting !== null || loading}
          aria-label={`Delete after rescue: ${item.display_name || "unnamed person"}, request ${item.id}`}
          onClick={() => void removeAfterRescue(item)}>
          <Trash2 size={15} aria-hidden="true" />{deleting === item.id ? "Deleting…" : "Delete after rescue"}
        </button>
      </div>
    </article>)}</div>
  </section>;
}
