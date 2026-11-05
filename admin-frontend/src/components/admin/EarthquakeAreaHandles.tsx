"use client";

import {
  Marker,
  Polygon,
  Polyline,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";
import { useEffect, useRef, useState } from "react";
import type { LatLng, Marker as LeafletMarker } from "leaflet";
import { createDivIcon } from "@/components/map/icons";
import type { EarthquakeRectangleArea } from "@/services/api";
import {
  rectangleCorners,
  rectangleFromCorners,
  rectangleLocalPoint,
  rectanglePoint,
  resizeRectangleFromCorner,
} from "../../../../backend/src/algorithms/earthquakeArea";

const centerIcon = createDivIcon(
  '<span class="earthquake-rectangle-handle earthquake-rectangle-move">✥</span>',
  28,
);
const cornerIcon = createDivIcon(
  '<span class="earthquake-rectangle-handle">↔</span>',
  24,
);
const rotationIcon = createDivIcon(
  '<span class="earthquake-rectangle-handle earthquake-rectangle-rotate">↻</span>',
  32,
);

/** A desktop-style selection box. Normal map controls return after drawing. */
export function EarthquakeAreaHandles({
  area,
  drawing,
  disabled,
  onChange,
  onCancel,
  onEditingChange,
}: {
  area: EarthquakeRectangleArea | null;
  drawing: boolean;
  disabled: boolean;
  onChange: (area: EarthquakeRectangleArea) => void;
  onCancel: () => void;
  onEditingChange: (editing: boolean) => void;
}) {
  const map = useMap();
  const [draft, setDraft] = useState<EarthquakeRectangleArea | null>(null);
  const handlers = useRef({ onChange, onCancel, onEditingChange });
  const dragStartArea = useRef<EarthquakeRectangleArea | null>(null);
  const [, setZoomVersion] = useState(0);
  useMapEvents({ zoomend: () => setZoomVersion((version) => version + 1) });
  useEffect(() => {
    handlers.current = { onChange, onCancel, onEditingChange };
  }, [onChange, onCancel, onEditingChange]);

  useEffect(() => {
    if (!disabled && !drawing) return;
    dragStartArea.current = null;
    setDraft(null);
    handlers.current.onEditingChange(false);
  }, [disabled, drawing]);

  useEffect(() => () => handlers.current.onEditingChange(false), []);

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

  function beginDrag() {
    dragStartArea.current = area;
    handlers.current.onEditingChange(true);
  }

  function finishDrag(next: EarthquakeRectangleArea) {
    dragStartArea.current = null;
    setDraft(null);
    handlers.current.onChange(next);
    handlers.current.onEditingChange(false);
  }

  function draggedArea(
    kind: "move" | "rotate" | number,
    marker: LeafletMarker,
  ): EarthquakeRectangleArea | null {
    const start = dragStartArea.current;
    if (!start) return null;
    const position = marker.getLatLng();
    const point = { latitude: position.lat, longitude: position.lng };
    if (kind === "move") return { ...start, ...point };
    if (kind === "rotate") {
      const offset = rectangleLocalPoint(
        { ...start, rotationDegrees: 0 },
        point,
      );
      if (Math.hypot(offset.x, offset.y) < 1) return start;
      const degrees =
        Math.round((Math.atan2(offset.x, offset.y) * 1800) / Math.PI) / 10;
      return { ...start, rotationDegrees: ((degrees % 360) + 360) % 360 };
    }
    return resizeRectangleFromCorner(start, kind, point);
  }

  function dragHandlers(kind: "move" | "rotate" | number) {
    return {
      dragstart: beginDrag,
      drag: (event: { target: LeafletMarker }) => {
        const next = draggedArea(kind, event.target);
        if (next) setDraft(next);
      },
      dragend: (event: { target: LeafletMarker }) => {
        const next = draggedArea(kind, event.target);
        // Reset the native marker too if the parent rejects an out-of-city move.
        const original =
          kind === "move"
            ? area && ([area.latitude, area.longitude] as [number, number])
            : typeof kind === "number"
              ? area && rectangleCorners(area)[kind]
              : rotationPosition;
        if (original) event.target.setLatLng(original);
        if (next) finishDrag(next);
      },
    };
  }

  const displayed = draft ?? area;
  const corners = displayed ? rectangleCorners(displayed) : null;
  const top = displayed
    ? rectanglePoint(displayed, 0, displayed.heightMeters / 2)
    : null;
  let rotationPosition: [number, number] | null = null;
  if (displayed && top) {
    const centerPixel = map.latLngToContainerPoint([
      displayed.latitude,
      displayed.longitude,
    ]);
    const topPixel = map.latLngToContainerPoint([top.latitude, top.longitude]);
    const dx = topPixel.x - centerPixel.x;
    const dy = topPixel.y - centerPixel.y;
    const length = Math.hypot(dx, dy) || 1;
    const handle = map.containerPointToLatLng([
      topPixel.x + (dx / length) * 44,
      topPixel.y + (dy / length) * 44,
    ]);
    rotationPosition = [handle.lat, handle.lng];
  }
  return (
    <>
      {corners && (
        <Polygon
          positions={corners}
          interactive={false}
          pathOptions={{
            color: "#7c3aed",
            weight: 2,
            fillOpacity: 0.12,
            dashArray: "5 5",
          }}
        />
      )}
      {displayed && corners && rotationPosition && top && !drawing && (
        <>
          <Polyline
            positions={[[top.latitude, top.longitude], rotationPosition]}
            interactive={false}
            pathOptions={{ color: "#7c3aed", weight: 2, dashArray: "3 4" }}
          />
          <Marker
            position={rotationPosition}
            icon={rotationIcon}
            draggable={!disabled}
            title="Rotate debris rectangle"
            alt="Rotate debris rectangle"
            zIndexOffset={1000}
            eventHandlers={dragHandlers("rotate")}
          >
            <Tooltip>Drag to rotate the area</Tooltip>
          </Marker>
          <Marker
            position={[displayed.latitude, displayed.longitude]}
            icon={centerIcon}
            draggable={!disabled}
            title="Move debris rectangle"
            alt="Move debris rectangle"
            eventHandlers={dragHandlers("move")}
          >
            <Tooltip>Drag to move the area</Tooltip>
          </Marker>
          {corners.map((corner, index) => (
            <Marker
              key={index}
              position={[corner[0], corner[1]]}
              icon={cornerIcon}
              draggable={!disabled}
              title="Resize debris rectangle"
              alt="Resize debris rectangle corner"
              eventHandlers={dragHandlers(index)}
            >
              <Tooltip>Drag this corner to resize</Tooltip>
            </Marker>
          ))}
        </>
      )}
    </>
  );
}
