"use client";

import {
  ArrowLeft,
  Building2,
  ChevronDown,
  DoorOpen,
  FileText,
  Info,
  Phone,
  Route,
  Users,
} from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { DestinationLabel } from "@/lib/reverseGeocoding";
import type { TravelMode } from "@/lib/travelTime";
import type { EvacuationCenter } from "@/services/api";
import { RouteDetails, type ActiveRouteResult } from "./RouteDetails";
import styles from "./CenterDetails.module.css";

export function CenterDetails({
  center,
  recommended = false,
  onBack,
  route,
}: {
  center: EvacuationCenter;
  recommended?: boolean;
  onBack: () => void;
  route?: {
    result: ActiveRouteResult;
    label: DestinationLabel | null;
    travelMode: TravelMode;
  };
}) {
  const { t } = useLanguage();
  const capacity = Number.isFinite(center.capacity)
    ? Math.max(0, center.capacity)
    : 0;
  const occupied = Number.isFinite(center.currentOccupancy)
    ? Math.max(0, center.currentOccupancy)
    : null;
  const hasCapacity = capacity > 0 && occupied !== null;
  const accepting =
    center.status === "AVAILABLE" || center.status === "NEARLY_FULL";
  const remaining = hasCapacity ? Math.max(0, capacity - occupied!) : null;
  const progress = hasCapacity
    ? Math.min(100, (occupied! / capacity) * 100)
    : 0;
  const tone =
    center.status === "AVAILABLE"
      ? "safe"
      : center.status === "NEARLY_FULL"
        ? "warning"
        : center.status === "FULL"
          ? "danger"
          : "neutral";

  return (
    <section
      className={`selected-center ${styles.details}`}
      aria-labelledby="selected-center-title"
    >
      <button type="button" className={styles.back} onClick={onBack}>
        <ArrowLeft size={18} aria-hidden="true" />
        {t("Back to centers")}
      </button>

      <div className={styles.identity}>
        <span className={styles.symbol} aria-hidden="true">
          <Building2 size={23} />
        </span>
        <span className={styles.eyebrow}>
          {t(recommended ? "RECOMMENDED CENTER" : "SELECTED CENTER")}
        </span>
      </div>
      <h3 id="selected-center-title" tabIndex={-1} className={styles.name}>
        {center.name}
      </h3>
      {center.address && <p className={styles.address}>{center.address}</p>}
      {center.barangayName && (
        <p className={styles.barangay}>
          {t("Barangay")}: {center.barangayName}
        </p>
      )}
      <div className={styles.status}>
        <StatusBadge status={center.status} />
      </div>

      <div className={styles.capacity} data-tone={tone}>
        <div className={styles.capacityHeading}>
          <span>
            <Users size={17} aria-hidden="true" />
            {t("Current occupancy")}
          </span>
          <strong>
            {occupied === null
              ? t("Unavailable")
              : hasCapacity
                ? `${occupied.toLocaleString()} / ${capacity.toLocaleString()}`
                : occupied.toLocaleString()}
          </strong>
        </div>
        {hasCapacity ? (
          <div
            className={styles.progress}
            role="progressbar"
            aria-label={t("Current occupancy")}
            aria-valuemin={0}
            aria-valuemax={capacity}
            aria-valuenow={Math.min(occupied!, capacity)}
            aria-valuetext={t("{occupied} of {capacity} occupied", {
              occupied: occupied!.toLocaleString(),
              capacity: capacity.toLocaleString(),
            })}
          >
            <span style={{ width: `${progress}%` }} />
          </div>
        ) : (
          <p className={styles.capacityUnavailable}>
            {t("Capacity unavailable")}
          </p>
        )}
        {accepting && remaining !== null && (
          <p className={styles.remaining}>
            {t("{count} spaces remaining", {
              count: remaining.toLocaleString(),
            })}
          </p>
        )}
      </div>

      {!accepting && (
        <p className={styles.notAccepting}>
          <Info size={18} aria-hidden="true" />
          {t("This center is not accepting arrivals. Choose another center.")}
        </p>
      )}

      <div className={styles.sections}>
        {center.contactInformation?.trim() && (
          <details className={styles.section}>
            <summary>
              <Phone size={18} aria-hidden="true" />
              <span>{t("Contact details")}</span>
              <ChevronDown size={17} aria-hidden="true" />
            </summary>
            <div className={styles.sectionBody}>
              <p>{center.contactInformation}</p>
            </div>
          </details>
        )}
        {center.entranceInformation?.trim() && (
          <details className={styles.section}>
            <summary>
              <DoorOpen size={18} aria-hidden="true" />
              <span>{t("Entrance information")}</span>
              <ChevronDown size={17} aria-hidden="true" />
            </summary>
            <div className={styles.sectionBody}>
              <p>{center.entranceInformation}</p>
            </div>
          </details>
        )}
        {center.notes?.trim() && (
          <details className={styles.section}>
            <summary>
              <FileText size={18} aria-hidden="true" />
              <span>{t("Shelter notes")}</span>
              <ChevronDown size={17} aria-hidden="true" />
            </summary>
            <div className={styles.sectionBody}>
              <p>{center.notes}</p>
            </div>
          </details>
        )}
        {route && (
          <details className={styles.section} open>
            <summary>
              <Route size={18} aria-hidden="true" />
              <span>{t("Route information")}</span>
              <ChevronDown size={17} aria-hidden="true" />
            </summary>
            <div className={styles.routeBody}>
              <RouteDetails
                result={route.result}
                label={route.label}
                travelMode={route.travelMode}
                hideHeading
              />
            </div>
          </details>
        )}
      </div>
    </section>
  );
}
