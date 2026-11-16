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
  const panelId = useId();
  const located = location.status === "active";
  const locationUnavailable =
    ["denied", "timeout", "unavailable"].includes(location.status) ||
    !!location.error;
  const statusLabel = t(
    located
      ? "Location active"
      : locationUnavailable
        ? "Location unavailable"
        : "Checking location",
  );
  const StatusIcon = located
    ? MapPin
    : locationUnavailable
      ? MapPinOff
      : LoaderCircle;
  function closeAndFocus() {
    locationButton.current?.focus();
    setOpen(false);
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
        data-checking={!located && !locationUnavailable}
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
        className={styles.panel}
        role="region"
        aria-label={t("Location help")}
      >
        <header className={styles.panelHeading}>
          <strong>{t("Location help")}</strong>
          <button
            type="button"
            onClick={closeAndFocus}
            aria-label={t("Close status details")}
          >
            <X size={17} aria-hidden="true" />
          </button>
        </header>
        <p className={styles.currentStatus}>{statusLabel}</p>
        {located ? (
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
            <p className={styles.statusText}>{t("Checking your location…")}</p>
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
    </div>
  );
}
