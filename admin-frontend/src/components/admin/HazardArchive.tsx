"use client";
import { useEffect, useRef, useState } from "react";
import { Archive, RefreshCw, RotateCcw, Trash2 } from "lucide-react";
import { useConfirmation } from "./DeleteConfirmationDialog";
import { formatHazardDateTime } from "@/lib/hazardDateTime";
import styles from "./HazardArchive.module.css";

interface ArchivedHazard {
  id: string;
  hazard_type: "flood" | "fire" | "impact" | "event";
  original_id: string;
  archived_at: string;
  roadName?: string;
  snapshot: {
    severity?: string;
    impact_level?: string;
    road_impassable?: boolean;
    confirmed_blocked?: boolean;
    latitude?: number;
    longitude?: number;
    notes?: string;
    reported_at?: string;
    verified_at?: string;
    occurred_at?: string;
    impact_area?: { latitude: number; longitude: number; shape?: string };
  };
}
const labels = {
  flood: "Flood report",
  fire: "Fire incident",
  impact: "Earthquake report",
  event: "Earthquake event",
};
const api = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export function HazardArchive({
  authToken,
  onRestored,
}: {
  authToken: string;
  onRestored: () => void;
}) {
  const { confirm, dialog } = useConfirmation();
  const [records, setRecords] = useState<ArchivedHazard[]>([]);
  const [page, setPage] = useState(0),
    [hasMore, setHasMore] = useState(false);
  const [refresh, setRefresh] = useState(0),
    [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null),
    [error, setError] = useState("");
  const [busyAction, setBusyAction] = useState<"restore" | "delete">("restore");
  const [notice, setNotice] = useState("");
  const pending = useRef(false),
    mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 3000);
    return () => clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    const abort = new AbortController();
    setLoading(true);
    setError("");
    void (async () => {
      try {
        const response = await fetch(
          `${api}/api/admin/hazard-archives?offset=${page * 50}`,
          {
            headers: { Authorization: `Bearer ${authToken}` },
            cache: "no-store",
            signal: AbortSignal.any([abort.signal, AbortSignal.timeout(15000)]),
          },
        );
        const body = await response.json();
        if (!response.ok) throw Error(body.error ?? "Could not load archives.");
        if (!abort.signal.aborted) {
          setRecords(body.archives);
          setHasMore(body.hasMore);
        }
      } catch (cause) {
        if (!abort.signal.aborted)
          setError(
            cause instanceof Error ? cause.message : "Could not load archives.",
          );
      } finally {
        if (!abort.signal.aborted) setLoading(false);
      }
    })();
    return () => abort.abort();
  }, [authToken, page, refresh]);
  async function updateArchive(
    record: ArchivedHazard,
    action: "restore" | "delete",
  ) {
    const deleting = action === "delete";
    if (
      pending.current ||
      !(await confirm({
        variant: deleting ? "delete" : "complete",
        title: deleting
          ? "Permanently delete this archived hazard?"
          : "Restore this hazard?",
        subject: [labels[record.hazard_type], record.roadName]
          .filter(Boolean)
          .join(" · "),
        confirmLabel: deleting ? "Delete permanently" : "Restore hazard",
        cancelLabel: "Keep in archive",
        description: deleting
          ? "This permanently removes the archived report and its saved details. It cannot be restored afterward. Active hazard reports and current routes are unchanged."
          : "Review current conditions first. This republishes the saved hazard and its road restrictions to the public map and routing. The original report details and dates are preserved.",
      }))
    )
      return;
    if (!mounted.current || pending.current) return;
    pending.current = true;
    setBusy(record.id);
    setBusyAction(action);
    setError("");
    setNotice("");
    try {
      const response = await fetch(
        `${api}/api/admin/hazard-archives/${encodeURIComponent(record.id)}${deleting ? "" : "/restore"}`,
        {
          method: deleting ? "DELETE" : "POST",
          headers: {
            Authorization: `Bearer ${authToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ confirmed: true }),
          signal: AbortSignal.timeout(15000),
        },
      );
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw Error(body.error ?? "Could not update the archived hazard.");
      }
      if (mounted.current) {
        setRecords((rows) => rows.filter((row) => row.id !== record.id));
        setNotice(
          deleting
            ? "Archived hazard permanently deleted."
            : "Hazard restored to active records.",
        );
        setRefresh((v) => v + 1);
      }
      if (!deleting) onRestored();
    } catch (cause) {
      if (mounted.current)
        setError(
          cause instanceof Error
            ? cause.message
            : "The archive update could not be confirmed. Refresh before retrying.",
        );
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(null);
    }
  }
  return (
    <section className={styles.archive} aria-labelledby="hazard-archive-title">
      <header className={styles.heading}>
        <div>
          <h3 id="hazard-archive-title">
            <Archive size={21} aria-hidden="true" />
            Hazard archive
          </h3>
          <p>
            Removed hazards are kept here. Archived records do not affect the
            public map or routes.
          </p>
        </div>
        <button
          type="button"
          className="secondary-button"
          disabled={loading || busy !== null}
          onClick={() => setRefresh((v) => v + 1)}
        >
          <RefreshCw size={16} aria-hidden="true" />
          Refresh
        </button>
      </header>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className={styles.notice} role="status">
          {notice}
        </p>
      )}
      {loading ? (
        <p role="status">Loading archived hazards...</p>
      ) : !records.length && !error ? (
        <p>No archived hazards on this page.</p>
      ) : null}
      <div className={styles.records}>
        {records.map((record) => {
          const saved = record.snapshot;
          const position = saved.impact_area ?? saved;
          return (
            <article className={styles.record} key={record.id}>
              <div className={styles.recordHeading}>
                <h4>{labels[record.hazard_type]}</h4>
                <span>
                  {saved.severity ?? saved.impact_level ?? "Informational"}
                </span>
              </div>
              {record.roadName && <strong>{record.roadName}</strong>}
              {typeof position.latitude === "number" &&
                typeof position.longitude === "number" && (
                  <p>
                    Location: {position.latitude.toFixed(6)},{" "}
                    {position.longitude.toFixed(6)}
                  </p>
                )}
              <p>Archived: {formatHazardDateTime(record.archived_at)}</p>
              <p>
                Originally reported:{" "}
                {formatHazardDateTime(
                  saved.reported_at ?? saved.verified_at ?? saved.occurred_at,
                ) ?? "Unavailable"}
              </p>
              {(saved.road_impassable || saved.confirmed_blocked) && (
                <p className={styles.warning}>
                  Saved with blocked road restrictions.
                </p>
              )}
              {saved.notes && <p className={styles.notes}>{saved.notes}</p>}
              <details>
                <summary>Record reference</summary>
                <p>{record.original_id}</p>
              </details>
              <div className={styles.actions}>
                <button
                  type="button"
                  className="secondary-button"
                  disabled={busy !== null || loading}
                  onClick={() => void updateArchive(record, "restore")}
                >
                  <RotateCcw size={16} aria-hidden="true" />
                  {busy === record.id && busyAction === "restore"
                    ? "Restoring..."
                    : "Restore hazard"}
                </button>
                <button
                  type="button"
                  className={`secondary-button ${styles.deleteButton}`}
                  disabled={busy !== null || loading}
                  onClick={() => void updateArchive(record, "delete")}
                >
                  <Trash2 size={16} aria-hidden="true" />
                  {busy === record.id && busyAction === "delete"
                    ? "Deleting..."
                    : "Delete permanently"}
                </button>
              </div>
            </article>
          );
        })}
      </div>
      {(hasMore || page > 0) && (
        <nav className={styles.pagination} aria-label="Hazard archive pages">
          <button
            type="button"
            className="secondary-button"
            disabled={page === 0 || loading || busy !== null}
            onClick={() => {
              setRecords([]);
              setPage((v) => v - 1);
            }}
          >
            Previous
          </button>
          <span>Page {page + 1}</span>
          <button
            type="button"
            className="secondary-button"
            disabled={!hasMore || loading || busy !== null}
            onClick={() => {
              setRecords([]);
              setPage((v) => v + 1);
            }}
          >
            Next
          </button>
        </nav>
      )}
      {dialog}
    </section>
  );
}
