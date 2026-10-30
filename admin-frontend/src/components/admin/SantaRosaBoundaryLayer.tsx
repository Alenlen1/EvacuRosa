"use client";

import { Polygon } from "react-leaflet";
import { santaRosaBoundary } from "../../../../backend/src/geography/santaRosa";

const cityOutline = santaRosaBoundary.geometry.coordinates.map((polygon) =>
  polygon.map((ring) =>
    ring.map(
      ([longitude, latitude]) => [latitude, longitude] as [number, number],
    ),
  ),
);

export function SantaRosaBoundaryLayer() {
  return (
    <Polygon
      positions={cityOutline}
      interactive={false}
      attribution='Boundary: PSA/NAMRIA via <a href="https://github.com/faeldon/philippines-json-maps">Philippines JSON Maps</a>'
      pathOptions={{
        color: "#800000",
        weight: 2,
        fillOpacity: 0.04,
      }}
    />
  );
}
