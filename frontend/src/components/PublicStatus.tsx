"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  ChevronDown,
  CircleCheck,
  CloudDownload,
  MapPin,
  X,
} from "lucide-react";
import { useLanguage } from "./LanguageProvider";
import { LocationRecovery } from "./LocationRecovery";
import type { GeolocationState } from "@/hooks/useGeolocation";
import type { OfflineStatus } from "@/lib/offline/routing";
import styles from "./PublicStatus.module.css";

export function PublicStatus({
  status,
  online,
  location,
  onRetryLocation,
  onUpdateOffline,
  formatTime,
}: {
  status: OfflineStatus;
  online: boolean;
  location: GeolocationState;
  onRetryLocation: () => void;
  onUpdateOffline: () => void;
  formatTime: (iso: string) => string;
}) {
  const { t } = useLanguage();
  const [open, setOpen] = useState<"offline" | "location" | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const offlineButton = useRef<HTMLButtonElement>(null);
  const locationButton = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const ready = status.state === "ready";
  const preparing =
    status.state === "checking" || status.state === "downloading";
  const located = location.status === "active";
  const locationUnavailable =
    ["denied", "timeout", "unavailable"].includes(location.status) ||
    !!location.error;
  const fullStatus = ready
    ? t(
        process.env.NODE_ENV !== "production"
          ? "Offline ready for this session"
          : status.mapReady
            ? "Offline maps and routes ready"
            : "Offline routes ready",
      )
    : preparing
      ? t("Preparing offline routing… Keep the app open.")
      : t("Offline routing is not ready.");

  function closeAndFocus() {
    (open === "offline" ? offlineButton : locationButton).current?.focus();
    setOpen(null);
  }

  useEffect(() => {
    if (!open) return;
    function outside(event: PointerEvent) {
      if (event.target instanceof Node && !root.current?.contains(event.target))
        setOpen(null);
    }
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (root.current?.contains(document.activeElement)) {
          event.preventDefault();
          (open === "offline" ? offlineButton : locationButton).current?.focus();
        }
        setOpen(null);
      }
    }
    const mobile = window.matchMedia(
      "(max-width: 800px), (max-width: 1100px) and (max-height: 500px)",
    );
    const resize = () => {
      if (!mobile.matches) setOpen(null);
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    mobile.addEventListener("change", resize);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
      mobile.removeEventListener("change", resize);
    };
  }, [open]);

  const offlineDetails = (
    <>
      <div className="offline-readiness-details">
        <span className="offline-readiness-copy">
          {status.updatedAt && (
            <small title={new Date(status.updatedAt).toLocaleString()}>
              {t("Saved {time}", { time: formatTime(status.updatedAt) })}
            </small>
          )}
          {status.message && <span>{t(status.message)}</span>}
        </span>
        {online && !preparing && (
          <button type="button" onClick={onUpdateOffline}>
            {t(ready ? "Update offline data" : "Retry download")}
          </button>
        )}
      </div>
    </>
  );

  return (
    <div ref={root} className={styles.bar} data-public-status>
      <div className={styles.desktop}>
        <details className="offline-readiness" open={!ready}>
          <summary>
            <strong role="status">{fullStatus}</strong>
          </summary>
          {offlineDetails}
        </details>
        <LocationRecovery location={location} onRetry={onRetryLocation} />
      </div>
      <div className={styles.mobile}>
        <div className={styles.row}>
          <button
            ref={offlineButton}
            type="button"
            className={styles.chip}
            data-ready={ready}
            data-status-trigger="offline"
            aria-expanded={open === "offline"}
            aria-controls={panelId}
            onClick={() => setOpen(open === "offline" ? null : "offline")}
          >
            {ready ? (
              <CircleCheck size={15} aria-hidden="true" />
            ) : (
              <CloudDownload size={15} aria-hidden="true" />
            )}
            <span role="status">
              {t(
                ready
                  ? "Offline ready"
                  : preparing
                    ? "Preparing offline data"
                    : "Offline not ready",
              )}
            </span>
            <ChevronDown size={13} aria-hidden="true" />
          </button>
          <button
            ref={locationButton}
            type="button"
            className={styles.chip}
            data-ready={located}
            data-status-trigger="location"
            aria-expanded={open === "location"}
            aria-controls={panelId}
            onClick={() => setOpen(open === "location" ? null : "location")}
          >
            <MapPin size={15} aria-hidden="true" />
            <span role="status">
              {t(
                located
                  ? "Location active"
                  : locationUnavailable
                    ? "Location unavailable"
                    : "Checking location",
              )}
            </span>
            <ChevronDown size={13} aria-hidden="true" />
          </button>
        </div>
        {
          <section
            id={panelId}
            hidden={!open}
            data-status-panel
            className={styles.panel}
            role="region"
            aria-label={t(
              open === "offline" ? "Offline information" : "Location help",
            )}
          >
            <header className={styles.panelHeading}>
              <strong>
                {t(
                  open === "offline" ? "Offline information" : "Location help",
                )}
              </strong>
              <button
                type="button"
                onClick={closeAndFocus}
                aria-label={t("Close status details")}
              >
                <X size={17} aria-hidden="true" />
              </button>
            </header>
            {open === "offline" ? (
              <>
                <p className={styles.statusText}>{fullStatus}</p>
                {offlineDetails}
              </>
            ) : located ? (
              <>
                <p className={styles.statusText}>
                  {t("Your location is available for route planning.")}
                </p>
                {location.position &&
                  Number.isFinite(location.position.accuracy) && (
                    <p className={styles.statusText}>
                      {t("GPS accuracy: approximately {meters} m", {
                        meters: Math.round(location.position.accuracy),
                      })}
                    </p>
                  )}
              </>
            ) : locationUnavailable ? (
              <LocationRecovery location={location} onRetry={onRetryLocation} />
            ) : (
              <>
                <p className={styles.statusText}>
                  {t("Checking your location…")}
                </p>
                <button
                  type="button"
                  className={styles.retry}
                  onClick={onRetryLocation}
                >
                  {t("Try location again")}
                </button>
              </>
            )}
          </section>
        }
      </div>
    </div>
  );
}
