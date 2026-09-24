"use client";

import { Marker } from "react-leaflet";
import { createDivIcon } from "./icons";

const destinationIcon = createDivIcon(
  `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2C7.58 2 4 5.58 4 10c0 5.25 7 12 8 12s8-6.75 8-12c0-4.42-3.58-8-8-8Z" fill="#252b31" stroke="white" stroke-width="1.5"/>
    <circle cx="12" cy="10" r="2.5" fill="white"/>
  </svg>`,
  28
);

interface DestinationMarkerProps {
  latitude: number;
  longitude: number;
}

export function DestinationMarker({
  latitude,
  longitude,
}: DestinationMarkerProps) {
  return <Marker position={[latitude, longitude]} icon={destinationIcon} />;
}
