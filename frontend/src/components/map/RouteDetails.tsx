"use client";
import { useLanguage } from "@/components/LanguageProvider";
import { Clock3, MapPin, Route, ShieldAlert } from "lucide-react";
import type {
  RouteResponse,
  EvacuationRouteResponse,
  EvacuationCenter,
} from "@/services/api";
import type { DestinationLabel } from "@/lib/reverseGeocoding";
import { StatusBadge } from "@/components/ui/StatusBadge";
import {
  TRAVEL_MODES,
  estimatedTravelTime,
  type TravelMode,
} from "@/lib/travelTime";
import styles from "./RouteDetails.module.css";

export type ActiveRouteResult =
  | { kind: "route"; data: RouteResponse }
  | { kind: "evacuation"; data: EvacuationRouteResponse };

export function routeRiskLabel(level: string | null) {
  const value = level ? level.replaceAll("_", " ").toLowerCase() : "unknown";
  return `Route risk: ${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

export function RouteDetails({
  result,
  label,
  center,
  travelMode,
  hideHeading = false,
}: {
  result: ActiveRouteResult;
  label: DestinationLabel | null;
  center?: EvacuationCenter;
  travelMode: TravelMode;
  hideHeading?: boolean;
}) {
  const { t } = useLanguage();
  const travelTime = estimatedTravelTime(result.data.distance, travelMode);
  const mode = TRAVEL_MODES[travelMode];
  const shelter =
    center ??
    (result.kind === "evacuation" ? result.data.recommendedCenter : undefined);
  const spacesRemaining =
    shelter && (shelter.status === "AVAILABLE" || shelter.status === "NEARLY_FULL")
      ? Math.max(0, shelter.capacity - shelter.currentOccupancy)
      : null;
  const risk = (result.data.riskLevel ?? "UNKNOWN").replaceAll("_", " ");
  const hasLocationDetails = Boolean(label?.subtitle || center);

  return (
    <section
      className={`route-summary ${styles.summary}`}
      aria-label={t("Active route")}
      aria-live="polite"
    >
      {!hideHeading && (
        <>
          <span className="eyebrow">{t("ROUTE DESTINATION")}</span>
          <h3>{label?.title ?? t("Selected destination")}</h3>
        </>
      )}
      <dl className={styles.metrics}>
        <div>
          <dt>
            <Route size={15} aria-hidden="true" />
            {t("Route distance")}
          </dt>
          <dd>{(result.data.distance / 1000).toFixed(1)} km</dd>
        </div>
        <div>
          <dt>
            <Clock3 size={15} aria-hidden="true" />
            {t("Estimated time")}
          </dt>
          <dd>{travelTime ?? t("Unavailable")}</dd>
          <dd className={styles.mode}>{t(mode.label)}</dd>
        </div>
      </dl>
      <div className={styles.risk}>
        <p>
          <strong>{t("Route risk")}</strong>
          <span>{t(risk)}</span>
        </p>
        <p className={styles.context}>
          {t("Based on available reports, not a guarantee of safety.")}
        </p>
      </div>
      {result.kind === "route" && (
        <p className={styles.context}>
          {result.data.affectedRoads === 0
            ? t("No reported road restrictions along this route.")
            : t(
                "Reported restrictions affect {count} sections of this route.",
                { count: result.data.affectedRoads },
              )}
        </p>
      )}
      {result.data.warnings.length > 0 && (
        <ul className={styles.warnings}>
          {result.data.warnings.map((warning, index) => (
            <li key={index}>
              <ShieldAlert size={16} aria-hidden="true" />
              <span>{warning}</span>
            </li>
          ))}
        </ul>
      )}
      {(hasLocationDetails || spacesRemaining !== null) && (
        <div className={styles.destination}>
          {hasLocationDetails && (
            <div className={styles.location}>
              {label?.subtitle && (
                <p>
                  <MapPin size={15} aria-hidden="true" />
                  <span>{label.subtitle}</span>
                </p>
              )}
              {center && <StatusBadge status={center.status} />}
            </div>
          )}
          {(center || spacesRemaining !== null) && (
            <div className={styles.capacity}>
              {center && (
                <p>
                  {t("{occupied} of {capacity} occupied", {
                    occupied: center.currentOccupancy.toLocaleString(),
                    capacity: center.capacity.toLocaleString(),
                  })}
                </p>
              )}
              {spacesRemaining !== null && (
                <strong>
                  {t("{count} spaces remaining", {
                    count: spacesRemaining.toLocaleString(),
                  })}
                </strong>
              )}
            </div>
          )}
        </div>
      )}
      {travelTime && (
        <details className={styles.estimate}>
          <summary>{t("How this time is estimated")}</summary>
          <p className={styles.context}>
            {t(
              "Assumes {speed} km/h over the calculated route. Pace, traffic, stops, and hazardous conditions may increase travel time.",
              { speed: mode.speedKmh },
            )}
          </p>
        </details>
      )}
    </section>
  );
}
