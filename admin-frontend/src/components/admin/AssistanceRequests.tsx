"use client";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Clock3, Info, MapPin, RefreshCw } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import {
  assistanceEventsUrl,
  deleteAssistanceRequest,
  fetchAssistanceRequests,
  fetchAssistanceDetails,
  updateAssistanceStatus,
  type AssistanceRequest,
  type AssistanceStatus,
} from "@/services/api";
import {
  ASSISTANCE_LABELS,
  ASSISTANCE_STATUSES,
  assistanceActive,
  consumeAssistanceEvents,
  type AssistanceHistory,
} from "@/lib/assistance";
import { TRAVEL_MODES } from "@/lib/travelTime";
import styles from "./AssistanceRequests.module.css";
import { useDeleteConfirmation } from "./DeleteConfirmationDialog";
import { isVisibleAssistanceRequest } from "@/lib/assistanceVisibility";
import {
  assistanceDisplayName,
  assistanceTime,
} from "@/lib/assistancePresentation";
import { MapSkeleton, RecordsSkeleton } from "./LoadingSkeleton";
const AssistanceLocationMap = dynamic(() => import("./AssistanceLocationMap"), {
  ssr: false,
  loading: () => <MapSkeleton label="Loading reported-location map..." />,
});
export function AssistanceRequests() {
  const { confirmDelete, deleteDialog } = useDeleteConfirmation();
  const [mobileView, setMobileView] = useState<"requests" | "map">("requests");
  const [requests, setRequests] = useState<AssistanceRequest[]>([]),
    [filter, setFilter] = useState<AssistanceStatus | "">("");
  const [selection, setSelection] = useState<{
    id: string;
    version: number;
  } | null>(null);
  const [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [connection, setConnection] = useState("Reconnecting"),
    [refresh, setRefresh] = useState(0),
    [busy, setBusy] = useState<string | null>(null);
  const [histories, setHistories] = useState<
    Record<string, AssistanceHistory[]>
  >({});
  const [historyLoading, setHistoryLoading] = useState<string | null>(null);
  const recordRefs = useRef(new Map<string, HTMLElement>());
  const requestList = useRef<HTMLDivElement>(null);
  const selectedRequest = requests.find((item) => item.id === selection?.id);
  const mounted = useRef(true),
    pending = useRef(false),
    mutationVersion = useRef(0),
    mapSection = useRef<HTMLDivElement>(null);
  function revealRequest(id: string, focus = false) {
    requestAnimationFrame(() => {
      const card = recordRefs.current.get(id);
      const list = requestList.current;
      if (!card || !list || !list.clientHeight) return;
      list.scrollTo({ top: card.offsetTop - 3, behavior: "instant" });
      if (focus) card.focus({ preventScroll: true });
    });
  }
  function selectRequest(id: string, fromMap = false) {
    setSelection((previous) => ({ id, version: (previous?.version ?? 0) + 1 }));
    if (fromMap) revealRequest(id);
  }
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    let stopped = false,
      inFlight = false,
      queued = false,
      live = false,
      stream: AbortController | null = null;
    let reconnect: ReturnType<typeof setTimeout>,
      backoff = 1000,
      lastSuccess = 0;
    const abort = new AbortController();
    async function load() {
      if (stopped || !navigator.onLine || pending.current) return;
      if (inFlight) {
        queued = true;
        return;
      }
      inFlight = true;
      const version = mutationVersion.current;
      try {
        do {
          queued = false;
          const session = await supabase?.auth.getSession();
          const token = session?.data.session?.access_token;
          if (!token) throw Error("Sign in again to view assistance requests.");
          const rows = await fetchAssistanceRequests(
            token,
            abort.signal,
            filter || undefined,
          );
          if (stopped) return;
          if (version === mutationVersion.current && !pending.current) {
            const visible = rows.filter(isVisibleAssistanceRequest);
            setRequests(visible);
            setSelection((current) =>
              current && visible.some((row) => row.id === current.id)
                ? current
                : null,
            );
            setError("");
            lastSuccess = Date.now();
          }
        } while (queued && !stopped);
      } catch (cause) {
        if (!stopped) {
          setError(
            cause instanceof Error ? cause.message : "Could not load requests.",
          );
          setConnection(
            navigator.onLine ? "Status May Be Outdated" : "Offline",
          );
        }
      } finally {
        inFlight = false;
        if (!stopped) setLoading(false);
      }
    }
    async function connect() {
      if (stopped || !navigator.onLine) return;
      stream?.abort();
      const ownStream = new AbortController();
      stream = ownStream;
      try {
        const session = await supabase?.auth.getSession();
        if (!session?.data.session) throw Error("Sign in required");
        await consumeAssistanceEvents(
          assistanceEventsUrl(),
          session.data.session.access_token,
          ownStream.signal,
          () => void load(),
          (value) => {
            if (stopped || stream !== ownStream) return;
            live = value;
            setConnection(value ? "Connected" : "Reconnecting");
            if (value) {
              backoff = 1000;
              void load();
            }
          },
        );
      } catch {
        /* Poll securely when realtime is unavailable. */
      }
      if (!stopped && stream === ownStream) {
        live = false;
        setConnection(navigator.onLine ? "Reconnecting" : "Offline");
        reconnect = setTimeout(connect, backoff);
        backoff = Math.min(backoff * 2, 30000);
      }
    }
    const restored = () => {
      void load();
      clearTimeout(reconnect);
      void connect();
    };
    const visible = () => {
      if (document.visibilityState === "visible") {
        void load();
        if (!live) restored();
      }
    };
    const offline = () => {
      live = false;
      stream?.abort();
      setConnection("Offline");
    };
    window.addEventListener("online", restored);
    window.addEventListener("offline", offline);
    document.addEventListener("visibilitychange", visible);
    const poll = setInterval(() => {
      if (
        document.visibilityState === "visible" &&
        (!live || Date.now() - lastSuccess > 60000)
      )
        void load();
    }, 12000);
    setLoading(true);
    void load();
    void connect();
    return () => {
      stopped = true;
      abort.abort();
      stream?.abort();
      clearInterval(poll);
      clearTimeout(reconnect);
      window.removeEventListener("online", restored);
      window.removeEventListener("offline", offline);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [filter, refresh]);
  async function token() {
    const session = await supabase?.auth.getSession();
    const access = session?.data.session?.access_token;
    if (!access) throw Error("Sign in again to manage requests.");
    return access;
  }
  async function change(item: AssistanceRequest, status: AssistanceStatus) {
    if (pending.current) return;
    const text =
      status === "DISPATCHED"
        ? "Confirm that a response team has ACTUALLY been dispatched to this reported location. The user will be told Help Is on the Way."
        : status === "COMPLETED"
          ? "Confirm assistance has actually been completed for this request."
          : status === "CANCELLED"
            ? "Confirm cancellation. If a team was dispatched, coordinate the cancellation with responders."
            : "";
    if (text && !window.confirm(text)) return;
    pending.current = true;
    mutationVersion.current++;
    setBusy(item.id);
    setError("");
    setNotice("");
    try {
      const updated = await updateAssistanceStatus(
        await token(),
        item.id,
        status,
        item.version,
        !!text,
      );
      if (!mounted.current) return;
      setRequests((rows) =>
        rows
          .map((row) => (row.id === item.id ? { ...row, ...updated } : row))
          .filter(isVisibleAssistanceRequest),
      );
      if (!isVisibleAssistanceRequest(updated)) {
        setSelection((current) => (current?.id === item.id ? null : current));
      }
      setHistories((previous) => {
        const next = { ...previous };
        delete next[item.id];
        return next;
      });
      setNotice(
        status === "ACKNOWLEDGED"
          ? "Request acknowledged. Assistance has not yet been dispatched."
          : `${ASSISTANCE_LABELS[status]} confirmed.`,
      );
    } catch (cause) {
      if (mounted.current)
        setError(
          cause instanceof Error
            ? cause.message
            : "Could not confirm status change.",
        );
    } finally {
      pending.current = false;
      mutationVersion.current++;
      if (mounted.current) {
        setBusy(null);
        setRefresh((n) => n + 1);
      }
    }
  }
  async function remove(item: AssistanceRequest) {
    if (
      pending.current ||
      !(await confirmDelete({
        title: "Delete closed request?",
        subject: item.display_name || "Assistance request",
        description:
          "This permanently removes the request, its reported location, contact details and status history. This action cannot be undone.",
        confirmLabel: "Delete request",
      }))
    )
      return;
    pending.current = true;
    mutationVersion.current++;
    setBusy(item.id);
    try {
      await deleteAssistanceRequest(await token(), item.id);
      if (mounted.current) {
        setRequests((rows) => rows.filter((row) => row.id !== item.id));
        setNotice("Closed request permanently deleted.");
      }
    } catch (cause) {
      if (mounted.current)
        setError(
          cause instanceof Error
            ? cause.message
            : "Could not confirm deletion.",
        );
    } finally {
      pending.current = false;
      mutationVersion.current++;
      if (mounted.current) {
        setBusy(null);
        setRefresh((n) => n + 1);
      }
    }
  }
  async function history(id: string) {
    if (historyLoading) return;
    if (histories[id]) {
      setHistories((previous) => {
        const next = { ...previous };
        delete next[id];
        return next;
      });
      return;
    }
    setHistoryLoading(id);
    const version = mutationVersion.current;
    try {
      const result = await fetchAssistanceDetails(await token(), id);
      if (mounted.current && version === mutationVersion.current)
        setHistories((value) => ({ ...value, [id]: result.history }));
    } catch (cause) {
      if (mounted.current)
        setError(
          cause instanceof Error ? cause.message : "Could not load history.",
        );
    } finally {
      if (mounted.current) setHistoryLoading(null);
    }
  }
  return (
    <section
      className={`admin-assistance ${styles.panel}`}
      aria-labelledby="assistance-requests-title"
    >
      <div className="assistance-list-heading">
        <div>
          <span className="assistance-eyebrow">CDRRMO</span>
          <h2 id="assistance-requests-title">
            Shared locations{" "}
            <span className="assistance-count">{requests.length}</span>
          </h2>
          <p className="assistance-caption">
            Review reported locations and update assistance requests.
          </p>
        </div>
      </div>
      <div className="assistance-toolbar">
        <span
          className="assistance-connection-status"
          data-connected={connection === "Connected"}
          role="status"
        >
          <span aria-hidden="true" />
          {connection}
        </span>
        <label>
          Request status{" "}
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as AssistanceStatus | "")}
          >
            <option value="">All statuses</option>
            {ASSISTANCE_STATUSES.filter((status) => status !== "CANCELLED").map(
              (status) => (
                <option key={status} value={status}>
                  {ASSISTANCE_LABELS[status]}
                </option>
              ),
            )}
          </select>
        </label>
        <span className={styles.updateHint}>
          Automatic updates - Latest 100
        </span>
        <button
          className={`secondary-button ${styles.refreshButton}`}
          aria-label="Refresh shared locations"
          disabled={loading}
          onClick={() => setRefresh((n) => n + 1)}
        >
          <RefreshCw size={16} aria-hidden="true" />
          <span className={styles.refreshLabel}>
            {loading ? "Refreshing..." : "Refresh"}
          </span>
        </button>
      </div>
      <div className="assistance-disclaimer">
        <Info size={16} aria-hidden="true" />
        <span>
          Locations are GPS snapshots, not live tracking. People may have moved.
        </span>
      </div>
      {error && (
        <p className="assistance-feedback is-error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="assistance-feedback is-success" role="status">
          {notice}
        </p>
      )}
      {!loading && !requests.length && !error && (
        <p className="assistance-empty">
          No assistance requests match this filter.
        </p>
      )}
      {loading && !requests.length && !error && (
        <RecordsSkeleton label="Loading assistance requests..." />
      )}
      {!!requests.length && (
        <div className="assistance-view-tabs" aria-label="Shared location view">
          <button
            type="button"
            aria-pressed={mobileView === "requests"}
            onClick={() => {
              setMobileView("requests");
              if (selection) revealRequest(selection.id);
            }}
          >
            Requests ({requests.length})
          </button>
          <button
            type="button"
            aria-pressed={mobileView === "map"}
            onClick={() => setMobileView("map")}
          >
            Location map
          </button>
        </div>
      )}
      <div className="assistance-workspace-body" data-mobile-view={mobileView}>
        {!!requests.length && (
          <div
            ref={mapSection}
            className="assistance-map-section"
            role="region"
            aria-label="Reported-location map"
            tabIndex={-1}
          >
            <div className="assistance-map-heading">
              <h3>Reported locations</h3>
              {selection &&
                requests.some((item) => item.id === selection.id) && (
                  <p className="assistance-map-selection">
                    <MapPin size={14} aria-hidden="true" />
                    <span>
                      {selectedRequest &&
                        assistanceDisplayName(selectedRequest)}
                    </span>
                  </p>
                )}
            </div>
            <AssistanceLocationMap
              requests={requests}
              selection={selection}
              onSelectRequest={(id) => selectRequest(id, true)}
            />
            <div className={styles.mapFooter}>
              <span>The circle shows the reported GPS accuracy.</span>
              {selectedRequest && (
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => {
                    setMobileView("requests");
                    revealRequest(selectedRequest.id, true);
                  }}
                >
                  View request
                </button>
              )}
            </div>
          </div>
        )}
        <div
          className="assistance-list"
          ref={requestList}
          aria-label="Assistance requests"
        >
          {requests.map((item) => (
            <article
              className="assistance-record"
              data-status={item.status}
              data-selected={selection?.id === item.id}
              aria-current={selection?.id === item.id ? "true" : undefined}
              tabIndex={-1}
              aria-label={assistanceDisplayName(item)}
              ref={(element) => {
                if (element) recordRefs.current.set(item.id, element);
                else recordRefs.current.delete(item.id);
              }}
              key={item.id}
            >
              <header className="assistance-record-heading">
                <h3>{assistanceDisplayName(item)}</h3>
                <span className="assistance-mode">
                  {TRAVEL_MODES[item.travel_mode].label}
                </span>
              </header>
              <div className="assistance-status-line">
                <strong className="assistance-status-badge">
                  {ASSISTANCE_LABELS[item.status]}
                </strong>
                <time dateTime={item.status_updated_at ?? item.created_at}>
                  {assistanceTime(item.status_updated_at ?? item.created_at)}
                </time>
              </div>
              <div className="assistance-location">
                <MapPin size={18} aria-hidden="true" />
                <div>
                  <span className="assistance-field-label">
                    Reported location
                  </span>
                  <strong>
                    {item.location_name
                      ? `Near ${item.location_name.roadName}`
                      : "Street name unavailable"}
                  </strong>
                  <span className="assistance-coordinates">
                    {item.latitude.toFixed(6)}, {item.longitude.toFixed(6)}
                  </span>
                </div>
              </div>
              <div className="assistance-key-details">
                <div>
                  <span className="assistance-field-label">Contact number</span>
                  <strong>{item.contact_number || "Not provided"}</strong>
                </div>
                <div>
                  <span className="assistance-field-label">
                    Reported GPS accuracy
                  </span>
                  <strong
                    className={styles.accuracy}
                    data-approximate={item.accuracy_meters > 100}
                  >
                    ±{Math.round(item.accuracy_meters)} m
                    {item.accuracy_meters > 100 && (
                      <small>Approximate location</small>
                    )}
                  </strong>
                </div>
              </div>
              <p className="assistance-capture-time">
                Location captured: {assistanceTime(item.location_recorded_at)}
              </p>
              <details className="assistance-record-details">
                <summary>Request details</summary>
                <dl>
                  <div>
                    <dt>Request ID</dt>
                    <dd className="assistance-reference">{item.id}</dd>
                  </div>
                  <div>
                    <dt>Received</dt>
                    <dd>{assistanceTime(item.created_at)}</dd>
                  </div>
                </dl>
              </details>
              <div className="assistance-record-actions">
                <button
                  className="secondary-button"
                  onClick={() => {
                    selectRequest(item.id);
                    setMobileView("map");
                    requestAnimationFrame(() =>
                      mapSection.current?.focus({ preventScroll: true }),
                    );
                  }}
                >
                  View on map
                </button>
                {item.status === "PENDING" && (
                  <button
                    className="primary-button"
                    disabled={busy !== null}
                    onClick={() => void change(item, "ACKNOWLEDGED")}
                  >
                    {busy === item.id ? "Updating..." : "Acknowledge"}
                  </button>
                )}
                {item.status === "ACKNOWLEDGED" && (
                  <button
                    className="primary-button"
                    disabled={busy !== null}
                    onClick={() => void change(item, "DISPATCHED")}
                  >
                    {busy === item.id ? "Updating..." : "Dispatch team"}
                  </button>
                )}
                {item.status === "DISPATCHED" && (
                  <button
                    className="primary-button"
                    disabled={busy !== null}
                    onClick={() => void change(item, "COMPLETED")}
                  >
                    {busy === item.id ? "Updating..." : "Mark completed"}
                  </button>
                )}
                {assistanceActive(item.status) ? (
                  <button
                    className="secondary-button"
                    disabled={busy !== null}
                    onClick={() => void change(item, "CANCELLED")}
                  >
                    Cancel request
                  </button>
                ) : (
                  <button
                    className="secondary-button assistance-delete-button"
                    disabled={busy !== null}
                    onClick={() => void remove(item)}
                  >
                    Delete request
                  </button>
                )}
                <button
                  className="secondary-button"
                  disabled={historyLoading !== null}
                  aria-expanded={Boolean(histories[item.id])}
                  onClick={() => void history(item.id)}
                >
                  <Clock3 size={14} aria-hidden="true" />
                  {historyLoading === item.id
                    ? "Loading history..."
                    : histories[item.id]
                      ? "Hide history"
                      : "Status history"}
                </button>
              </div>
              {histories[item.id] && (
                <ol className="assistance-timeline">
                  {histories[item.id].map((event) => (
                    <li key={event.version}>
                      <strong>{ASSISTANCE_LABELS[event.new_status]}</strong>
                      <time dateTime={event.changed_at}>
                        {assistanceTime(event.changed_at)}
                      </time>
                      <small>
                        {event.actor_kind === "CDRRMO"
                          ? "CDRRMO"
                          : event.actor_kind === "PUBLIC_USER"
                            ? "Request owner"
                            : "System"}
                      </small>
                    </li>
                  ))}
                </ol>
              )}
            </article>
          ))}
        </div>
      </div>
      {deleteDialog}
    </section>
  );
}
