"use client";
import { useEffect } from "react";
import { useMap } from "react-leaflet";
import { canvas, polyline, type LatLngTuple } from "leaflet";
import { getOfflinePackage } from "@/lib/offline/routing";

// A local road-only basemap: no remote tiles or tile downloads are needed.
export function OfflineRoadLayer({ ready }: { ready: boolean }) {
  const map = useMap();
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    let layer: ReturnType<typeof polyline> | null = null;
    const attribution =
      'Offline roads &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
    void getOfflinePackage()
      .then((data) => {
        if (!data || cancelled) return;
        if (!map.getPane("offline-roads")) {
          const pane = map.createPane("offline-roads");
          pane.style.zIndex = "195";
          pane.style.pointerEvents = "none";
        }
        const nodes = new Map(
          data.graph.data.nodes.map((node) => [node.id, node]),
        );
        const lines: LatLngTuple[][] = [];
        for (const edge of data.graph.data.edges) {
          const start = nodes.get(edge.fromNodeId),
            end = nodes.get(edge.toNodeId);
          if (start && end)
            lines.push([
              [start.latitude, start.longitude],
              [end.latitude, end.longitude],
            ]);
        }
        layer = polyline(lines, {
          renderer: canvas({ pane: "offline-roads" }),
          pane: "offline-roads",
          color: "#7c8b9b",
          weight: 2,
          opacity: 0.85,
          interactive: false,
        }).addTo(map);
        map.attributionControl.addAttribution(attribution);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      layer?.remove();
      map.attributionControl.removeAttribution(attribution);
    };
  }, [map, ready]);
  return null;
}
