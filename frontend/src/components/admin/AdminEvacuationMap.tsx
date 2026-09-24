"use client";

import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import {
  SANTA_ROSA_CITY_BOUNDS,
  SANTA_ROSA_CITY_CENTER,
  SANTA_ROSA_CITY_DEFAULT_ZOOM,
} from "@/lib/mapBounds";
import { createDivIcon } from "@/components/map/icons";

const statusColor: Record<string, string> = {
  AVAILABLE: "#3B6D11",
  NEARLY_FULL: "#BA7517",
  FULL: "#B3261E",
  CLOSED: "#6B7280",
};

function centerIcon(status: string) {
  const color = statusColor[status] ?? statusColor.CLOSED;
  return createDivIcon(
    `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="9" width="18" height="12" rx="2" fill="${color}" stroke="white" stroke-width="1.5"/>
      <path d="M3 9 L12 3 L21 9" fill="${color}" stroke="white" stroke-width="1.5" stroke-linejoin="round"/>
    </svg>`,
    26
  );
}

interface MapCenter {
  id: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
  status: string;
}

interface AdminEvacuationMapProps {
  centers: MapCenter[];
  onSelectCenter: (id: string) => void;
}

/** Clicking a marker scrolls to and highlights that center's card in the
 * list below, rather than navigating anywhere — everything stays on one
 * screen since the map and the edit form are really one workflow. */
export default function AdminEvacuationMap({
  centers,
  onSelectCenter,
}: AdminEvacuationMapProps) {
  const withCoords = centers.filter(
    (c): c is MapCenter & { latitude: number; longitude: number } =>
      c.latitude != null && c.longitude != null
  );

  return (
    <MapContainer
      center={SANTA_ROSA_CITY_CENTER}
      zoom={SANTA_ROSA_CITY_DEFAULT_ZOOM}
      minZoom={12}
      maxZoom={18}
      maxBounds={SANTA_ROSA_CITY_BOUNDS}
      maxBoundsViscosity={1}
      className="h-[55vh] min-h-[420px] max-h-[640px] w-full"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {withCoords.map((c) => (
        <Marker
          key={c.id}
          position={[c.latitude, c.longitude]}
          icon={centerIcon(c.status)}
          eventHandlers={{ click: () => onSelectCenter(c.id) }}
        >
          <Popup>{c.name}</Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
