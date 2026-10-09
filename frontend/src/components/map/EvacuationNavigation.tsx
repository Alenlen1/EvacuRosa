"use client";
import { useEffect, useState } from "react";
import { DomEvent } from "leaflet";
import { useMap } from "react-leaflet";
import { Compass, LocateFixed, Navigation, Square, CheckCircle, ChevronDown, SlidersHorizontal } from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";
import { useEvacuationNavigation, type NavigationDestination } from "@/hooks/useEvacuationNavigation";
import type { GeolocationState } from "@/hooks/useGeolocation";
import type { LatLng, RouteResponse } from "@/services/api";
import { estimatedTravelTime, type TravelMode } from "@/lib/travelTime";
import { NavigationCamera } from "./NavigationCamera";
import { NavigationLocation } from "./NavigationLocation";
import { RoutePolyline } from "./RoutePolyline";
import { UserLocationMarker } from "./UserLocationMarker";

export function EvacuationNavigation({ route, center, mode, geolocation, onRoute, onActiveChange, onStart }: {
  route: LatLng[] | null; center?: NavigationDestination; mode: TravelMode; geolocation: GeolocationState;
  onRoute: (data: RouteResponse) => void; onActiveChange: (active: boolean) => void; onStart: () => void;
}) {
  const { t } = useLanguage();
  const map = useMap();
  const nav = useEvacuationNavigation({ route, center, mode, geolocation, onRoute });
  const [headingUp, setHeadingUp] = useState(true);
  const [following, setFollowing] = useState(true);
  const [recenter, setRecenter] = useState(0);
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => { onActiveChange(nav.active); }, [nav.active, onActiveChange]);
  useEffect(() => {
    if (!nav.active) return;
    const container = map.getContainer();
    const sheet = container.closest(".public-app")?.querySelector<HTMLElement>(".route-sheet");
    if (!sheet) return;
    // Measure the actual overlap: text wrapping, safe areas, and browser zoom
    // can all make the transport panel taller than its nominal CSS height.
    const update = () => {
      const mapBounds = container.getBoundingClientRect();
      const sheetBounds = sheet.getBoundingClientRect();
      const overlaps = sheetBounds.left < mapBounds.right && sheetBounds.right > mapBounds.left;
      const inset = overlaps ? Math.max(0, mapBounds.bottom - sheetBounds.top) : 0;
      container.style.setProperty("--navigation-panel-inset", `${inset + 12}px`);
    };
    const observer = new ResizeObserver(update);
    observer.observe(sheet, { box: "border-box" });
    observer.observe(container, { box: "border-box" });
    window.addEventListener("resize", update);
    window.visualViewport?.addEventListener("resize", update);
    update();
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("resize", update);
      container.style.removeProperty("--navigation-panel-inset");
    };
  }, [map, nav.active]);
  const validRoute = !!center && !!route && route.length >= 2;
  return <>
    {nav.active && nav.position ? <NavigationLocation position={nav.position} heading={nav.heading} />
      : geolocation.status === "active" && geolocation.position && <UserLocationMarker {...geolocation.position} />}
    {nav.remainingPoints && <RoutePolyline points={nav.remainingPoints} navigating={nav.active} />}
    <NavigationCamera active={nav.active} position={nav.position} heading={nav.heading} headingUp={headingUp}
      fresh={nav.fresh} near={nav.near && !nav.offRoute} lookAhead={nav.offRoute ? null : nav.lookAhead} recenter={recenter} onFollowing={setFollowing} />
    {(validRoute || nav.arrived) && <div className="leaflet-bottom leaflet-left navigation-controls" ref={element => { if (element) { DomEvent.disableClickPropagation(element); DomEvent.disableScrollPropagation(element); } }}>
      <section className={`leaflet-control navigation-card${nav.active ? " is-active" : ""}${collapsed ? " is-collapsed" : ""}`} aria-label={t("Evacuation navigation")}>
        {nav.arrived ? <><p role="status"><CheckCircle size={18} />{t(center?.id ? "You have arrived at the evacuation center." : "You have arrived at your destination.")}</p><button type="button" onClick={nav.dismissArrival}>{t("Dismiss")}</button></>
          : !nav.active ? <><button type="button" className="primary-button" disabled={!nav.canStart} onClick={() => { setCollapsed(window.matchMedia("(max-width: 800px)").matches); nav.start(); onStart(); }}><Navigation size={18} />{t("Start Navigation")}</button>
            {!nav.canStart && <small>{t(center?.id ? "A fresh, accurate location and an available center are needed to start." : "A fresh, accurate location is needed to start.")}</small>}</>
          : <>
            <div className="navigation-quick-actions">
            <button type="button" className="navigation-recenter" aria-label={t("Recenter Navigation")} title={t("Recenter Navigation")} onClick={() => setRecenter(value => value + 1)}><LocateFixed size={18} aria-hidden="true" /></button>
            <button type="button" className="navigation-toggle" aria-label={t(collapsed ? "Show navigation controls" : "Hide navigation controls")} title={t(collapsed ? "Show navigation controls" : "Hide navigation controls")} aria-expanded={!collapsed} aria-controls="navigation-details" onClick={() => setCollapsed(value => !value)}>{collapsed ? <SlidersHorizontal size={18} /> : <ChevronDown size={18} />}<span>{t(collapsed ? "Show navigation controls" : "Hide navigation controls")}</span></button>
            </div>
            {collapsed && <div className="navigation-compact-summary"><strong>{nav.remaining < 1000 ? `${Math.round(nav.remaining)} m` : `${(nav.remaining / 1000).toFixed(1)} km`}</strong><span>{estimatedTravelTime(nav.remaining, mode)}</span></div>}
            {collapsed && (!nav.fresh || nav.offRoute) && <p className="navigation-compact-warning" role="status">{t(!nav.fresh ? "Waiting for a fresh, accurate GPS location." : "You are away from the planned route.")}</p>}
            <div className="navigation-details" id="navigation-details" hidden={collapsed}>
            <div className="navigation-progress"><strong>{nav.remaining < 1000 ? `${Math.round(nav.remaining)} m` : `${(nav.remaining / 1000).toFixed(1)} km`}</strong><span>{t("Estimated time")}: {estimatedTravelTime(nav.remaining, mode)}</span></div>
            <small>{center?.name}</small>
            <p className="navigation-status" role="status">{t(!nav.fresh ? "Waiting for a fresh, accurate GPS location."
              : nav.rerouting ? "Updating your route…" : nav.routeError ? "Could not update the route. Follow local guidance; retrying when location updates."
              : nav.offRoute ? "You are away from the planned route." : !following ? "Map moved manually. Recenter to follow again."
              : nav.near ? (center?.id ? "Approaching the evacuation center." : "Approaching your destination.") : nav.bend !== null ? "Bend ahead — follow the highlighted path." : "Following your location")}</p>
            {nav.heading === null && <small>{t("Compass unavailable. North-up until a movement direction is available.")}</small>}
            {nav.headingSource === "movement" && <small>{t("Using GPS movement direction; phone compass is unavailable.")}</small>}
            <div className="navigation-buttons">
              <button type="button" aria-pressed={headingUp} onClick={() => { if (!headingUp) void nav.compass.request(); setHeadingUp(value => !value); }}><Compass size={17} />{t(headingUp ? "Heading up" : "North up")}</button>
              <button type="button" onClick={nav.stop}><Square size={16} />{t("Stop Navigation")}</button>
            </div>
            </div>
          </>}
      </section>
    </div>}
  </>;
}
