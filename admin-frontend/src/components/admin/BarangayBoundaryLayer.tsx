"use client";

import { useEffect } from "react";
import { Polygon, useMap } from "react-leaflet";
import { getBarangayBoundary } from "../../../../backend/src/geography/barangayBoundary";
import { santaRosaBounds } from "../../../../backend/src/geography/santaRosa";

export function BarangayBoundaryLayer({
  name,
  resetToCity = false,
  shadeOutside = true,
  zoomOffset = 0.25,
}: {
  name: string | null;
  resetToCity?: boolean;
  shadeOutside?: boolean;
  zoomOffset?: number;
}) {
  const map = useMap();
  const boundary = name ? getBarangayBoundary(name) : null;

  // Only a different boundary should change the view, never a report edit.
  useEffect(() => {
    if (!boundary) {
      if (resetToCity)
        map.fitBounds(santaRosaBounds, { padding: [16, 16], animate: false });
      return;
    }
    map.fitBounds(
      boundary.geometry.coordinates[0].map(
        ([lng, lat]) => [lat, lng] as [number, number],
      ),
      { padding: [12, 12], maxZoom: 17, animate: false },
    );
    if (zoomOffset)
      map.setZoom(Math.floor(map.getZoom() * 2) / 2 + zoomOffset, {
        animate: false,
      });
  }, [boundary, map, resetToCity, zoomOffset]);

  if (!boundary) return null;
  const [outer, ...holes] = boundary.geometry.coordinates.map((ring) =>
    ring.map(([lng, lat]) => [lat, lng] as [number, number]),
  );
  const world: [number, number][] = [
    [85, -180],
    [85, 180],
    [-85, 180],
    [-85, -180],
  ];

  return (
    <>
      {shadeOutside && (
        <Polygon
          positions={[[world, outer], ...holes.map((hole) => [hole])]}
          interactive={false}
          pathOptions={{
            stroke: false,
            fillColor: "#302825",
            fillOpacity: 0.28,
          }}
        />
      )}
      <Polygon
        positions={[outer, ...holes]}
        interactive={false}
        attribution='Barangay boundaries: PSA/NAMRIA via <a href="https://github.com/faeldon/philippines-json-maps">Philippines JSON Maps</a>'
        pathOptions={{
          color: "#76160d",
          weight: 3,
          fillColor: "#76160d",
          fillOpacity: 0.06,
        }}
      />
    </>
  );
}
