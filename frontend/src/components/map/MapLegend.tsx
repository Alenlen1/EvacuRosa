"use client";
import { useLanguage } from "@/components/LanguageProvider";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Info, X } from "lucide-react";
export function MapLegend() {
  const { t } = useLanguage();
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<CSSProperties>({});
  useEffect(() => {
    if (!open) return;
    const place = () => {
      const button = trigger.current;
      if (!button) return;
      const anchor = button.getBoundingClientRect();
      const map = button.closest(".map-canvas")?.getBoundingClientRect();
      const top = Math.max(8, map?.top ?? 8);
      const bottom = Math.min(window.innerHeight - 8, map?.bottom ?? window.innerHeight - 8);
      const above = anchor.top - top - 8;
      const below = bottom - anchor.bottom - 8;
      const upward = above > below;
      const height = Math.max(44, Math.min(300, upward ? above : below));
      const width = Math.min(264, window.innerWidth - 24);
      setPosition({ width, maxHeight: height, left: Math.max(12, Math.min(anchor.right - width, window.innerWidth - width - 12)),
        top: upward ? undefined : anchor.bottom + 8, bottom: upward ? window.innerHeight - anchor.top + 8 : undefined });
    };
    const dismiss = (event: PointerEvent) => {
      if (!panel.current?.contains(event.target as Node) && !trigger.current?.contains(event.target as Node)) setOpen(false);
    };
    const key = (event: KeyboardEvent) => { if (event.key === "Escape") { setOpen(false); trigger.current?.focus(); } };
    place();
    const observer = new ResizeObserver(place);
    if (trigger.current) observer.observe(trigger.current);
    const map = trigger.current?.closest(".map-canvas");
    if (map) observer.observe(map);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", key);
    return () => { observer.disconnect(); window.removeEventListener("resize", place); window.removeEventListener("scroll", place, true); document.removeEventListener("pointerdown", dismiss); document.removeEventListener("keydown", key); };
  }, [open]);
  return (
    <div className="map-legend">
      <button type="button" className="map-legend-trigger" ref={trigger} aria-expanded={open} aria-controls="map-legend-panel" aria-label={t("Map legend")} title={t("Map legend")} onClick={() => setOpen(value => !value)}><Info className="map-legend-icon" size={18} aria-hidden="true" /><span>{t("Map legend")}</span></button>
      {open && createPortal(<div ref={panel} id="map-legend-panel" className="map-legend-popover" role="region" aria-label={t("Map legend")} style={position}>
      <div className="map-legend-content">
      <header><strong>{t("Map legend")}</strong><button type="button" aria-label={t("Dismiss")} onClick={() => { setOpen(false); trigger.current?.focus(); }}><X size={20} aria-hidden="true" /></button></header>
      <ul>
        <li><span className="legend-dot location" />{t("Your location")}</li>
        <li><span className="legend-dot destination" />{t("Selected destination")}</li>
        <li><span className="legend-line route" />{t("Recommended route")}</li>
        <li><span className="legend-line blocked" />{t("Blocked flood road")}</li>
        <li><span className="legend-line flood" />{t("Flood-affected road")}</li>
        <li><span className="legend-dot shelter" />{t("Evacuation center — see status")}</li>
        <li><span className="legend-dot fire" />{t("Fire incident")}</li>
        <li><span className="legend-dot earthquake" />{t("Earthquake — see verified impacts")}</li>
      </ul>
          </div>
      </div>, document.body)}
    </div>
  );
}
