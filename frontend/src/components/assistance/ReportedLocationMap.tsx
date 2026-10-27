"use client";
import "leaflet/dist/leaflet.css";
import { useEffect } from "react";
import { latLng } from "leaflet";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Circle,
  Popup,
  useMap,
} from "react-leaflet";
import type { TrackedRequest } from "@/lib/assistance";
function ReportedMapViewport({ request }: { request: TrackedRequest }) {
  const map = useMap();
  useEffect(() => {
    map.invalidateSize({ animate: false });
    if (request.accuracy_meters > 0)
      map.fitBounds(
        latLng(request.latitude, request.longitude).toBounds(
          request.accuracy_meters * 2,
        ),
        { padding: [20, 20], maxZoom: 16, animate: false },
      );
    const observer = new ResizeObserver(() =>
      map.invalidateSize({ animate: false }),
    );
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map, request.latitude, request.longitude, request.accuracy_meters]);
  return null;
}
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
      <ReportedMapViewport request={request} />
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
