"use client";

import { Marker, Popup } from "react-leaflet";
import { createDivIcon } from "./icons";
import type { EvacuationCenter } from "@/services/api";

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

interface EvacuationCenterLayerProps {
  centers: EvacuationCenter[];
}

export function EvacuationCenterLayer({ centers }: EvacuationCenterLayerProps) {
  return (
    <>
      {centers.map((center) => (
        <Marker
          key={center.id}
          position={[center.latitude, center.longitude]}
          icon={centerIcon(center.status)}
        >
          <Popup>
            <div style={{ fontSize: 13 }}>
              <strong>{center.name}</strong>
              <div>{center.address}</div>
              <div>
                {center.currentOccupancy} / {center.capacity} occupied
              </div>
              <div>Status: {center.status}</div>
            </div>
          </Popup>
        </Marker>
      ))}
    </>
  );
}
