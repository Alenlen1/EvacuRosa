"use client";

import { Polyline } from "react-leaflet";

interface RoutePolylineProps {
  points: { latitude: number; longitude: number }[];
}

export function RoutePolyline({ points }: RoutePolylineProps) {
  if (points.length < 2) return null;

  return (
    <Polyline
      positions={points.map((p) => [p.latitude, p.longitude])}
      pathOptions={{ color: "#185FA5", weight: 5, opacity: 0.85 }}
    />
  );
}
