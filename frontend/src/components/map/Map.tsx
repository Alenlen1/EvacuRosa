"use client";

// @refresh reset
// Leaflet owns DOM nodes. Remount after edits instead of preserving a removed
// map instance across Fast Refresh effect cleanup/replay.

import "leaflet/dist/leaflet.css";
import { useEffect, useState } from "react";
import { Layers } from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";
import { DomEvent } from "leaflet";
import { MapContainer, useMap, useMapEvents } from "react-leaflet";
import {
  FloodIcon as Droplet,
  FireIcon as Flame,
  EarthquakeIcon as Activity,
} from "@/components/ui/HazardIcons";
import {
  SANTA_ROSA_CITY_BOUNDS,
  SANTA_ROSA_CITY_CENTER,
  SANTA_ROSA_CITY_DEFAULT_ZOOM,
} from "@/lib/mapBounds";
import type { GeolocationState } from "@/hooks/useGeolocation";
import type {
  EvacuationCenter,
  FloodReport,
  FireIncident,
  EarthquakeEvent,
  EarthquakeRoadImpact,
} from "@/services/api";
import { EvacuationNavigation } from "./EvacuationNavigation";
import type { TravelMode } from "@/lib/travelTime";
import type { RouteResponse } from "@/services/api";
import { DestinationMarker } from "./DestinationMarker";
import { MapControls } from "./MapControls";
import { EvacuationCenterLayer } from "./EvacuationCenterLayer";
import { FloodLayer } from "./FloodLayer";
import { FireLayer } from "./FireLayer";
import { EarthquakeLayer } from "./EarthquakeLayer";
import { Basemap } from "./Basemap";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

interface MapProps {
  navigationCenter?: EvacuationCenter;
  travelMode: TravelMode;
  onNavigationRoute: (data: RouteResponse) => void;
  onNavigationStart: () => void;
  offlineReady?: boolean;
  geolocation: GeolocationState;
  onRetryLocation?: () => void;
  destination: { latitude: number; longitude: number } | null;
  destinationLabel?: string;
  searchFocus?: { latitude: number; longitude: number } | null;
  onClearDestination: () => void;
  route: { latitude: number; longitude: number }[] | null;
  centers: EvacuationCenter[];
  floodReports: FloodReport[];
  fireIncidents: FireIncident[];
  earthquakeEvents: EarthquakeEvent[];
  earthquakeRoadImpacts: EarthquakeRoadImpact[];
  onMapClick: (latitude: number, longitude: number) => void;
  onSelectCenter?: (center: EvacuationCenter) => void;
}

function FollowUser({
  position,
  following,
}: {
  position: { latitude: number; longitude: number } | null;
  following: boolean;
}) {
  const map = useMap();

  useEffect(() => {
    if (following && position) {
      map.flyTo([position.latitude, position.longitude], map.getZoom(), {
        duration: 0.5,
      });
    }
  }, [following, position, map]);

  return null;
}

/** Reflow Leaflet when the mobile information sheet changes the map's size. */
function ResizeMap() {
  const map = useMap();
  useEffect(() => {
    const observer = new ResizeObserver(() =>
      map.invalidateSize({ pan: false }),
    );
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map]);
  return null;
}

function ClickToSetDestination({
  onMapClick,
}: {
  onMapClick: (latitude: number, longitude: number) => void;
}) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function FocusSearchResult({
  target,
}: {
  target?: { latitude: number; longitude: number } | null;
}) {
  const map = useMap();
  useEffect(() => {
    if (target)
      map.setView(
        [target.latitude, target.longitude],
        Math.max(map.getZoom(), 15),
      );
  }, [target, map]);
  return null;
}

/** Sits inside MapContainer (needs Leaflet's own control positioning
 * classes), unlike MapControls which is the follow-me button. Grows one
 * button per hazard layer as phases add them. */
