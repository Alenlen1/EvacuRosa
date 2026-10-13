"use client";

import { CircleMarker, Marker, Popup } from "react-leaflet";
import { useLanguage } from "@/components/LanguageProvider";
import { createDivIcon } from "./icons";

const userIcon = createDivIcon(
  `<div style="width:16px;height:16px;border-radius:9999px;background:#2563eb;border:2px solid white;box-shadow:0 0 0 2px rgba(37,99,235,0.4);"></div>`,
  16,
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
  const { t } = useLanguage();
  return (
    <>
      {/* A fixed-size location halo, not a geographic accuracy boundary. */}
      <CircleMarker
        center={[latitude, longitude]}
        radius={18}
        pathOptions={{
          color: "#2563eb",
          fillColor: "#2563eb",
          fillOpacity: 0.08,
          opacity: 0.3,
          weight: 1,
          interactive: false,
        }}
      />
      <Marker position={[latitude, longitude]} icon={userIcon} title={t("Your location")}>
        <Popup>{t("GPS accuracy: approximately {meters} m", { meters: Math.round(accuracy) })}</Popup>
      </Marker>
    </>
  );
}
