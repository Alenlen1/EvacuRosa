import dynamic from "next/dynamic";
import { CircleCheck, Clock3, MapPin, ShieldCheck, X } from "lucide-react";
import {
  ASSISTANCE_LABELS,
  ASSISTANCE_MESSAGES,
  type TrackedAssistance,
} from "@/lib/assistance";
import type { AssistanceView } from "@/lib/assistanceView";
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
    !online || !confirmed || connection === "Status May Be Outdated";
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
          <section
            className={styles.statusCard}
            data-status={request.status}
            aria-live="polite"
          >
            <span className={styles.statusIcon}>
              <StatusIcon size={25} aria-hidden="true" />
            </span>
            <div>
              <h3>{ASSISTANCE_LABELS[request.status]}</h3>
              <p>{ASSISTANCE_MESSAGES[request.status]}</p>
            </div>
          </section>
          <p
            className={styles.connection}
            data-outdated={outdated}
            role="status"
          >
            <span aria-hidden="true" />
            {!online ? "Offline" : terminal ? "Status confirmed" : connection}
            {outdated && " · Status may be outdated"}
          </p>
          {unavailable && (
            <button className="secondary-button" onClick={onRetry}>
              Check status again
            </button>
          )}
          <dl className={styles.trackingDetails}>
            <div className={styles.requestReference}>
              <dt>Request reference</dt>
              <dd>{request.id}</dd>
            </div>
            <div>
              <dt>Submitted</dt>
              <dd>{new Date(request.created_at).toLocaleString()}</dd>
            </div>
            <div>
              <dt>Latest update</dt>
              <dd>
                {new Date(
                  request.status_updated_at ?? request.created_at,
                ).toLocaleString()}
              </dd>
            </div>
          </dl>
          <section
            className={styles.locationSummary}
            aria-labelledby="reported-location-title"
          >
            <div className={styles.sectionHeading}>
              <MapPin size={19} aria-hidden="true" />
              <h3 id="reported-location-title">Reported location</h3>
            </div>
            <p className={styles.coordinates}>{coordinates}</p>
            <p className={styles.captureTime}>
              Reported accuracy: ±{Math.round(request.accuracy_meters)} m
            </p>
            <button
              type="button"
              className="secondary-button"
              onClick={() => onViewChange("location")}
            >
              <MapPin size={16} aria-hidden="true" />
              View reported location
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
                {new Date(request.location_recorded_at).toLocaleString()}
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
                  {new Date(item.changed_at).toLocaleString()}
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
