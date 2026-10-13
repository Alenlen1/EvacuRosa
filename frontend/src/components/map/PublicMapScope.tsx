"use client";
import { useEffect, useRef, useState } from "react";
import { useMap } from "react-leaflet";
import { useLanguage } from "@/components/LanguageProvider";
import { isInsideSantaRosa, PUBLIC_MAP_MIN_ZOOM, SANTA_ROSA_CITY_CENTER } from "@/lib/mapBounds";

export function PublicMapScope() {
  const map = useMap();
  const { t } = useLanguage();
  const [visible, setVisible] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    let correcting = false;
    let dragging = false;
    let notifiedForDrag = false;
    const dragStart = () => { dragging = true; notifiedForDrag = false; };
    const dragEnd = () => { dragging = false; };
    let last = map.getCenter();
    if (!isInsideSantaRosa(last.lat, last.lng)) last = { lat: SANTA_ROSA_CITY_CENTER[0], lng: SANTA_ROSA_CITY_CENTER[1] } as typeof last;
    const notify = () => {
      setVisible(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setVisible(false), 3500);
    };
    const constrain = () => {
      if (correcting) return;
      const center = map.getCenter();
      if (isInsideSantaRosa(center.lat, center.lng)) { last = center; return; }
      correcting = true;
      map.stop();
      map.setView(last, Math.max(PUBLIC_MAP_MIN_ZOOM, map.getZoom()), { animate: false });
      correcting = false;
      if (dragging && !notifiedForDrag) { notifiedForDrag = true; notify(); }
    };
    const click = (event: { latlng: { lat: number; lng: number } }) => {
      if (!isInsideSantaRosa(event.latlng.lat, event.latlng.lng)) notify();
    };
    map.on("dragstart", dragStart);
    map.on("dragend", dragEnd);
    map.on("move", constrain);
    map.on("click", click);
    constrain();
    return () => {
      map.off("move", constrain); map.off("click", click);
      map.off("dragstart", dragStart); map.off("dragend", dragEnd);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [map]);
  return visible ? <div className="public-map-scope-notice" role="status">{t("This map is limited to Santa Rosa City. Select a location inside the city.")}</div> : null;
}
