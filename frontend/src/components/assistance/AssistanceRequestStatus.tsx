import dynamic from "next/dynamic";
import { CircleCheck, Clock3, MapPin, ShieldCheck, X } from "lucide-react";
import {
  ASSISTANCE_LABELS,
  ASSISTANCE_MESSAGES,
  type TrackedAssistance,
} from "@/lib/assistance";
import type { AssistanceView } from "@/lib/assistanceView";
import { AssistanceProgress } from "./AssistanceProgress";
import { RequestReference } from "./RequestReference";
import {
  assistanceConnection,
  formatAssistanceTime,
} from "@/lib/assistancePresentation";
import styles from "./AssistanceProvider.module.css";

const ReportedLocationMap = dynamic(() => import("./ReportedLocationMap"), {
  ssr: false,
  loading: () => (
    <div className={styles.mapLoading} role="status">
      Loading reported location...
    </div>
  ),
});

export function AssistanceRequestStatus({
  tracking,
  terminal,
  online,
  confirmed,
  lastCheckedAt,
  connection,
  unavailable,
  view,
  onRetry,
  onViewChange,
}: {
  tracking: TrackedAssistance;
  terminal: boolean;
  online: boolean;
  confirmed: boolean;
  lastCheckedAt: string | null;
  connection: string;
  unavailable: boolean;
  view: AssistanceView;
  onRetry: () => void;
  onViewChange: (view: AssistanceView) => void;
}) {
  const { request } = tracking;
  const StatusIcon =
    request.status === "CANCELLED"
      ? X
      : request.status === "COMPLETED"
        ? CircleCheck
        : request.status === "PENDING"
          ? Clock3
          : ShieldCheck;
  const outdated =
    !online ||
    !confirmed ||
    unavailable ||
    connection === "Status May Be Outdated";
  const connectionState = assistanceConnection({
    online,
    confirmed,
    terminal,
    connection,
    unavailable,
  });
  const coordinates = `${request.latitude.toFixed(6)}, ${request.longitude.toFixed(6)}`;

  return (
    <section
      id="assistance-request-panel"
      role="tabpanel"
      aria-labelledby={`assistance-tab-${view}`}
      className={
        view === "location" ? styles.locationPanel : styles.requestPanel
      }
    >
      {view === "overview" && (
        <>
          <AssistanceProgress tracking={tracking} outdated={outdated} />
          <section
            className={styles.statusCard}
            data-status={request.status}
            aria-live="polite"
          >
            <span className={styles.statusIcon}>
              <StatusIcon size={20} aria-hidden="true" />
            </span>
            <div>
              <h3>{ASSISTANCE_LABELS[request.status]}</h3>
              <p>{ASSISTANCE_MESSAGES[request.status]}</p>
            </div>
          </section>
          <div className={styles.connectionDetails}>
            <p
              className={styles.connection}
              data-state={connectionState.state}
              role="status"
            >
              <span aria-hidden="true" />
              {connectionState.label}
            </p>
            <p className={styles.lastChecked}>
              {lastCheckedAt ? (
                <>
                  Last checked at{" "}
                  <time
                    dateTime={lastCheckedAt}
                    title={formatAssistanceTime(lastCheckedAt)}
                  >
                    {formatAssistanceTime(lastCheckedAt, false)}
                  </time>
                </>
              ) : (
                "Not checked this session"
              )}
            </p>
          </div>
          {outdated && (
            <p className={styles.staleNote}>
              Showing last known status. Updates may be delayed.
            </p>
          )}
          {unavailable && (
            <button className="secondary-button" onClick={onRetry}>
              Check status again
            </button>
          )}
          <dl className={styles.trackingDetails}>
            <RequestReference key={request.id} id={request.id} />
            <div>
              <dt>Submitted</dt>
              <dd>
                <time dateTime={request.created_at}>
                  {formatAssistanceTime(request.created_at)}
                </time>
              </dd>
            </div>
            <div>
              <dt>Status updated</dt>
              <dd>
                <time
                  dateTime={request.status_updated_at ?? request.created_at}
                >
                  {formatAssistanceTime(
                    request.status_updated_at ?? request.created_at,
                  )}
                </time>
              </dd>
            </div>
          </dl>
          <section
            className={styles.locationSummary}
            aria-labelledby="reported-location-title"
          >
            <div className={styles.sectionHeading}>
              <MapPin size={19} aria-hidden="true" />
              <div>
                <h3 id="reported-location-title">Reported location</h3>
                <p>
                  GPS snapshot · ±{Math.round(request.accuracy_meters)} m
                  accuracy
                </p>
              </div>
            </div>
            <button
              type="button"
              className="secondary-button"
              aria-label="View reported location"
              onClick={() => onViewChange("location")}
            >
              View location
            </button>
          </section>
        </>
      )}
      {view === "location" && (
        <>
          <div className={styles.locationMetadata}>
            <p className={styles.coordinates}>{coordinates}</p>
            <span
              className={styles.accuracy}
              data-poor={request.accuracy_meters > 100}
            >
              Reported accuracy: ±{Math.round(request.accuracy_meters)} m
            </span>
            <p className={styles.captureTime}>
              Captured{" "}
              <time dateTime={request.location_recorded_at}>
                {formatAssistanceTime(request.location_recorded_at)}
              </time>
            </p>
          </div>
          <div className={styles.locationMap}>
            <ReportedLocationMap request={request} />
          </div>
          <p className={styles.mapNote}>
            One-time reported location. Contact CDRRMO if you move.
          </p>
        </>
      )}
      {view === "history" && (
        <section
          className={styles.history}
          aria-labelledby="assistance-history-title"
        >
          <h3 id="assistance-history-title">Status history</h3>
          <ol className="assistance-timeline">
            {tracking.history.map((item) => (
              <li key={item.version}>
                <strong>{ASSISTANCE_LABELS[item.new_status]}</strong>
                <time dateTime={item.changed_at}>
                  {formatAssistanceTime(item.changed_at)}
                </time>
                <small>
                  {item.actor_kind === "CDRRMO"
                    ? "CDRRMO operator"
                    : item.actor_kind === "PUBLIC_USER"
                      ? "Request owner"
                      : "Previous system record"}
                </small>
              </li>
            ))}
          </ol>
          {!terminal && (
            <p className={styles.smallNote}>
              Further stages are pending confirmation by CDRRMO.
            </p>
          )}
        </section>
      )}
    </section>
  );
}
