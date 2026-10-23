"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useMemo } from "react";
import { divIcon, latLngBounds } from "leaflet";
import {
  MapContainer,
  Marker,
  TileLayer,
  Tooltip,
  useMap,
} from "react-leaflet";
import {
  SANTA_ROSA_CITY_BOUNDS,
  SANTA_ROSA_CITY_CENTER,
  SANTA_ROSA_CITY_DEFAULT_ZOOM,
} from "@/lib/mapBounds";
import { EvacuationCenterLayer } from "@/components/map/EvacuationCenterLayer";
import type { EvacuationCenter } from "@/services/api";
import { findBarangayLocation } from "@/lib/barangayLocations";

type FocusedBarangay = { id: string; name: string };

const barangayLocationIcon = divIcon({
  className: "barangay-location-icon",
  iconSize: [32, 40],
  iconAnchor: [16, 40],
  tooltipAnchor: [0, -38],
  html: '<svg width="32" height="40" viewBox="0 0 32 40" fill="none" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><path d="M16 38S2 24 2 16a14 14 0 1 1 28 0c0 8-14 22-14 22Z" fill="#800000" stroke="#fffdf9" stroke-width="2"/><circle cx="16" cy="16" r="5" fill="#fffdf9"/></svg>',
});

function FitMap({
  centers,
  focusedBarangay,
}: {
  centers: EvacuationCenter[];
  focusedBarangay?: FocusedBarangay | null;
}) {
  const map = useMap();
  useEffect(() => {
    // Grid and sidebar changes resize the container without a window resize.
    // Preserve the current geographic view, including any manual map panning.
    const observer = new ResizeObserver(() => {
      map.invalidateSize({ animate: false, pan: true });
    });
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map]);

  useEffect(() => {
    // The access card changes the map's width without a window resize.
    map.invalidateSize({ animate: false, pan: true });
    const location = focusedBarangay
      ? findBarangayLocation(focusedBarangay.name)
      : undefined;
    if (location) {
      if (location.bounds) {
        map.fitBounds(location.bounds, {
          padding: [35, 35],
          maxZoom: 15,
          animate: false,
        });
      } else {
        map.setView(location.center, 15, { animate: false });
      }
    } else if (centers.length) {
      map.fitBounds(
        centers.map((center) => [center.latitude, center.longitude]),
        {
          padding: [30, 30],
          maxZoom: 15,
          animate: false,
        },
      );
    } else {
      map.fitBounds(SANTA_ROSA_CITY_BOUNDS, {
        padding: [25, 25],
        maxZoom: SANTA_ROSA_CITY_DEFAULT_ZOOM,
        animate: false,
      });
    }
  }, [centers, focusedBarangay, map]);
  return null;
}

/** Read-only city overview. Marker artwork and popups are shared with the public map. */
export default function AdminEvacuationMap({
  centers,
  focusedBarangay,
}: {
  centers: EvacuationCenter[];
  focusedBarangay?: FocusedBarangay | null;
}) {
  const location = focusedBarangay
    ? findBarangayLocation(focusedBarangay.name)
    : undefined;
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
      <FitMap centers={withCoords} focusedBarangay={focusedBarangay} />
      <EvacuationCenterLayer centers={withCoords} />
      {location && (
        <Marker
          key={location.name}
          position={location.center}
          icon={barangayLocationIcon}
          title={`Barangay ${location.name} location`}
          alt={`Barangay ${location.name} location`}
          zIndexOffset={1000}
        >
          <Tooltip direction="top" permanent>
            Barangay {location.name}
          </Tooltip>
        </Marker>
      )}
    </MapContainer>
  );
}
