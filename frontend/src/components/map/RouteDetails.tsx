"use client";
import { useLanguage } from "@/components/LanguageProvider";
import { ShelterSupplies } from "./ShelterSupplies";
import { ShieldAlert, Users } from "lucide-react";
import type { RouteResponse, EvacuationRouteResponse, EvacuationCenter } from "@/services/api";
import type { DestinationLabel } from "@/lib/reverseGeocoding";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { TRAVEL_MODES, estimatedTravelTime, type TravelMode } from "@/lib/travelTime";

export type ActiveRouteResult = { kind: "route"; data: RouteResponse } | { kind: "evacuation"; data: EvacuationRouteResponse };

export function routeRiskLabel(level: string | null) {
  const value = level ? level.replaceAll("_", " ").toLowerCase() : "unknown";
  return `Route risk: ${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

export function RouteDetails({ result, label, center, travelMode, hideHeading = false }: { result: ActiveRouteResult; label: DestinationLabel | null; center?: EvacuationCenter; travelMode: TravelMode; hideHeading?: boolean }) {
  const { t } = useLanguage();
  const travelTime = estimatedTravelTime(result.data.distance, travelMode);
  const mode = TRAVEL_MODES[travelMode];
  return (
    <section className="route-summary" aria-label="Active route details" aria-live="polite">
      {!hideHeading && <><span className="eyebrow">{t("ROUTE DESTINATION")}</span>
      <h3>{label?.title ?? t("Selected destination")}</h3></>}
      {label?.subtitle && <p>{label.subtitle}</p>}
      {center && <>
        <StatusBadge status={center.status} />
        <ShelterSupplies center={center} />
        <p className="route-occupancy"><Users size={18} />{center.currentOccupancy} / {center.capacity} {t("occupied")}</p>
      </>}
      <div className="route-metrics"><div><strong>{(result.data.distance / 1000).toFixed(1)} km</strong><small>{t("Route distance")}</small></div></div>
      <p className="route-risk">{t("Route risk")}: {t((result.data.riskLevel ?? "UNKNOWN").replaceAll("_", " "))}</p>
      <p className="route-risk-context">{t("Based on available reports, not a guarantee of safety.")}</p>
      <p><strong>{t("Estimated time")} ({t(mode.label)}): {travelTime ? `${t("about")} ${travelTime.toLowerCase()}` : t("unavailable")}.</strong></p>
      {travelTime && <p className="route-risk-context">{t("Assumes {speed} km/h over the calculated route. Pace, traffic, stops, and hazardous conditions may increase travel time.", { speed: mode.speedKmh })}</p>}
      {result.kind === "route" && <p>{result.data.affectedRoads === 0
          ? t("No reported road restrictions along this route.")
          : t("Reported restrictions affect {count} sections of this route.", { count: result.data.affectedRoads })}</p>}
      <div className="route-extra">
        {result.kind === "evacuation" && <p>{result.data.recommendedCenter.capacity - result.data.recommendedCenter.currentOccupancy} {t("slots available")}</p>}
      </div>
      {result.data.warnings.map((warning, index) => <p className="warning-message" key={index}><ShieldAlert size={16} />{warning}</p>)}
    </section>
  );
}
