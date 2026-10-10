"use client";
import { useEffect, useRef } from "react";
import { Marker, Circle, useMap } from "react-leaflet";
import type { Marker as LeafletMarker } from "leaflet";
import { createDivIcon } from "./icons";
import {
  headingDelta,
  interpolate,
  normalizeHeading,
  type NavigationFix,
} from "@/lib/navigation";

const icon = createDivIcon(
  '<div class="navigation-direction"><span class="navigation-cone"></span><span class="navigation-arrow"></span></div>',
  32,
);
export function NavigationLocation({
  position,
  heading,
}: {
  position: NavigationFix;
  heading: number | null;
}) {
  const marker = useRef<LeafletMarker>(null);
  const map = useMap();
  const angle = useRef(0);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      const turn = () => {
        const element = marker.current
          ?.getElement()
          ?.querySelector<HTMLElement>(".navigation-direction");
        if (!element) return;
        const target = (heading ?? 0) + map.getBearing();
        const difference = headingDelta(
          normalizeHeading(angle.current),
          normalizeHeading(target),
        );
        const reduced = window.matchMedia(
          "(prefers-reduced-motion: reduce)",
        ).matches;
        angle.current += reduced ? difference : difference * 0.3;
        element.style.transform = `rotate(${angle.current}deg)`;
        element.classList.toggle("heading-unknown", heading === null);
        if (Math.abs(difference) > 0.2) frame = requestAnimationFrame(turn);
      };
      turn();
    };
    update();
    map.on("rotate", update);
    return () => {
      cancelAnimationFrame(frame);
      map.off("rotate", update);
    };
  }, [heading, map]);
  useEffect(() => {
    if (!marker.current) return;
    const start = marker.current.getLatLng();
    const from = { latitude: start.lat, longitude: start.lng };
    const at = performance.now();
    let frame = 0;
    const move = (time: number) => {
      const t = window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? 1
        : Math.min(1, (time - at) / 450);
      const p = interpolate(from, position, 1 - (1 - t) ** 3);
      marker.current?.setLatLng([p.latitude, p.longitude]);
      if (t < 1) frame = requestAnimationFrame(move);
    };
    frame = requestAnimationFrame(move);
    return () => cancelAnimationFrame(frame);
  }, [position]);
  // Keep the React marker position stable; the effect interpolates GPS updates.
  const initial = useRef<[number, number]>([
    position.latitude,
    position.longitude,
  ]);
  return (
    <>
      <Circle
        center={[position.latitude, position.longitude]}
        radius={position.accuracy}
        pathOptions={{
          color: "#2563eb",
          weight: 1,
          fillOpacity: 0.08,
          interactive: false,
        }}
      />
      <Marker
        ref={marker}
        position={initial.current}
        icon={icon}
        interactive={false}
        zIndexOffset={1000}
      />
    </>
  );
}
