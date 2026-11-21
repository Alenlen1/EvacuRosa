"use client";

import { useEffect, useId, useRef, useState } from "react";
import { LoaderCircle, MapPin, MapPinOff, X } from "lucide-react";
import { useLanguage } from "./LanguageProvider";
import { LocationRecovery } from "./LocationRecovery";
import type { GeolocationState } from "@/hooks/useGeolocation";
import styles from "./PublicStatus.module.css";

export function PublicStatus({
  location,
  onRetryLocation,
}: {
  location: GeolocationState;
  onRetryLocation: () => void;
}) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const locationButton = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const panelTitleId = `${panelId}-title`;
  const located = location.status === "active";
  const checking = location.status === "idle" || location.status === "locating";
  const statusLabel = t(
    located
      ? "Location active"
      : checking
        ? "Checking location"
        : "Location unavailable",
  );
  const StatusIcon = located ? MapPin : checking ? LoaderCircle : MapPinOff;
  const accuracy = location.position?.accuracy;
  function closeAndFocus() {
    locationButton.current?.focus();
    setOpen(false);
  }

  function retryLocation() {
    closeButton.current?.focus({ preventScroll: true });
    onRetryLocation();
  }

  useEffect(() => {
    if (!open) return;
    function outside(event: PointerEvent) {
      if (event.target instanceof Node && !root.current?.contains(event.target))
        setOpen(false);
    }
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (root.current?.contains(document.activeElement)) {
          event.preventDefault();
          locationButton.current?.focus();
        }
        setOpen(false);
      }
    }
    const mobile = window.matchMedia(
      "(max-width: 800px), (max-width: 1100px) and (max-height: 500px)",
    );
    const resize = () => {
      if (!mobile.matches) setOpen(false);
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

  return (
    <div ref={root} className={styles.control} data-public-status>
      <button
        ref={locationButton}
        type="button"
        className={styles.trigger}
        data-ready={located}
        data-checking={checking}
        data-status-trigger="location"
        title={statusLabel}
        aria-label={`${statusLabel}. ${t("Location help")}`}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(!open)}
      >
        <StatusIcon size={18} aria-hidden="true" />
        <span className={styles.statusLabel} role="status">
          {statusLabel}
        </span>
      </button>
      <section
        id={panelId}
        hidden={!open}
        data-status-panel
        data-ready={located}
        data-checking={checking}
        className={styles.panel}
        aria-labelledby={panelTitleId}
      >
        <header className={styles.panelHeading}>
          <span className={styles.panelIcon}>
            <StatusIcon size={18} aria-hidden="true" />
          </span>
          <h2 id={panelTitleId}>{statusLabel}</h2>
          <button
            ref={closeButton}
            type="button"
            onClick={closeAndFocus}
            aria-label={t("Close status details")}
          >
            <X size={17} aria-hidden="true" />
          </button>
        </header>
        {located ? (
          accuracy !== undefined && Number.isFinite(accuracy) ? (
            <dl className={styles.accuracy}>
              <dt>{t("Estimated GPS accuracy")}</dt>
              <dd>±{Math.round(accuracy)} m</dd>
            </dl>
          ) : (
            <p className={styles.statusText}>
              {t("Your location is available for route planning.")}
            </p>
          )
        ) : checking ? (
          <p className={styles.statusText}>
            {t("Waiting for your device to send a location.")}
          </p>
        ) : (
          <LocationRecovery
            location={location}
            onRetry={retryLocation}
            embedded
          />
        )}
      </section>
    </div>
  );
}
