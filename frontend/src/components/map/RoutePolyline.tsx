"use client";

import { Polyline } from "react-leaflet";

interface RoutePolylineProps {
  points: { latitude: number; longitude: number }[];
}

export function RoutePolyline({ points }: RoutePolylineProps) {
  if (points.length < 2) return null;

  return (
    <>
      <Polyline
        positions={points.map((p) => [p.latitude, p.longitude])}
        pathOptions={{ color: "#252b31", weight: 9, opacity: 1, interactive: false }}
      />
      <Polyline
        positions={points.map((p) => [p.latitude, p.longitude])}
        pathOptions={{ color: "#f4d84b", weight: 5, opacity: 1, interactive: false }}
      />
    </>
  );
}
