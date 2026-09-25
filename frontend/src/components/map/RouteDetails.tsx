import { ShieldAlert, Users } from "lucide-react";
import type { RouteResponse, EvacuationRouteResponse, EvacuationCenter } from "@/services/api";
import type { DestinationLabel } from "@/lib/reverseGeocoding";
import { StatusBadge } from "@/components/ui/StatusBadge";

export type ActiveRouteResult = { kind: "route"; data: RouteResponse } | { kind: "evacuation"; data: EvacuationRouteResponse };

export function routeRiskLabel(level: string | null) {
  const value = level ? level.replaceAll("_", " ").toLowerCase() : "unknown";
  return `Route risk: ${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

export function RouteDetails({ result, label, center }: { result: ActiveRouteResult; label: DestinationLabel | null; center?: EvacuationCenter }) {
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
      <p>Travel time unavailable.</p>
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
