import {
  Check,
  ChevronDown,
  LocateFixed,
  LoaderCircle,
  MapPin,
  Phone,
  UserRound,
} from "lucide-react";
import type { AssistanceLocation } from "@/lib/assistanceLocation";
import styles from "./AssistanceProvider.module.css";

export function AssistanceRequestForm({
  fix,
  source,
  name,
  contact,
  locating,
  submitting,
  online,
  onNameChange,
  onContactChange,
  onLocate,
  onStopLocating,
  onSubmit,
}: {
  fix: AssistanceLocation | null;
  source: "map" | "device" | null;
  name: string;
  contact: string;
  locating: boolean;
  submitting: boolean;
  online: boolean;
  onNameChange: (value: string) => void;
  onContactChange: (value: string) => void;
  onLocate: (forceFresh: boolean) => void;
  onStopLocating: () => void;
  onSubmit: () => void;
}) {
  const busy = locating || submitting;
  return (
    <form
      id="assistance-request-form"
      className={styles.requestForm}
      onSubmit={(event) => {
        event.preventDefault();
        if (fix && !busy && online) onSubmit();
      }}
    >
      <p className={styles.intro}>
        {fix
          ? "Check your location below, then confirm your request."
          : "Get your location to request assistance from CDRRMO."}
      </p>
      <ol className={styles.steps} aria-label="Request steps">
        <li
          aria-current={!fix ? "step" : undefined}
          data-complete={Boolean(fix)}
        >
          <span>{fix ? <Check size={14} aria-hidden="true" /> : "1"}</span>Get
          location
        </li>
        <li aria-current={fix ? "step" : undefined}>
          <span>2</span>Review and send
        </li>
      </ol>
      <section
        className={styles.locationCard}
        aria-labelledby="assistance-location-title"
        aria-busy={locating}
      >
        <div className={styles.sectionHeading}>
          <span className={styles.sectionIcon}>
            <MapPin size={21} aria-hidden="true" />
          </span>
          <div>
            <h3 id="assistance-location-title">Your location</h3>
            <p>Shared once, after you confirm.</p>
          </div>
        </div>
        {fix ? (
          <div className={styles.locationDetails}>
            <span className={styles.accuracy} data-poor={fix.accuracy > 100}>
              Reported accuracy: ±{Math.round(fix.accuracy)} m
            </span>
            <p className={styles.coordinates}>
              {fix.latitude.toFixed(6)}, {fix.longitude.toFixed(6)}
            </p>
            <p className={styles.captureTime}>
              {source === "map"
                ? "Recent map location"
                : "Fresh device reading"}{" "}
              · Captured{" "}
              <time dateTime={fix.recordedAt}>
                {new Date(fix.recordedAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </time>
            </p>
            {fix.accuracy > 100 && (
              <p className={styles.accuracyWarning} role="status">
                Location accuracy is limited. Please try again or contact CDRRMO
                for assistance.
              </p>
            )}
          </div>
        ) : (
          <p className={styles.locationHint}>
            Use your device location, then review the coordinates and reported
            accuracy before sending.
          </p>
        )}
        <div className={styles.locationActions}>
          <button
            type="button"
            className="secondary-button"
            disabled={busy || !online}
            onClick={() => onLocate(Boolean(fix))}
          >
            {locating ? (
              <LoaderCircle
                size={17}
                className={styles.spinner}
                aria-hidden="true"
              />
            ) : (
              <LocateFixed size={17} aria-hidden="true" />
            )}
            {locating
              ? "Getting your location..."
              : fix
                ? "Get a fresh location"
                : "Use current location"}
          </button>
          {locating && (
            <button
              type="button"
              className={styles.textButton}
              onClick={onStopLocating}
            >
              Stop
            </button>
          )}
        </div>
        {locating && (
          <p className={styles.progressMessage} role="status">
            Waiting for your device's location. You can fill in your contact
            details while you wait.
          </p>
        )}
      </section>
      <details className={styles.contactSection}>
        <summary>
          Contact details <span>{name || contact ? "Added" : "Optional"}</span>
          <ChevronDown size={17} aria-hidden="true" />
        </summary>
        <div className={styles.contactGrid}>
          <label>
            <span>
              <UserRound size={15} aria-hidden="true" />
              Name
            </span>
            <input
              value={name}
              maxLength={100}
              autoComplete="name"
              placeholder="Your name"
              disabled={submitting}
              onChange={(event) => onNameChange(event.target.value)}
            />
          </label>
          <label>
            <span>
              <Phone size={15} aria-hidden="true" />
              Contact number
            </span>
            <input
              type="tel"
              value={contact}
              maxLength={40}
              autoComplete="tel"
              placeholder="e.g. 09XX XXX XXXX"
              disabled={submitting}
              onChange={(event) => onContactChange(event.target.value)}
            />
          </label>
        </div>
      </details>
      {!online && (
        <p className={styles.feedback} role="status">
          You are offline. Reconnect before sending your request.
        </p>
      )}
    </form>
  );
}
