import {
  Check,
  LocateFixed,
  LoaderCircle,
  MapPin,
  Pencil,
  Phone,
  UserRound,
} from "lucide-react";
import type { AssistanceLocation } from "@/lib/assistanceLocation";
import { useAssistanceLocationName } from "@/hooks/useAssistanceLocationName";
import styles from "./AssistanceProvider.module.css";

export function AssistanceRequestForm({
  fix,
  source,
  name,
  contact,
  locating,
  submitting,
  online,
  onEditContact,
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
  onEditContact: () => void;
  onLocate: (forceFresh: boolean) => void;
  onStopLocating: () => void;
  onSubmit: () => void;
}) {
  const busy = locating || submitting;
  const locationName = useAssistanceLocationName(fix);
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
          : locating
            ? "Getting your location. Review your details while you wait."
            : "Use your current location to request assistance from CDRRMO."}
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
            <p className={styles.locationName} aria-live="polite">
              {locationName.name
                ? `Near ${locationName.name}`
                : "Location captured"}
            </p>
            <p className={styles.smallNote}>
              {locationName.loading
                ? "Finding a nearby street on your device…"
                : locationName.name
                  ? "Approximate nearby street. Check the reported accuracy."
                  : "Street name unavailable. Your device location is ready to share."}
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
            {locating
              ? "Allow location access if your browser asks. Nothing is sent until you confirm."
              : "Try getting your location again, then review the reported accuracy before sending."}
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
            Waiting for your device's location. You can stop and try again if
            needed.
          </p>
        )}
      </section>
      <section
        className={styles.contactSection}
        aria-labelledby="request-contact-title"
      >
        <div className={styles.contactHeading}>
          <h3 id="request-contact-title">Contact details</h3>
          <button
            type="button"
            className={styles.contactEdit}
            disabled={submitting}
            onClick={onEditContact}
            aria-label="Edit saved contact details"
          >
            <Pencil size={14} aria-hidden="true" />
            Edit
          </button>
        </div>
        <div className={styles.savedContactSummary}>
          <dl>
            <div>
              <dt>
                <UserRound size={13} aria-hidden="true" /> Name
              </dt>
              <dd>{name || "Not added"}</dd>
            </div>
            <div>
              <dt>
                <Phone size={13} aria-hidden="true" /> Contact number
              </dt>
              <dd>{contact || "Not added"}</dd>
            </div>
          </dl>
        </div>
      </section>
      {!online && (
        <p className={styles.feedback} role="status">
          You are offline. Reconnect before sending your request.
        </p>
      )}
    </form>
  );
}