function LayerToggle({
  showFlood,
  onToggleFlood,
  showFire,
  onToggleFire,
  showEarthquakes,
  onToggleEarthquakes,
}: {
  showFlood: boolean;
  onToggleFlood: () => void;
  showFire: boolean;
  onToggleFire: () => void;
  showEarthquakes: boolean;
  onToggleEarthquakes: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const { t } = useLanguage();
  return (
    <div
      className={`leaflet-bottom leaflet-left hazard-layer-controls${expanded ? " is-expanded" : ""}`}
      ref={(element) => {
        if (element) DomEvent.disableClickPropagation(element);
      }}
    >
      <button
        type="button"
        className="leaflet-control hazard-layer-toggle"
        aria-label={t("Hazard layers")}
        title={t("Hazard layers")}
        aria-expanded={expanded}
        aria-controls="hazard-layer-options"
        onClick={() => setExpanded((value) => !value)}
      >
        <Layers size={18} aria-hidden="true" />
      </button>
      <div
        id="hazard-layer-options"
        className="leaflet-control leaflet-bar flex"
      >
        <button
          type="button"
          onClick={onToggleFlood}
          aria-pressed={showFlood}
          aria-label="Toggle flood layer"
          title="Toggle flood layer"
          className={`flex h-10 w-10 items-center justify-center bg-white ${
            showFlood ? "text-blue-600" : "text-slate-400"
          }`}
        >
          <Droplet size={18} />
        </button>
        <button
          type="button"
          onClick={onToggleFire}
          aria-pressed={showFire}
          aria-label="Toggle fire layer"
          title="Toggle fire layer"
          className={`flex h-10 w-10 items-center justify-center bg-white ${
            showFire ? "text-red-600" : "text-slate-400"
          }`}
        >
          <Flame size={18} />
        </button>
        <button
          type="button"
          onClick={onToggleEarthquakes}
          aria-pressed={showEarthquakes}
          aria-label="Toggle earthquake layer"
          title="Toggle earthquake layer"
          className={`flex h-10 w-10 items-center justify-center bg-white ${
            showEarthquakes ? "text-amber-700" : "text-slate-400"
          }`}
        >
          <Activity size={18} />
        </button>
      </div>
    </div>
  );
}

export default function Map({
  navigationCenter,
  travelMode,
  onNavigationRoute,
  onNavigationStart,
  offlineReady = false,
  geolocation,
  onRetryLocation,
  destination,
  destinationLabel,
  searchFocus,
  onClearDestination,
  route,
  centers,
  floodReports,
  fireIncidents,
  earthquakeEvents,
  earthquakeRoadImpacts,
  onMapClick,
  onSelectCenter,
}: MapProps) {
  const isOnline = useOnlineStatus();
  const [following, setFollowing] = useState(false);
  const [navigating, setNavigating] = useState(false);
  useEffect(() => {
    if (navigating) setFollowing(false);
  }, [navigating]);
  useEffect(() => {
    if (searchFocus) setFollowing(false);
  }, [searchFocus]);
  const [showFlood, setShowFlood] = useState(true);
  const [showFire, setShowFire] = useState(true);
  const [showEarthquakes, setShowEarthquakes] = useState(true);

  return (
    <MapContainer
      center={SANTA_ROSA_CITY_CENTER}
      zoom={SANTA_ROSA_CITY_DEFAULT_ZOOM}
      maxBounds={SANTA_ROSA_CITY_BOUNDS}
      maxBoundsViscosity={0.8}
      minZoom={12}
      maxZoom={19}
      rotate
      rotateControl={false}
      // leaflet-rotate can drift vector overlays during CSS zoom transitions.
      // Apply discrete zooms atomically; pinch zoom still tracks the fingers.
      zoomAnimation={false}
      // Keep pinch gestures dedicated to zoom. Heading rotation is controlled
      // by NavigationCamera and pauses while a zoom gesture is in progress.
      touchRotate={false}
      shiftKeyRotate={false}
      className="h-full w-full"
    >
      <Basemap online={isOnline} routingReady={offlineReady} />
      {showFlood && <FloodLayer reports={floodReports} />}
      {showFire && <FireLayer incidents={fireIncidents} />}
      {showEarthquakes && (
        <EarthquakeLayer
          events={earthquakeEvents}
          roadImpacts={earthquakeRoadImpacts}
        />
      )}
      <EvacuationCenterLayer
        centers={centers}
        onSelectCenter={onSelectCenter}
      />
      <EvacuationNavigation
        route={route}
        center={
          navigationCenter ??
          (destination ? { ...destination, name: destinationLabel } : undefined)
        }
        mode={travelMode}
        geolocation={geolocation}
        onRoute={onNavigationRoute}
        onStart={onNavigationStart}
        onActiveChange={setNavigating}
        onDetails={
          navigationCenter && onSelectCenter
            ? () => onSelectCenter(navigationCenter)
            : undefined
        }
      />
      {destination && (
        <DestinationMarker
          label={destinationLabel}
          onRemove={onClearDestination}
          latitude={destination.latitude}
          longitude={destination.longitude}
        />
      )}
      {!navigating && <ClickToSetDestination onMapClick={onMapClick} />}
      <ResizeMap />
      <FollowUser
        position={geolocation.position}
        following={following && !navigating}
      />
      {!navigating && <FocusSearchResult target={searchFocus} />}
      {!navigating && (
        <LayerToggle
          showFlood={showFlood}
          onToggleFlood={() => setShowFlood((v) => !v)}
          showFire={showFire}
          onToggleFire={() => setShowFire((v) => !v)}
          showEarthquakes={showEarthquakes}
          onToggleEarthquakes={() => setShowEarthquakes((v) => !v)}
        />
      )}
      {!navigating && (
        <MapControls
          isFollowing={following}
          onFollowMe={() => {
            if (geolocation.status !== "active") {
              onRetryLocation?.();
              setFollowing(true);
            } else setFollowing((f) => !f);
          }}
        />
      )}
    </MapContainer>
  );
}
