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

export function RouteDetails({ result, label, center, travelMode }: { result: ActiveRouteResult; label: DestinationLabel | null; center?: EvacuationCenter; travelMode: TravelMode }) {
  const travelTime = estimatedTravelTime(result.data.distance, travelMode);
  const mode = TRAVEL_MODES[travelMode];
  return (
    <section className="route-summary" aria-label="Active route details" aria-live="polite">
      <span className="eyebrow">ROUTE DESTINATION</span>
      <h3>{label?.title ?? "Selected destination"}</h3>
      {label?.subtitle && <p>{label.subtitle}</p>}
      {center && <>
        <StatusBadge status={center.status} />
        <p className="route-occupancy"><Users size={18} />{center.currentOccupancy} / {center.capacity} occupied</p>
      </>}
      <div className="route-metrics"><div><strong>{(result.data.distance / 1000).toFixed(1)} km</strong><small>Route distance</small></div></div>
      <p className="route-risk">{routeRiskLabel(result.data.riskLevel)}</p>
      <p className="route-risk-context">Based on available reports, not a guarantee of safety.</p>
      <p><strong>Estimated time ({mode.label.toLowerCase()}): {travelTime ? `about ${travelTime.toLowerCase()}` : "unavailable"}.</strong></p>
      {travelTime && <p className="route-risk-context">Assumes {mode.speedKmh} km/h over the calculated route. Pace, traffic, stops, and hazardous conditions may increase travel time.</p>}
      {result.kind === "route" && <p>{result.data.affectedRoads === 0
          ? "No reported road restrictions along this route."
          : `Reported restrictions affect ${result.data.affectedRoads} ${result.data.affectedRoads === 1 ? "section" : "sections"} of this route.`}</p>}
      <div className="route-extra">
        {result.kind === "evacuation" && <p>{result.data.recommendedCenter.capacity - result.data.recommendedCenter.currentOccupancy} slots available</p>}
      </div>
      {result.data.warnings.map((warning, index) => <p className="warning-message" key={index}><ShieldAlert size={16} />{warning}</p>)}
    </section>
  );
}
