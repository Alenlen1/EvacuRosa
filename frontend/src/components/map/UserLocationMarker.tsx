"use client";

import { Circle, Marker } from "react-leaflet";
import { createDivIcon } from "./icons";

const userIcon = createDivIcon(
  `<div style="width:16px;height:16px;border-radius:9999px;background:#2563eb;border:2px solid white;box-shadow:0 0 0 2px rgba(37,99,235,0.4);"></div>`,
  16
);

interface UserLocationMarkerProps {
  latitude: number;
  longitude: number;
  accuracy: number;
}

export function UserLocationMarker({
  latitude,
  longitude,
  accuracy,
}: UserLocationMarkerProps) {
  return (
    <>
      <Circle
        center={[latitude, longitude]}
        radius={accuracy}
        pathOptions={{
          color: "#2563eb",
          fillColor: "#2563eb",
          fillOpacity: 0.1,
          weight: 1,
        }}
      />
      <Marker position={[latitude, longitude]} icon={userIcon} />
    </>
  );
}
