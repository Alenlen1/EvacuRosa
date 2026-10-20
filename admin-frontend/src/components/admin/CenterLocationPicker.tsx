"use client";
import "leaflet/dist/leaflet.css";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Tooltip,
  useMapEvents,
} from "react-leaflet";
import {
  isInsideSantaRosa,
  SANTA_ROSA_CITY_CENTER,
  SANTA_ROSA_CITY_BOUNDS,
} from "@/lib/mapBounds";
import type { ManagedCenter } from "./CenterManager";
function SelectPoint({
  onPoint,
}: {
  onPoint: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(event) {
      if (isInsideSantaRosa(event.latlng.lat, event.latlng.lng))
        onPoint(event.latlng.lat, event.latlng.lng);
    },
  });
  return null;
}
export default function CenterLocationPicker({
  centers,
  latitude,
  longitude,
  onPoint,
}: {
  centers: ManagedCenter[];
  latitude: string;
  longitude: string;
  onPoint: (lat: number, lng: number) => void;
}) {
  const lat = Number(latitude),
    lng = Number(longitude);
  const valid =
    !!latitude &&
    !!longitude &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    isInsideSantaRosa(lat, lng);
  return (
    <MapContainer
      className="center-location-picker"
      center={SANTA_ROSA_CITY_CENTER}
      zoom={13}
      maxBounds={SANTA_ROSA_CITY_BOUNDS}
      maxBoundsViscosity={1}
      minZoom={12}
    >
      <TileLayer
        attribution="&copy; OpenStreetMap contributors"
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {centers
        .filter((c) => isInsideSantaRosa(c.latitude, c.longitude))
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
          pathOptions={{ color: "#2563eb", fillOpacity: 0.8 }}
        >
          <Tooltip permanent>Selected entrance</Tooltip>
        </CircleMarker>
      )}
      <SelectPoint onPoint={onPoint} />
    </MapContainer>
  );
}
