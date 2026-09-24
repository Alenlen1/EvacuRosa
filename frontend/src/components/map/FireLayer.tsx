"use client";

import { Circle, Tooltip } from "react-leaflet";
import type { FireIncident } from "@/services/api";

const severityColor: Record<string, string> = {
  LOW: "#EF9F27",
  MODERATE: "#BA7517",
  HIGH: "#D85A30",
  SEVERE: "#B3261E",
};

interface FireLayerProps {
  incidents: FireIncident[];
}

export function FireLayer({ incidents }: FireLayerProps) {
  return (
    <>
      {incidents.map((incident) => {
        const color = severityColor[incident.severity] ?? severityColor.HIGH;
        return (
          <Circle
            key={incident.id}
            center={[incident.latitude, incident.longitude]}
            radius={incident.radiusMeters}
            pathOptions={{
              color,
              fillColor: color,
              fillOpacity: 0.25,
              weight: 2,
            }}
          >
            <Tooltip sticky className="hazard-tooltip">
              {incident.severity} fire — {incident.radiusMeters}m radius
              {incident.confirmedBlockedRoadIds.length > 0
                ? ` — ${incident.confirmedBlockedRoadIds.length} road(s) confirmed blocked`
                : ""}
            </Tooltip>
          </Circle>
        );
      })}
    </>
  );
}
