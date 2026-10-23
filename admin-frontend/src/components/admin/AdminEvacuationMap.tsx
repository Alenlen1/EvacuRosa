"use client";

import "leaflet/dist/leaflet.css";
import { useEffect } from "react";
import { latLngBounds } from "leaflet";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import {
  SANTA_ROSA_CITY_BOUNDS,
  SANTA_ROSA_CITY_CENTER,
  SANTA_ROSA_CITY_DEFAULT_ZOOM,
} from "@/lib/mapBounds";
import { EvacuationCenterLayer } from "@/components/map/EvacuationCenterLayer";
import type { EvacuationCenter } from "@/services/api";
import { findBarangayLocation } from "@/lib/barangayLocations";
import { BarangayShelterPopup } from "./BarangayShelterPopup";

type FocusedBarangay = { id: string; name: string };

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
    if (centers.length) {
      map.fitBounds(
        centers.map((center) => [center.latitude, center.longitude]),
        {
          padding: [35, 35],
          maxZoom: focusedBarangay ? 16 : 15,
          animate: false,
        },
      );
    } else if (location) {
      if (location.bounds) {
        map.fitBounds(location.bounds, {
          padding: [35, 35],
          maxZoom: 15,
          animate: false,
        });
      } else {
        map.setView(location.center, 15, { animate: false });
      }
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

/** Receives only the visible shelters with map coordinates from the overview. */
export default function AdminEvacuationMap({
  centers,
  focusedBarangay,
}: {
  centers: EvacuationCenter[];
  focusedBarangay?: FocusedBarangay | null;
}) {
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
      <FitMap centers={centers} focusedBarangay={focusedBarangay} />
      <EvacuationCenterLayer
        centers={centers}
        renderPopup={(center) => <BarangayShelterPopup center={center} />}
      />
    </MapContainer>
  );
}
