"use client";
import "leaflet/dist/leaflet.css";
import { useEffect } from "react";
import { latLngBounds } from "leaflet";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Polygon,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";
import {
  isInsideSantaRosa,
  SANTA_ROSA_CITY_CENTER,
  SANTA_ROSA_CITY_BOUNDS,
} from "@/lib/mapBounds";
import type { ManagedCenter } from "./CenterManager";
import { SantaRosaBoundaryLayer } from "./SantaRosaBoundaryLayer";
import {
  getBarangayBoundary,
  validateEntranceBarangay,
} from "../../../../backend/src/geography/barangayBoundary";
import type { EntranceBarangay } from "@/lib/entranceBarangay";

function BarangayBoundary({ name }: { name: string }) {
  const map = useMap();
  const boundary = getBarangayBoundary(name);
  useEffect(() => {
    if (!boundary) return;
    map.fitBounds(
      boundary.geometry.coordinates[0].map(
        ([lng, lat]) => [lat, lng] as [number, number],
      ),
      { padding: [12, 12], maxZoom: 17, animate: false },
    );
    // Move just a quarter level closer than the half-level overview.
    map.setZoom(Math.floor(map.getZoom() * 2) / 2 + 0.25, { animate: false });
  }, [boundary, map]);
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
      <Polygon
        positions={[[world, outer], ...holes.map((hole) => [hole])]}
        interactive={false}
        pathOptions={{ stroke: false, fillColor: "#302825", fillOpacity: 0.28 }}
      />
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

function FitEntrance({
  latitude,
  longitude,
}: {
  latitude: number | null;
  longitude: number | null;
}) {
  const map = useMap();
  useEffect(() => {
    const observer = new ResizeObserver(() =>
      map.invalidateSize({ animate: false, pan: true }),
    );
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map]);
  useEffect(() => {
    if (latitude !== null && longitude !== null)
      map.panInside([latitude, longitude], {
        padding: [35, 35],
        animate: false,
      });
  }, [latitude, longitude, map]);
  return null;
}

function SelectPoint({
  onPoint,
  barangay,
  disabled,
  onInvalidPoint,
}: {
  onPoint: (lat: number, lng: number) => void;
  barangay: EntranceBarangay | null;
  disabled: boolean;
  onInvalidPoint: (message: string) => void;
}) {
  useMapEvents({
    click(event) {
      if (disabled || !barangay) return;
      try {
        validateEntranceBarangay(
          event.latlng.lat,
          event.latlng.lng,
          barangay.name,
        );
        onPoint(event.latlng.lat, event.latlng.lng);
      } catch {
        onInvalidPoint(
          `Please select an entrance within ${barangay.name}. Locations outside its boundary cannot be used.`,
        );
      }
    },
  });
  return null;
}
export default function CenterLocationPicker({
  centers,
  latitude,
  longitude,
  onPoint,
  barangay,
  disabled,
  onInvalidPoint,
}: {
  centers: ManagedCenter[];
  latitude: string;
  longitude: string;
  onPoint: (lat: number, lng: number) => void;
  barangay: EntranceBarangay | null;
  disabled: boolean;
  onInvalidPoint: (message: string) => void;
}) {
  const lat = Number(latitude),
    lng = Number(longitude);
  let valid =
    !!latitude &&
    !!longitude &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    isInsideSantaRosa(lat, lng);
  if (valid) {
    try {
      if (!barangay) valid = false;
      else validateEntranceBarangay(lat, lng, barangay.name);
    } catch {
      valid = false;
    }
  }
  return (
    <MapContainer
      className="center-location-picker"
      center={SANTA_ROSA_CITY_CENTER}
      zoom={13}
      zoomSnap={0.25}
      zoomDelta={0.5}
      maxBounds={latLngBounds(SANTA_ROSA_CITY_BOUNDS).pad(0.2)}
      maxBoundsViscosity={1}
      minZoom={12}
    >
      <TileLayer
        attribution="&copy; OpenStreetMap contributors"
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {!barangay && <SantaRosaBoundaryLayer />}
      {barangay && <BarangayBoundary name={barangay.name} />}
      <FitEntrance
        latitude={valid ? lat : null}
        longitude={valid ? lng : null}
      />
      {centers
        .filter(
          (c) =>
            isInsideSantaRosa(c.latitude, c.longitude) &&
            (!barangay || c.barangay_id === barangay.id),
        )
        .map((c) => (
          <CircleMarker
            key={c.id}
            center={[c.latitude, c.longitude]}
            radius={7}
            pathOptions={{ color: "#3b6d11" }}
          >
            <Tooltip>{c.name}</Tooltip>
          </CircleMarker>
        ))}
      {valid && (
        <CircleMarker
          center={[lat, lng]}
          radius={10}
          interactive={false}
          pathOptions={{
            color: "#76160d",
            fillColor: "#76160d",
            fillOpacity: 0.9,
          }}
        >
          <Tooltip permanent>Selected entrance</Tooltip>
        </CircleMarker>
      )}
      <SelectPoint
        onPoint={onPoint}
        barangay={barangay}
        disabled={disabled}
        onInvalidPoint={onInvalidPoint}
      />
    </MapContainer>
  );
}
