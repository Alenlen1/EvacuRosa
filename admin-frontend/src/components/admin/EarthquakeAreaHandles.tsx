"use client";

import { Marker, Rectangle, Tooltip, useMap } from "react-leaflet";
import { useEffect, useRef, useState } from "react";
import type { LatLng, Marker as LeafletMarker } from "leaflet";
import { createDivIcon } from "@/components/map/icons";
import type { EarthquakeRectangleArea } from "@/services/api";
import {
  rectangleBounds,
  rectangleFromCorners,
} from "../../../../backend/src/algorithms/earthquakeArea";

const centerIcon = createDivIcon(
  '<span class="earthquake-rectangle-handle earthquake-rectangle-move">✥</span>',
  28,
);
const cornerIcon = createDivIcon(
  '<span class="earthquake-rectangle-handle">↔</span>',
  24,
);

/** A desktop-style selection box. Normal map controls return after drawing. */
export function EarthquakeAreaHandles({
  area,
  drawing,
  disabled,
  onChange,
  onCancel,
}: {
  area: EarthquakeRectangleArea | null;
  drawing: boolean;
  disabled: boolean;
  onChange: (area: EarthquakeRectangleArea) => void;
  onCancel: () => void;
}) {
  const map = useMap();
  const [draft, setDraft] = useState<EarthquakeRectangleArea | null>(null);
  const handlers = useRef({ onChange, onCancel });
  useEffect(() => {
    handlers.current = { onChange, onCancel };
  }, [onChange, onCancel]);

  useEffect(() => {
    if (!drawing || disabled) return;
    const container = map.getContainer();
    const wasDragging = map.dragging.enabled();
    const wasBoxZoom = map.boxZoom.enabled();
    const wasDoubleClick = map.doubleClickZoom.enabled();
    const oldTouchAction = container.style.touchAction;
    let start: LatLng | null = null;
    let pointerId: number | null = null;
    map.dragging.disable();
    map.boxZoom.disable();
    map.doubleClickZoom.disable();
    container.classList.add("is-drawing-earthquake");
    container.style.touchAction = "none";
    const point = (event: PointerEvent) =>
      map.containerPointToLatLng(map.mouseEventToContainerPoint(event));
    const release = () => {
      if (pointerId !== null && container.hasPointerCapture(pointerId))
        container.releasePointerCapture(pointerId);
      pointerId = null;
      start = null;
      setDraft(null);
    };
    const down = (event: PointerEvent) => {
      if (
        !event.isPrimary ||
        event.button !== 0 ||
        (event.target as HTMLElement).closest(".leaflet-control")
      )
        return;
      event.preventDefault();
      event.stopPropagation();
      start = point(event);
      pointerId = event.pointerId;
      container.setPointerCapture(event.pointerId);
    };
    const move = (event: PointerEvent) => {
      if (!start || event.pointerId !== pointerId) return;
      event.preventDefault();
      event.stopPropagation();
      const end = point(event);
      setDraft(
        rectangleFromCorners(
          { latitude: start.lat, longitude: start.lng },
          { latitude: end.lat, longitude: end.lng },
        ),
      );
    };
    const up = (event: PointerEvent) => {
      if (!start || event.pointerId !== pointerId) return;
      event.preventDefault();
      event.stopPropagation();
      const end = point(event);
      const next = rectangleFromCorners(
        { latitude: start.lat, longitude: start.lng },
        { latitude: end.lat, longitude: end.lng },
      );
      release();
      handlers.current.onChange(next);
    };
    const cancel = () => release();
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        release();
        handlers.current.onCancel();
      }
    };
    container.addEventListener("pointerdown", down, true);
    container.addEventListener("pointermove", move, true);
    container.addEventListener("pointerup", up, true);
    container.addEventListener("pointercancel", cancel, true);
    window.addEventListener("keydown", key);
    return () => {
      container.removeEventListener("pointerdown", down, true);
      container.removeEventListener("pointermove", move, true);
      container.removeEventListener("pointerup", up, true);
      container.removeEventListener("pointercancel", cancel, true);
      window.removeEventListener("keydown", key);
      release();
      if (wasDragging) map.dragging.enable();
      if (wasBoxZoom) map.boxZoom.enable();
      if (wasDoubleClick) map.doubleClickZoom.enable();
      container.style.touchAction = oldTouchAction;
      container.classList.remove("is-drawing-earthquake");
    };
  }, [map, drawing, disabled]);

  const displayed = draft ?? area;
  const bounds = displayed ? rectangleBounds(displayed) : null;
  const corners = area ? rectangleBounds(area) : null;
  return (
    <>
      {bounds && (
        <Rectangle
          bounds={bounds}
          interactive={false}
          pathOptions={{
            color: "#7c3aed",
            weight: 2,
            fillOpacity: 0.12,
            dashArray: "5 5",
          }}
        />
      )}
      {area && corners && !drawing && (
        <>
          <Marker
            position={[area.latitude, area.longitude]}
            icon={centerIcon}
            draggable={!disabled}
            title="Move debris rectangle"
            alt="Move debris rectangle"
            eventHandlers={{
              dragend: (event) => {
                const marker = event.target as LeafletMarker;
                const next = marker.getLatLng();
                marker.setLatLng([area.latitude, area.longitude]);
                onChange({ ...area, latitude: next.lat, longitude: next.lng });
              },
            }}
          >
            <Tooltip>Drag to move the area</Tooltip>
          </Marker>
          {[
            corners[0],
            [corners[0][0], corners[1][1]],
            corners[1],
            [corners[1][0], corners[0][1]],
          ].map((corner, index) => {
            const opposite =
              index === 0
                ? corners[1]
                : index === 1
                  ? [corners[1][0], corners[0][1]]
                  : index === 2
                    ? corners[0]
                    : [corners[0][0], corners[1][1]];
            return (
              <Marker
                key={index}
                position={[corner[0], corner[1]]}
                icon={cornerIcon}
                draggable={!disabled}
                title="Resize debris rectangle"
                alt="Resize debris rectangle corner"
                eventHandlers={{
                  dragend: (event) => {
                    const marker = event.target as LeafletMarker;
                    const next = marker.getLatLng();
                    marker.setLatLng([corner[0], corner[1]]);
                    onChange(
                      rectangleFromCorners(
                        { latitude: opposite[0], longitude: opposite[1] },
                        { latitude: next.lat, longitude: next.lng },
                      ),
                    );
                  },
                }}
              >
                <Tooltip>Drag this corner to resize</Tooltip>
              </Marker>
            );
          })}
        </>
      )}
    </>
  );
}
