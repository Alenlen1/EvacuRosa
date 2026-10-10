"use client";

import { useLanguage } from "@/components/LanguageProvider";
import { Marker, Popup } from "react-leaflet";
import { createDivIcon } from "./icons";
import type { EvacuationCenter } from "@/services/api";
import { StatusBadge } from "@/components/ui/StatusBadge";

const statusColor: Record<string, string> = {
  AVAILABLE: "#3B6D11",
  NEARLY_FULL: "#BA7517",
  FULL: "#B3261E",
  CLOSED: "#6B7280",
};

function centerIcon(status: string) {
  const color = statusColor[status] ?? statusColor.CLOSED;
  const symbol = status === "AVAILABLE" ? '<path d="m7 12 3 3 7-7"/>'
    : status === "NEARLY_FULL" ? '<path d="m12 4 9 16H3Z"/><path d="M12 9v5m0 3v.2"/>'
    : status === "FULL" ? '<circle cx="12" cy="12" r="8"/><path d="M7 12h10"/>'
    : '<rect x="6" y="10" width="12" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>';
  return createDivIcon(
    `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="9" width="18" height="12" rx="2" fill="${color}" stroke="white" stroke-width="1.5"/>
      <path d="M3 9 L12 3 L21 9" fill="${color}" stroke="white" stroke-width="1.5" stroke-linejoin="round"/>
      <circle cx="12" cy="13" r="9" fill="${color}"/>
      <g transform="translate(4 5) scale(.67)" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${symbol}</g>
    </svg>`,
    26
  );
}

interface EvacuationCenterLayerProps {
  centers: EvacuationCenter[];
  onSelectCenter?: (center: EvacuationCenter) => void;
}

export function EvacuationCenterLayer({ centers, onSelectCenter }: EvacuationCenterLayerProps) {
  const { t } = useLanguage();
  return (
    <>
      {centers.map((center) => (
        <Marker
          key={center.id}
          title={`${center.name}: ${t(center.status.replaceAll("_", " "))}`}
          alt={`${center.name}: ${t(center.status.replaceAll("_", " "))}`}
          position={[center.latitude, center.longitude]}
          icon={centerIcon(center.status)}
          eventHandlers={{ click: () => onSelectCenter?.(center) }}
        >
          <Popup>
            <div className="center-popup">
              <strong>{center.name}</strong>
              <div>{center.address}</div>
              <div>
                {center.currentOccupancy} / {center.capacity} occupied
              </div>
              <StatusBadge status={center.status} />
            </div>
          </Popup>
        </Marker>
      ))}
    </>
  );
}
