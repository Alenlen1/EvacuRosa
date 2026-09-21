"use client";

import { LocateFixed } from "lucide-react";

interface MapControlsProps {
  onFollowMe: () => void;
  isFollowing: boolean;
}

export function MapControls({ onFollowMe, isFollowing }: MapControlsProps) {
  return (
    <div className="leaflet-top leaflet-right">
      <div className="leaflet-control leaflet-bar">
        <button
          type="button"
          onClick={onFollowMe}
          aria-pressed={isFollowing}
          aria-label="Follow my location"
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
