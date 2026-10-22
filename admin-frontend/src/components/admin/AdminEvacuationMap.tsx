"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useMemo } from "react";
import { latLngBounds } from "leaflet";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import {
  SANTA_ROSA_CITY_BOUNDS,
  SANTA_ROSA_CITY_CENTER,
  SANTA_ROSA_CITY_DEFAULT_ZOOM,
} from "@/lib/mapBounds";
import { EvacuationCenterLayer } from "@/components/map/EvacuationCenterLayer";
import type { EvacuationCenter } from "@/services/api";

function FitCenters({ centers }: { centers: EvacuationCenter[] }) {
  const map = useMap();
  useEffect(() => {
    if (centers.length)
      map.fitBounds(
        centers.map((center) => [center.latitude, center.longitude]),
        {
          padding: [30, 30],
          maxZoom: 15,
        },
      );
  }, [centers, map]);
  return null;
}

/** Read-only city overview. Marker artwork and popups are shared with the public map. */
export default function AdminEvacuationMap({
  centers,
}: {
  centers: EvacuationCenter[];
}) {
  const withCoords = useMemo(
    () =>
      centers.filter(
        (center) =>
          Number.isFinite(center.latitude) &&
          Number.isFinite(center.longitude) &&
          Math.abs(center.latitude) <= 90 &&
          Math.abs(center.longitude) <= 180,
      ),
    [centers],
  );

  return (
    <MapContainer
      center={SANTA_ROSA_CITY_CENTER}
      zoom={SANTA_ROSA_CITY_DEFAULT_ZOOM}
      minZoom={11}
      maxZoom={18}
      // Leave room for edge-center popups and the whole city on small screens.
      maxBounds={latLngBounds(SANTA_ROSA_CITY_BOUNDS).pad(0.5)}
      maxBoundsViscosity={1}
      className="barangay-overview-map"
      scrollWheelZoom={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitCenters centers={withCoords} />
      <EvacuationCenterLayer centers={withCoords} />
    </MapContainer>
  );
}
