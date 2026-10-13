"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Circle,
  Popup,
  useMap,
} from "react-leaflet";
import type { AssistanceRequest } from "@/services/api";
import { SANTA_ROSA_CITY_CENTER } from "@/lib/mapBounds";

const colors = { NEW: "#2563eb", ACKNOWLEDGED: "#b7791f", RESOLVED: "#6b7280" };
type Selection = { id: string; version: number } | null;

function Locations({
  requests,
  selection,
}: {
  requests: AssistanceRequest[];
  selection: Selection;
}) {
  const map = useMap();
  const fitted = useRef(false);
  const focusedVersion = useRef<number | null>(null);
  const markers = useRef(new Map<string, L.CircleMarker>());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = requests.find((request) => request.id === selectedId);

  useEffect(() => {
    if (!fitted.current && requests.length) {
      map.fitBounds(
        L.latLngBounds(requests.map((item) => [item.latitude, item.longitude])),
        { padding: [32, 32], maxZoom: 16 },
      );
      fitted.current = true;
    }
  }, [map, requests]);

  useEffect(() => {
    if (!selection || focusedVersion.current === selection.version) return;
    const item = requests.find((request) => request.id === selection.id);
    if (!item) return;
    focusedVersion.current = selection.version;
    setSelectedId(item.id);
    const center = L.latLng(item.latitude, item.longitude);
    map.fitBounds(center.toBounds(Math.max(100, item.accuracy_meters * 2)), {
      padding: [40, 40],
      maxZoom: 17,
    });
    markers.current.get(item.id)?.openPopup();
  }, [map, selection, requests]);

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
          radius={9}
          pathOptions={{
            color: "white",
            weight: 2,
            fillColor: colors[item.status],
            fillOpacity: 1,
          }}
          eventHandlers={{ click: () => setSelectedId(item.id) }}
        >
          <Popup>
            <div className="assistance-map-popup">
              <strong>{item.display_name || "Name not provided"}</strong>
              <span>{item.status.replaceAll("_", " ")}</span>
              <span>
                {item.contact_number
                  ? `Contact: ${item.contact_number}`
                  : "Contact not provided"}
              </span>
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
              <span>
                Recorded: {new Date(item.location_recorded_at).toLocaleString()}
              </span>
              <small>
                Shared snapshot. The person may have moved since this was
                recorded.
              </small>
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
}: {
  requests: AssistanceRequest[];
  selection: Selection;
}) {
  const valid = requests.filter(
    (item) =>
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
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Locations requests={valid} selection={selection} />
    </MapContainer>
  );
}
