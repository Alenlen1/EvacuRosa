"use client";

import { Polyline, Tooltip } from "react-leaflet";
import type { FloodReport } from "@/services/api";

const severityColor: Record<string, string> = {
  LOW: "#EF9F27",
  MODERATE: "#BA7517",
  HIGH: "#854F0B",
  SEVERE: "#B3261E",
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
              color: severityColor[report.severity] ?? "#B3261E",
              weight: report.roadImpassable ? 8 : 5,
              opacity: 0.75,
              dashArray: report.roadImpassable ? undefined : "6 6",
            }}
          >
            <Tooltip sticky>
              {report.severity} flood
              {report.roadImpassable ? " — road blocked" : " — road passable"}
            </Tooltip>
          </Polyline>
        ))
      )}
    </>
  );
}
