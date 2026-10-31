"use client";

import { Circle, Marker, Tooltip } from "react-leaflet";
import { useRef } from "react";
import type { Circle as LeafletCircle, Marker as LeafletMarker } from "leaflet";
import { createDivIcon } from "@/components/map/icons";
import type { EarthquakeImpactArea } from "@/services/api";
import { haversineMeters } from "../../../../backend/src/algorithms/astar/heuristic";

const centerIcon = createDivIcon(
  '<span style="display:block;width:24px;height:24px;border:3px solid white;border-radius:50%;background:#7c3aed;box-shadow:0 1px 5px #0008"></span>',
  24,
);
const resizeIcon = createDivIcon(
  '<span style="display:grid;place-items:center;width:24px;height:24px;border:2px solid #7c3aed;border-radius:50%;background:white;color:#5b21b6;font-weight:bold">↔</span>',
  24,
);

export function EarthquakeAreaHandles({
  area,
  disabled,
  onMove,
  onResize,
}: {
  area: EarthquakeImpactArea;
  disabled: boolean;
  onMove: (latitude: number, longitude: number) => void;
  onResize: (radius: number) => void;
}) {
  const circle = useRef<LeafletCircle>(null);
  const resizeMarker = useRef<LeafletMarker>(null);
  const radius = Number.isFinite(area.radiusMeters)
    ? Math.max(5, Math.min(250, area.radiusMeters))
    : 25;
  const edge: [number, number] = [
    area.latitude,
    area.longitude +
      radius / (111195 * Math.cos((area.latitude * Math.PI) / 180)),
  ];
  return (
    <>
      <Circle
        ref={circle}
        center={[area.latitude, area.longitude]}
        radius={radius}
        interactive={false}
        pathOptions={{
          color: "#7c3aed",
          weight: 2,
          fillOpacity: 0.1,
          dashArray: "5 5",
        }}
      />
      <Marker
        position={[area.latitude, area.longitude]}
        icon={centerIcon}
        draggable={!disabled}
        title="Move debris location"
        alt="Draggable debris location"
        eventHandlers={{
          drag: (event) => {
            const point = event.target.getLatLng();
            circle.current?.setLatLng(point);
            resizeMarker.current?.setLatLng([
              point.lat,
              point.lng +
                radius / (111195 * Math.cos((point.lat * Math.PI) / 180)),
            ]);
          },
          dragend: (event) => {
            const point = event.target.getLatLng();
            event.target.setLatLng([area.latitude, area.longitude]);
            circle.current?.setLatLng([area.latitude, area.longitude]);
            resizeMarker.current?.setLatLng(edge);
            onMove(point.lat, point.lng);
          },
        }}
      >
        <Tooltip direction="top">Drag to move debris location</Tooltip>
      </Marker>
      <Marker
        ref={resizeMarker}
        position={edge}
        icon={resizeIcon}
        draggable={!disabled}
        title="Resize affected area"
        alt="Draggable affected area size"
        eventHandlers={{
          drag: (event) => {
            const point = event.target.getLatLng();
            circle.current?.setRadius(
              Math.max(
                5,
                Math.min(
                  250,
                  haversineMeters(
                    area.latitude,
                    area.longitude,
                    point.lat,
                    point.lng,
                  ),
                ),
              ),
            );
          },
          dragend: (event) => {
            const point = event.target.getLatLng();
            event.target.setLatLng(edge);
            circle.current?.setRadius(radius);
            onResize(
              Math.max(
                5,
                Math.min(
                  250,
                  Math.round(
                    haversineMeters(
                      area.latitude,
                      area.longitude,
                      point.lat,
                      point.lng,
                    ),
                  ),
                ),
              ),
            );
          },
        }}
      >
        <Tooltip direction="top">Drag to resize · {radius} m</Tooltip>
      </Marker>
    </>
  );
}
