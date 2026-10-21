"use client";
import "leaflet/dist/leaflet.css";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Circle,
  Popup,
} from "react-leaflet";
import type { TrackedRequest } from "@/lib/assistance";
export default function ReportedLocationMap({
  request,
}: {
  request: TrackedRequest;
}) {
  const point: [number, number] = [request.latitude, request.longitude];
  return (
    <MapContainer
      key={request.id}
      center={point}
      zoom={16}
      className="assistance-reported-map"
      scrollWheelZoom={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Circle
        center={point}
        radius={request.accuracy_meters}
        pathOptions={{ color: "#2563eb", fillOpacity: 0.12 }}
      />
      <CircleMarker center={point} radius={8}>
        <Popup>
          Reported location for {request.id}. One-time GPS snapshot.
        </Popup>
      </CircleMarker>
    </MapContainer>
  );
}
