"use client";

import { Circle, Tooltip } from "react-leaflet";
import type { EarthquakeEvent, EarthquakeRoadImpact } from "@/services/api";

interface EarthquakeLayerProps {
  events: EarthquakeEvent[];
  roadImpacts: EarthquakeRoadImpact[];
}

/** Radius is a rough visual scale (not a damage radius like fire's — an
 * earthquake doesn't have a physical "footprint" the way a fire or flood
 * does), just big enough to tap/see, scaled loosely by magnitude. */
function magnitudeToRadiusMeters(magnitude: number): number {
  return Math.max(150, magnitude * 80);
}

export function EarthquakeLayer({ events, roadImpacts }: EarthquakeLayerProps) {
  const impactCountByEvent = new Map<string, number>();
  for (const impact of roadImpacts) {
    impactCountByEvent.set(
      impact.earthquakeEventId,
      (impactCountByEvent.get(impact.earthquakeEventId) ?? 0) + 1
    );
  }

  return (
    <>
      {events.map((event) => {
        const impactCount = impactCountByEvent.get(event.id) ?? 0;
        // Muted gray for anything without a verified road impact — this is
        // informational only and correctly has zero effect on routing.
        // Only give it a stronger color once CDRRMO has actually verified
        // an impact, so the map doesn't visually imply danger the routing
        // engine doesn't act on.
        const color = impactCount > 0 ? "#854F0B" : "#9CA3AF";
        return (
          <Circle
            key={event.id}
            center={[event.latitude, event.longitude]}
            radius={magnitudeToRadiusMeters(event.magnitude)}
            pathOptions={{
              color,
              fillColor: color,
              fillOpacity: impactCount > 0 ? 0.25 : 0.1,
              weight: 1.5,
              dashArray: event.status === "UNREVIEWED" ? "4 4" : undefined,
            }}
          >
            <Tooltip sticky className="hazard-tooltip">
              M{event.magnitude.toFixed(1)}
              {event.depthKm ? ` · ${event.depthKm}km deep` : ""} · {event.status}
              {impactCount > 0
                ? ` · ${impactCount} verified road impact(s)`
                : " · no verified road impact"}
            </Tooltip>
          </Circle>
        );
      })}
    </>
  );
}
