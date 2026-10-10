"use client";
import { useLanguage } from "@/components/LanguageProvider";

import { LocateFixed } from "lucide-react";
import { DomEvent } from "leaflet";

interface MapControlsProps {
  onFollowMe: () => void;
  isFollowing: boolean;
}

export function MapControls({ onFollowMe, isFollowing }: MapControlsProps) {
  const { t } = useLanguage();
  return (
    <div
      className="leaflet-top leaflet-right"
      ref={(element) => {
        if (element) DomEvent.disableClickPropagation(element);
      }}
    >
      <div className="leaflet-control leaflet-bar">
        <button
          type="button"
          onClick={onFollowMe}
          aria-pressed={isFollowing}
          aria-label={t("Follow my location")}
          title={
            isFollowing
              ? t("Stop following my location")
              : t("Follow my location")
          }
          className={`flex h-10 w-10 items-center justify-center bg-white ${
            isFollowing ? "text-blue-600" : "text-slate-700"
          }`}
        >
          <LocateFixed size={20} />
        </button>
      </div>
    </div>
  );
}
