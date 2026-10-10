"use client";

import { useEffect, useMemo, useRef } from "react";
import { Polyline, useMap } from "react-leaflet";
import type { Polyline as LeafletPolyline } from "leaflet";
import { traceRoutePaths } from "@/lib/routeTrace";

interface RoutePolylineProps {
  points: { latitude: number; longitude: number }[];
  navigating?: boolean;
}

export function RoutePolyline({
  points,
  navigating = false,
}: RoutePolylineProps) {
  const map = useMap();
  const outline = useRef<LeafletPolyline>(null);
  const line = useRef<LeafletPolyline>(null);
  const positions = useMemo(
    () => points.map((p): [number, number] => [p.latitude, p.longitude]),
    [points],
  );

  useEffect(() => {
    if (points.length < 2 || navigating) return;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const stopTrace = traceRoutePaths(
      [
        outline.current?.getElement() as SVGPathElement | undefined,
        line.current?.getElement() as SVGPathElement | undefined,
      ],
      preference.matches,
    );
    // Leaflet reprojects/clips paths during interaction: reveal the full line
    // immediately rather than animate stale screen-space lengths.
    map.on("zoomstart movestart", stopTrace);
    preference.addEventListener("change", stopTrace);
    return () => {
      stopTrace();
      map.off("zoomstart movestart", stopTrace);
      preference.removeEventListener("change", stopTrace);
    };
  }, [points, map, navigating]);

  if (points.length < 2) return null;

  // Preserve every road vertex at every zoom. Avoid viewport clipping while
  // the rotation plugin transforms the renderer during camera transitions.
  return (
    <>
      <Polyline
        ref={outline}
        noClip
        smoothFactor={0}
        positions={positions}
        pathOptions={{
          color: navigating ? "white" : "#252b31",
          weight: 9,
          opacity: 1,
          interactive: false,
        }}
      />
      <Polyline
        ref={line}
        noClip
        smoothFactor={0}
        positions={positions}
        pathOptions={{
          color: "#f4d84b",
          weight: 5,
          opacity: 1,
          interactive: false,
        }}
      />
    </>
  );
}
