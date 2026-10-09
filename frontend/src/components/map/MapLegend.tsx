"use client";
import { useLanguage } from "@/components/LanguageProvider";
import { Info } from "lucide-react";
export function MapLegend() {
  const { t } = useLanguage();
  return (
    <details className="map-legend">
      <summary aria-label={t("Map legend")} title={t("Map legend")}><Info className="map-legend-icon" size={18} aria-hidden="true" /><span>{t("Map legend")}</span></summary>
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
    </details>
  );
}
