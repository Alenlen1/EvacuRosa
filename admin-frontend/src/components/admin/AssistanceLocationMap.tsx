"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import L from "leaflet";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Circle,
  Popup,
  ZoomControl,
  useMap,
} from "react-leaflet";
import type { AssistanceRequest } from "@/services/api";
import { SANTA_ROSA_CITY_CENTER } from "@/lib/mapBounds";
import { isVisibleAssistanceRequest } from "@/lib/assistanceVisibility";
import { assistanceDisplayName } from "@/lib/assistancePresentation";
import { ASSISTANCE_LABELS } from "@/lib/assistance";

const colors = {
  PENDING: "#2563eb",
  ACKNOWLEDGED: "#b7791f",
  DISPATCHED: "#b03a2e",
  COMPLETED: "#28764b",
  CANCELLED: "#6b7280",
};
type Selection = { id: string; version: number } | null;

function Locations({
  requests,
  selection,
  onSelectRequest,
}: {
  requests: AssistanceRequest[];
  selection: Selection;
  onSelectRequest: (id: string) => void;
}) {
  const map = useMap();
  const fitted = useRef(false);
  const focusedSelection = useRef<string | null>(null);
  const markers = useRef(new Map<string, L.CircleMarker>());
  const popupIntent = useRef<string | null>(null);
  const lastSize = useRef<{ width: number; height: number } | null>(null);
  const selected = requests.find((request) => request.id === selection?.id);

  useEffect(() => {
    const resize = () => {
      const container = map.getContainer();
      if (!container.clientWidth || !container.clientHeight) return;
      const size = {
        width: container.clientWidth,
        height: container.clientHeight,
      };
      if (
        lastSize.current &&
        (lastSize.current.width !== size.width ||
          lastSize.current.height !== size.height)
      ) {
        map.closePopup();
      }
      lastSize.current = size;
      map.invalidateSize({ animate: false });
      const item = requests.find((request) => request.id === selection?.id);
      const key = selection ? `${selection.id}:${selection.version}` : null;
      if (item && key !== focusedSelection.current) {
        focusedSelection.current = key;
        fitted.current = true;
        map.closePopup();
        const center = L.latLng(item.latitude, item.longitude);
        map.fitBounds(
          center.toBounds(Math.max(100, item.accuracy_meters * 2)),
          {
            padding: [28, 28],
            maxZoom: 17,
            animate: false,
          },
        );
        if (popupIntent.current === item.id)
          markers.current.get(item.id)?.openPopup();
        popupIntent.current = null;
        return;
      }
      if (!selection && focusedSelection.current) {
        focusedSelection.current = null;
        fitted.current = false;
        map.closePopup();
      }
      if (!fitted.current && requests.length) {
        map.fitBounds(
          L.latLngBounds(
            requests.map((item) => [item.latitude, item.longitude]),
          ),
          { padding: [32, 32], maxZoom: 16 },
        );
        fitted.current = true;
      }
    };
    const observer = new ResizeObserver(resize);
    observer.observe(map.getContainer());
    resize();
    return () => observer.disconnect();
  }, [map, requests, selection]);

  return (
    <>
      {selected && (
        <Circle
          center={[selected.latitude, selected.longitude]}
          radius={selected.accuracy_meters}
          pathOptions={{
            color: colors[selected.status],
            fillOpacity: 0.12,
            weight: 1,
          }}
          interactive={false}
        />
      )}
      {requests.map((item) => (
        <CircleMarker
          key={item.id}
          ref={(marker) => {
            if (marker) markers.current.set(item.id, marker);
            else markers.current.delete(item.id);
          }}
          center={[item.latitude, item.longitude]}
          radius={item.id === selection?.id ? 11 : 8}
          pathOptions={{
            color: "white",
            weight: item.id === selection?.id ? 3 : 2,
            fillColor: colors[item.status],
            fillOpacity: 1,
          }}
          eventHandlers={{
            click: () => {
              popupIntent.current = item.id;
              onSelectRequest(item.id);
            },
          }}
        >
          <Popup
            minWidth={160}
            maxWidth={240}
            maxHeight={140}
            autoPanPadding={[8, 8]}
          >
            <div className="assistance-map-popup">
              <strong>{assistanceDisplayName(item)}</strong>
              <span>{ASSISTANCE_LABELS[item.status]}</span>
              <span>
                {item.location_name
                  ? `Near ${item.location_name.roadName}`
                  : "Street name unavailable"}
              </span>
              <span>
                {item.latitude.toFixed(6)}, {item.longitude.toFixed(6)}
              </span>
              <span>
                Reported accuracy: ±{Math.round(item.accuracy_meters)} m
              </span>
            </div>
          </Popup>
        </CircleMarker>
      ))}
    </>
  );
}

export default function AssistanceLocationMap({
  requests,
  selection,
  onSelectRequest,
}: {
  requests: AssistanceRequest[];
  selection: Selection;
  onSelectRequest: (id: string) => void;
}) {
  const valid = requests.filter(
    (item) =>
      isVisibleAssistanceRequest(item) &&
      Number.isFinite(item.latitude) &&
      Number.isFinite(item.longitude) &&
      Math.abs(item.latitude) <= 90 &&
      Math.abs(item.longitude) <= 180 &&
      Number.isFinite(item.accuracy_meters) &&
      item.accuracy_meters >= 0,
  );
  return (
    <MapContainer
      center={SANTA_ROSA_CITY_CENTER}
      zoom={13}
      className="assistance-location-map"
      scrollWheelZoom={false}
      zoomAnimation={false}
      zoomControl={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <ZoomControl position="bottomright" />
      <Locations
        requests={valid}
        selection={selection}
        onSelectRequest={onSelectRequest}
      />
    </MapContainer>
  );
}
