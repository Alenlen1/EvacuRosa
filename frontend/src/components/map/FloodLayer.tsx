"use client";

import { Polyline, Tooltip } from "react-leaflet";
import type { FloodReport } from "@/services/api";

const severityColor: Record<string, string> = {
  LOW: "#60a5fa",
  MODERATE: "#2563eb",
  HIGH: "#1d4ed8",
  SEVERE: "#1e40af",
};

interface FloodLayerProps {
  reports: FloodReport[];
}

export function FloodLayer({ reports }: FloodLayerProps) {
  return (
    <>
      {reports.flatMap((report) =>
        report.affectedSegments.map((segment, i) => (
          <Polyline
            key={`${report.id}-${i}`}
            positions={segment.map((p) => [p.latitude, p.longitude])}
            pathOptions={{
              color: report.roadImpassable ? "#b3261e" : severityColor[report.severity] ?? "#2563eb",
              weight: report.roadImpassable ? 8 : 5,
              opacity: 0.75,
              dashArray: report.roadImpassable ? undefined : "6 6",
            }}
          >
            <Tooltip sticky className="hazard-tooltip">
              {report.severity} flood
              {report.roadImpassable ? " — road blocked" : " — road passable"}
            </Tooltip>
          </Polyline>
        ))
      )}
    </>
  );
}
