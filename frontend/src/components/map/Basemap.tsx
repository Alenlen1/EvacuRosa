"use client";
import { useEffect, useState } from "react";
import type * as Leaflet from "leaflet";
import { TileLayer, useMap } from "react-leaflet";
import { getSavedBasemap, openBasemap, type SavedBasemap } from "@/lib/offline/basemap";
import { SANTA_ROSA_CITY_BOUNDS } from "@/lib/mapBounds";
import { OfflineRoadLayer } from "./OfflineRoadLayer";
import { loadBasemapRenderer } from "@/lib/offline/basemapRenderer";
import { offlineBasemapStyle } from "@/lib/offline/basemapStyle";
import { useSystemDarkMode } from "@/hooks/useSystemDarkMode";

export function Basemap({ online, routingReady }: { online: boolean; routingReady: boolean }) {
  const map = useMap();
  const dark = useSystemDarkMode();
  const [data, setData] = useState<SavedBasemap | null>(null);
  const [renderFailed, setRenderFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const load = () => { void getSavedBasemap().then(saved => { if (!cancelled) setData(saved); }).catch(() => {}); };
    load();
    window.addEventListener("evacurosa-basemap-ready", load);
    return () => { cancelled = true; window.removeEventListener("evacurosa-basemap-ready", load); };
  }, [routingReady]);

  useEffect(() => {
    if (online || !data) return;
    let cancelled = false;
    let layer: Leaflet.GridLayer | null = null;
    setRenderFailed(false);
    void loadBasemapRenderer().then(renderer => {
      if (cancelled) return;
      // The plugin's declarations omit its inherited Leaflet methods.
      layer = renderer.leafletLayer({ url: openBasemap(data), ...offlineBasemapStyle(renderer, dark),
        maxDataZoom: 15, maxZoom: 19, noWrap: true, bounds: SANTA_ROSA_CITY_BOUNDS,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors · <a href="https://protomaps.com">Protomaps</a>',
      }) as unknown as Leaflet.GridLayer;
      layer.addTo(map);
    }).catch(() => { if (!cancelled) setRenderFailed(true); });
    return () => { cancelled = true; layer?.remove(); };
  }, [data, map, online, dark]);

  const detailed = !!data && !renderFailed;
  return <>
    {!online && !detailed && <OfflineRoadLayer ready={routingReady} />}
    {online && <TileLayer
      className="online-basemap"
      maxZoom={19}
      maxNativeZoom={19}
      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />}
  </>;
}
