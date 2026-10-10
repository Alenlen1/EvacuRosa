"use client";
import { useLanguage } from "@/components/LanguageProvider";
import { useRef } from "react";
import { Info, X } from "lucide-react";
export function MapLegend() {
  const { t } = useLanguage();
  const dialog = useRef<HTMLDialogElement>(null);
  return (
    <div className="map-legend">
      <button type="button" className="map-legend-trigger" aria-haspopup="dialog" aria-label={t("Map legend")} title={t("Map legend")} onClick={() => dialog.current?.showModal()}><Info className="map-legend-icon" size={18} aria-hidden="true" /><span>{t("Map legend")}</span></button>
      <dialog ref={dialog} className="map-legend-dialog" aria-label={t("Map legend")} onClick={event => { if (event.target === event.currentTarget) dialog.current?.close(); }}>
      <div className="map-legend-content">
      <header><strong>{t("Map legend")}</strong><button type="button" aria-label={t("Dismiss")} onClick={() => dialog.current?.close()}><X size={20} aria-hidden="true" /></button></header>
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
      </dialog>
    </div>
  );
}
