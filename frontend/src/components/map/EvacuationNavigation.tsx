"use client";
import { useEffect, useState } from "react";
import { DomEvent } from "leaflet";
import { Compass, LocateFixed, Navigation, Square, CheckCircle } from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";
import { useEvacuationNavigation } from "@/hooks/useEvacuationNavigation";
import type { GeolocationState } from "@/hooks/useGeolocation";
import type { EvacuationCenter, LatLng, RouteResponse } from "@/services/api";
import { estimatedTravelTime, type TravelMode } from "@/lib/travelTime";
import { NavigationCamera } from "./NavigationCamera";
import { NavigationLocation } from "./NavigationLocation";
import { RoutePolyline } from "./RoutePolyline";
import { UserLocationMarker } from "./UserLocationMarker";

export function EvacuationNavigation({ route, center, mode, geolocation, onRoute, onActiveChange, onStart }: {
  route: LatLng[] | null; center?: EvacuationCenter; mode: TravelMode; geolocation: GeolocationState;
  onRoute: (data: RouteResponse) => void; onActiveChange: (active: boolean) => void; onStart: () => void;
}) {
  const { t } = useLanguage();
  const nav = useEvacuationNavigation({ route, center, mode, geolocation, onRoute });
  const [headingUp, setHeadingUp] = useState(true);
  const [following, setFollowing] = useState(true);
  const [recenter, setRecenter] = useState(0);
  useEffect(() => { onActiveChange(nav.active); }, [nav.active, onActiveChange]);
  const validRoute = !!center && !!route && route.length >= 2;
  return <>
    {nav.active && nav.position ? <NavigationLocation position={nav.position} heading={nav.heading} />
      : geolocation.status === "active" && geolocation.position && <UserLocationMarker {...geolocation.position} />}
    {nav.remainingPoints && <RoutePolyline points={nav.remainingPoints} navigating={nav.active} />}
    <NavigationCamera active={nav.active} position={nav.position} heading={nav.heading} headingUp={headingUp}
      fresh={nav.fresh} near={nav.near && !nav.offRoute} lookAhead={nav.offRoute ? null : nav.lookAhead} recenter={recenter} onFollowing={setFollowing} />
    {(validRoute || nav.arrived) && <div className="leaflet-bottom leaflet-left navigation-controls" ref={element => { if (element) { DomEvent.disableClickPropagation(element); DomEvent.disableScrollPropagation(element); } }}>
      <section className={`leaflet-control navigation-card${nav.active ? " is-active" : ""}`} aria-label={t("Evacuation navigation")}>
        {nav.arrived ? <><p role="status"><CheckCircle size={18} />{t("You have arrived at the evacuation center.")}</p><button type="button" onClick={nav.dismissArrival}>{t("Dismiss")}</button></>
          : !nav.active ? <><button type="button" className="primary-button" disabled={!nav.canStart} onClick={() => { nav.start(); onStart(); }}><Navigation size={18} />{t("Start Navigation")}</button>
            {!nav.canStart && <small>{t("A fresh, accurate location and an available center are needed to start.")}</small>}</>
          : <>
            <div className="navigation-progress"><strong>{nav.remaining < 1000 ? `${Math.round(nav.remaining)} m` : `${(nav.remaining / 1000).toFixed(1)} km`}</strong><span>{t("Estimated time")}: {estimatedTravelTime(nav.remaining, mode)}</span></div>
            <small>{center?.name}</small>
            <p className="navigation-status" role="status">{t(!nav.fresh ? "Waiting for a fresh, accurate GPS location."
              : nav.rerouting ? "Updating your route…" : nav.routeError ? "Could not update the route. Follow local guidance; retrying when location updates."
              : nav.offRoute ? "You are away from the planned route." : !following ? "Map moved manually. Recenter to follow again."
              : nav.near ? "Approaching the evacuation center." : nav.bend !== null ? "Bend ahead — follow the highlighted path." : "Following your location")}</p>
            {nav.heading === null && <small>{t("Compass unavailable. North-up until a movement direction is available.")}</small>}
            {nav.headingSource === "movement" && <small>{t("Using GPS movement direction; phone compass is unavailable.")}</small>}
            <div className="navigation-buttons">
              <button type="button" onClick={() => setRecenter(value => value + 1)}><LocateFixed size={17} />{t("Recenter Navigation")}</button>
              <button type="button" aria-pressed={headingUp} onClick={() => { if (!headingUp) void nav.compass.request(); setHeadingUp(value => !value); }}><Compass size={17} />{t(headingUp ? "Heading up" : "North up")}</button>
              <button type="button" onClick={nav.stop}><Square size={16} />{t("Stop Navigation")}</button>
            </div>
          </>}
      </section>
    </div>}
  </>;
}
