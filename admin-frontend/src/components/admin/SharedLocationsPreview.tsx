"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, MapPin, RefreshCw } from "lucide-react";
import { isVisibleAssistanceRequest } from "@/lib/assistanceVisibility";
import { ASSISTANCE_LABELS } from "@/lib/assistance";
import { useAssistanceNotifications } from "./AssistanceNotifications";
import { SkeletonBlock } from "./Skeleton";
import dashboardStyles from "./CdrrmoDashboard.module.css";
import styles from "./SharedLocationsPreview.module.css";

export function SharedLocationsPreview() {
  const { feed, refresh, review } = useAssistanceNotifications();
  const requests = (feed.page?.requests ?? []).filter(
    isVisibleAssistanceRequest,
  );
  const loading = feed.loading && !feed.page;
  const error = Boolean(feed.error);
  const [limit, setLimit] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const observer = new ResizeObserver(() => {
      setLimit(Math.max(0, Math.min(3, Math.floor(list.clientHeight / 64))));
    });
    observer.observe(list);
    return () => observer.disconnect();
  }, []);

  const statusCounts = [
    { status: "PENDING", label: "Pending" },
    { status: "ACKNOWLEDGED", label: "Acknowledged" },
    { status: "DISPATCHED", label: "Dispatched" },
  ] as const;
  const openRequests = statusCounts.flatMap(({ status }) =>
    requests.filter((request) => request.status === status),
  );
  const available = !loading && !error;

  return (
    <section
      className={`${dashboardStyles.panel} ${styles.preview}`}
      aria-label="Assistance requests overview"
    >
      <div className={dashboardStyles.panelHeading}>
        <h3>Assistance requests</h3>
        <div className={styles.controls}>
          <button
            type="button"
            className={styles.refresh}
            disabled={feed.loading}
            aria-label="Refresh shared locations"
            onClick={refresh}
          >
            <RefreshCw size={14} aria-hidden="true" />
          </button>
          <a href="#shared-locations">
            View all <ArrowUpRight size={15} aria-hidden="true" />
          </a>
        </div>
      </div>
      <div className={styles.scope}>Among latest 100 requests</div>
      <dl
        className={styles.stats}
        aria-label="Assistance status counts"
        aria-busy={loading}
      >
        {statusCounts.map(({ status, label }) => (
          <div key={status} data-status={status}>
            <dt>{label}</dt>
            <dd>
              {available ? (
                requests
                  .filter((request) => request.status === status)
                  .length.toLocaleString()
              ) : (
                <span aria-label={loading ? "Loading" : "Unavailable"}>—</span>
              )}
            </dd>
          </div>
        ))}
      </dl>
      <p className={styles.pendingHint}>
        Pending requests are waiting for acknowledgment.
      </p>
      <div className={styles.list} ref={listRef} aria-busy={loading}>
        {loading ? (
          <>
            <span className="staff-skeleton-label" role="status">
              Loading assistance requests...
            </span>
            {Array.from({ length: limit }, (_, index) => (
              <div className={styles.loadingRow} key={index}>
                <SkeletonBlock className={styles.loadingIcon} />
                <div className="staff-skeleton-copy">
                  <SkeletonBlock className="staff-skeleton-line" />
                  <SkeletonBlock className="staff-skeleton-line staff-skeleton-short" />
                </div>
              </div>
            ))}
          </>
        ) : error ? (
          <div className={styles.feedback} role="status">
            <p>Could not load assistance requests.</p>
            <button type="button" onClick={refresh}>
              Try again
            </button>
          </div>
        ) : !openRequests.length ? (
          <div className={styles.feedback} role="status">
            <MapPin size={24} aria-hidden="true" />
            <p>No open requests among the latest 100.</p>
          </div>
        ) : (
          openRequests.slice(0, limit).map((request) => (
            <a
              className={styles.request}
              href="#shared-locations"
              onClick={() => review(request.id)}
              key={request.id}
              aria-label={`View shared locations for ${request.display_name || "this request"}`}
            >
              <span className={styles.pin}>
                <MapPin size={17} aria-hidden="true" />
              </span>
              <span className={styles.copy}>
                <strong>{request.display_name || "Name not provided"}</strong>
                <small>
                  {request.location_name
                    ? `Near ${request.location_name.roadName}`
                    : `${request.latitude.toFixed(4)}, ${request.longitude.toFixed(4)}`}
                </small>
              </span>
              <span className={styles.status} data-status={request.status}>
                {ASSISTANCE_LABELS[request.status]}
              </span>
            </a>
          ))
        )}
      </div>
    </section>
  );
}
