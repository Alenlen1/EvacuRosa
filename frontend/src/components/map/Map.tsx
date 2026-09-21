"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useState } from "react";
import { MapContainer, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { Droplet, Flame, Activity } from "lucide-react";
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
  route: { latitude: number; longitude: number }[] | null;
  centers: EvacuationCenter[];
  floodReports: FloodReport[];
  fireIncidents: FireIncident[];
  earthquakeEvents: EarthquakeEvent[];
  earthquakeRoadImpacts: EarthquakeRoadImpact[];
  onMapClick: (latitude: number, longitude: number) => void;
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
    <div className="leaflet-top leaflet-left">
      <div className="leaflet-control leaflet-bar flex">
        <button
          type="button"
          onClick={onToggleFlood}
          aria-pressed={showFlood}
          aria-label="Toggle flood layer"
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
  route,
  centers,
  floodReports,
  fireIncidents,
  earthquakeEvents,
  earthquakeRoadImpacts,
  onMapClick,
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
      <EvacuationCenterLayer centers={centers} />
      {geolocation.status === "active" && geolocation.position && (
        <UserLocationMarker
          latitude={geolocation.position.latitude}
          longitude={geolocation.position.longitude}
          accuracy={geolocation.position.accuracy}
        />
      )}
      {destination && (
        <DestinationMarker
          latitude={destination.latitude}
          longitude={destination.longitude}
        />
      )}
      {route && <RoutePolyline points={route} />}
      <ClickToSetDestination onMapClick={onMapClick} />
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
