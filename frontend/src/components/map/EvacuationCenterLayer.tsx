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
  const symbol =
    status === "AVAILABLE"
      ? '<path d="m7 12 3 3 7-7"/>'
      : status === "NEARLY_FULL"
        ? '<path d="m12 4 9 16H3Z"/><path d="M12 9v5m0 3v.2"/>'
        : status === "FULL"
          ? '<circle cx="12" cy="12" r="8"/><path d="M7 12h10"/>'
          : status === "CLOSED"
            ? '<rect x="6" y="10" width="12" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>'
            : '<path d="M9 8a3 3 0 0 1 6 0c0 3-3 2-3 5m0 4v.2"/>';
  return createDivIcon(
    `<svg class="shelter-map-marker" width="44" height="44" viewBox="0 0 44 44" fill="none" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
      <circle cx="21" cy="23" r="18" fill="#17232f" fill-opacity=".15"/>
      <circle cx="21" cy="21" r="18" fill="white" stroke="${color}" stroke-width="2"/>
      <circle cx="21" cy="21" r="14.5" fill="${color}" fill-opacity=".10"/>
      <g stroke="#344454" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="m10 19 11-9 11 9M13 18v13h16V18" fill="white"/>
        <path d="M18 31v-8h6v8M16 20h1m8 0h1"/>
      </g>
      <circle cx="34" cy="33" r="9" fill="${color}" stroke="white" stroke-width="2"/>
      <g transform="translate(27 26) scale(.58)" stroke="white" stroke-width="2.7" stroke-linecap="round" stroke-linejoin="round">${symbol}</g>
    </svg>`,
    44,
  );
}

interface EvacuationCenterLayerProps {
  centers: EvacuationCenter[];
  onSelectCenter?: (center: EvacuationCenter) => void;
}

export function EvacuationCenterLayer({
  centers,
  onSelectCenter,
}: EvacuationCenterLayerProps) {
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
