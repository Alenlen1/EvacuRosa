"use client";

import { MapPin } from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";
import type { GeolocationState } from "@/hooks/useGeolocation";

export function LocationRecovery({ location, onRetry }: { location: GeolocationState; onRetry: () => void }) {
  const { t } = useLanguage();
  const unavailable = ["denied", "unavailable", "timeout"].includes(location.status);
  if (location.status === "active" || (!unavailable && !location.error)) return null;
  const locating = location.status === "locating";
  return <section className="location-recovery" aria-label={t("Location help")}>
    <MapPin size={20} aria-hidden="true" />
    <div>
      <strong role="status">{t(locating ? "Checking your location…" : "Location is not available")}</strong>

      <details><summary>{t("How to enable location")}</summary>
      <p>{t("Turn on your phone's Location Services and allow location access for your browser or EvacuRosa. Return here; your location will reconnect automatically.")}</p>
        <p>{t("iPhone: Settings → Privacy & Security → Location Services. Turn it on and allow access for Safari Websites or your browser.")}</p>
        <p>{t("Android: Settings → Location. Turn it on, then allow location for Chrome or your browser and this website.")}</p>
        <p>{t("If you previously blocked this website, change its location permission to Allow in your browser's website settings.")}</p>
      </details>
    </div>
    <button type="button" onClick={onRetry} disabled={locating}>{t(locating ? "Checking…" : "Try location again")}</button>
  </section>;
}
