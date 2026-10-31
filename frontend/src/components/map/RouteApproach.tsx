"use client";

import { useEffect, useMemo, useRef } from "react";
import { Polyline, Tooltip, useMap } from "react-leaflet";
import type { Polyline as LeafletPolyline } from "leaflet";
import { useLanguage } from "@/components/LanguageProvider";
import { meters } from "@/lib/navigation";
import type { LatLng } from "@/services/api";
import { traceDashedRoutePaths } from "@/lib/routeTrace";

/** Visual reference only. Never add this unverified gap to the routed path. */
export function RouteApproach({
  route,
  destination,
}: {
  route: LatLng[] | null;
  destination?: LatLng;
}) {
  const { t } = useLanguage();
  const map = useMap();
  const outline = useRef<LeafletPolyline>(null);
  const line = useRef<LeafletPolyline>(null);
  const endpoint =
    route && route.length >= 2 ? route[route.length - 1] : undefined;
  const positions = useMemo<[number, number][]>(
    () =>
      endpoint && destination
        ? [
            [endpoint.latitude, endpoint.longitude],
            [destination.latitude, destination.longitude],
          ]
        : [],
    [
      endpoint?.latitude,
      endpoint?.longitude,
      destination?.latitude,
      destination?.longitude,
    ],
  );
  const distance = endpoint && destination ? meters(endpoint, destination) : 0;
  // Ignore rounding-sized gaps and stale/mismatched destinations beyond the
  // router's 250 m endpoint search radius.
  const visible = Number.isFinite(distance) && distance > 5 && distance <= 250;
  useEffect(() => {
    if (!visible) return;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const stop = traceDashedRoutePaths(
      [
        outline.current?.getElement() as SVGPathElement | undefined,
        line.current?.getElement() as SVGPathElement | undefined,
      ],
      preference.matches,
    );
    map.on("zoomstart movestart", stop);
    preference.addEventListener("change", stop);
    return () => {
      stop();
      map.off("zoomstart movestart", stop);
      preference.removeEventListener("change", stop);
    };
  }, [positions, visible, map]);
  if (!visible) return null;
  return (
    <>
      <Polyline
        ref={outline}
        positions={positions}
        noClip
        pathOptions={{
          color: "#252b31",
          weight: 7,
          dashArray: "8 10",
          interactive: false,
        }}
      />
      <Polyline
        ref={line}
        positions={positions}
        noClip
        pathOptions={{
          className: "route-unmapped-approach",
          color: "#f4d84b",
          weight: 4,
          dashArray: "8 10",
          interactive: false,
        }}
      >
        <Tooltip
          permanent
          direction="left"
          offset={[-8, 0]}
          opacity={1}
          className="route-approach-tooltip"
        >
          {t("Unmapped approach (~{distance} m)", {
            distance: Math.round(distance),
          })}
        </Tooltip>
      </Polyline>
    </>
  );
}
