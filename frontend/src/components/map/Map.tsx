"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useState } from "react";
import { DomEvent } from "leaflet";
import { MapContainer, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { FloodIcon as Droplet, FireIcon as Flame, EarthquakeIcon as Activity } from "@/components/ui/HazardIcons";
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
import { UserLocationMarker } from "./UserLocationMarker";
import { DestinationMarker } from "./DestinationMarker";
import { MapControls } from "./MapControls";
import { RoutePolyline } from "./RoutePolyline";
import { EvacuationCenterLayer } from "./EvacuationCenterLayer";
import { FloodLayer } from "./FloodLayer";
import { FireLayer } from "./FireLayer";
import { EarthquakeLayer } from "./EarthquakeLayer";

interface MapProps {
  geolocation: GeolocationState;
  destination: { latitude: number; longitude: number } | null;
  destinationLabel?: string;
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
    const observer = new ResizeObserver(() => map.invalidateSize({ pan: false }));
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
  return (
    <div className="leaflet-bottom leaflet-left hazard-layer-controls" ref={(element) => { if (element) DomEvent.disableClickPropagation(element); }}>
      <div className="leaflet-control leaflet-bar flex">
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
  geolocation,
  destination,
  destinationLabel,
  route,
  centers,
  floodReports,
  fireIncidents,
  earthquakeEvents,
  earthquakeRoadImpacts,
  onMapClick,
  onSelectCenter,
}: MapProps) {
  const [following, setFollowing] = useState(false);
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
      className="h-full w-full"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {showFlood && <FloodLayer reports={floodReports} />}
      {showFire && <FireLayer incidents={fireIncidents} />}
      {showEarthquakes && (
        <EarthquakeLayer events={earthquakeEvents} roadImpacts={earthquakeRoadImpacts} />
      )}
      <EvacuationCenterLayer centers={centers} onSelectCenter={onSelectCenter} />
      {geolocation.status === "active" && geolocation.position && (
        <UserLocationMarker
          latitude={geolocation.position.latitude}
          longitude={geolocation.position.longitude}
          accuracy={geolocation.position.accuracy}
        />
      )}
      {destination && (
        <DestinationMarker
          label={destinationLabel}
          latitude={destination.latitude}
          longitude={destination.longitude}
        />
      )}
      {route && <RoutePolyline points={route} />}
      <ClickToSetDestination onMapClick={onMapClick} />
      <ResizeMap />
      <FollowUser position={geolocation.position} following={following} />
      <LayerToggle
        showFlood={showFlood}
        onToggleFlood={() => setShowFlood((v) => !v)}
        showFire={showFire}
        onToggleFire={() => setShowFire((v) => !v)}
        showEarthquakes={showEarthquakes}
        onToggleEarthquakes={() => setShowEarthquakes((v) => !v)}
      />
      <MapControls
        isFollowing={following}
        onFollowMe={() => setFollowing((f) => !f)}
      />
    </MapContainer>
  );
}
