"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GeolocationState } from "./useGeolocation";
import { useNavigationHeading } from "./useNavigationHeading";
import { fetchRoute, type EvacuationCenter, type LatLng, type RouteResponse } from "@/services/api";
import { bearing, matchRoute, meters, plausibleFix, pointAlong, remainingRoute, routeLengths, upcomingBend, usableFix, type NavigationFix } from "@/lib/navigation";
import type { TravelMode } from "@/lib/travelTime";

const maxSpeed = { walking: 4, biking: 15, motorcycle: 40, car: 40 };
export function useEvacuationNavigation({ route, center, mode, geolocation, onRoute }: {
  route: LatLng[] | null; center?: EvacuationCenter; mode: TravelMode; geolocation: GeolocationState;
  onRoute: (route: RouteResponse) => void;
}) {
  const [active, setActive] = useState(false);
  const [arrived, setArrived] = useState(false);
  const [now, setNow] = useState(Date.now);
  const [along, setAlong] = useState(0);
  const [position, setPosition] = useState<NavigationFix | null>(null);
  const [course, setCourse] = useState<number | null>(null);
  const [offRoute, setOffRoute] = useState(false);
  const [rerouting, setRerouting] = useState(false);
  const [routeError, setRouteError] = useState(false);
  const [rejected, setRejected] = useState(false);
  const generation = useRef(0);
  const acceptedRoute = useRef<LatLng[] | null>(null);
  const progress = useRef(0);
  const lastFix = useRef<NavigationFix | null>(null);
  const seen = useRef(0);
  const away = useRef(0);
  const arrivalSince = useRef<number | null>(null);
  const retryAfter = useRef(0);
  const pending = useRef(false);
  const compass = useNavigationHeading(active);
  const lengths = useMemo(() => route ? routeLengths(route) : [], [route]);
  const total = lengths[lengths.length - 1] ?? 0;
  const stop = useCallback(() => { generation.current++; pending.current = false; setActive(false); setRerouting(false); }, []);
  useEffect(() => () => { generation.current++; }, []);
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [active]);
  const identity = `${center?.id}:${center?.latitude}:${center?.longitude}:${mode}`;
  const sessionIdentity = useRef("");
  useEffect(() => {
    if ((active || arrived) && (identity !== sessionIdentity.current || route !== acceptedRoute.current)) { stop(); setArrived(false); }
  }, [active, arrived, identity, route, stop]);
  const fix = geolocation.position;
  const fresh = geolocation.status === "active" && usableFix(fix, active ? now : Date.now());
  const canStart = !!center && !!route && route.length >= 2 && fresh && center.status !== "CLOSED" && center.status !== "FULL";
  function start() {
    if (!canStart || !fix) return;
    void compass.request();
    generation.current++; acceptedRoute.current = route; sessionIdentity.current = identity;
    progress.current = 0; lastFix.current = null; seen.current = 0; away.current = 0; arrivalSince.current = null; retryAfter.current = 0; pending.current = false;
    setAlong(0); setPosition(fix); setCourse(null); setOffRoute(false); setRouteError(false); setRejected(false); setRerouting(false); setArrived(false); setNow(Date.now()); setActive(true);
  }
  useEffect(() => {
    if (!active || !route || !center || !fix || !fresh || pending.current || seen.current === fix.timestamp) return;
    seen.current = fix.timestamp;
    if (!plausibleFix(lastFix.current, fix, maxSpeed[mode])) { setRejected(true); return; }
    setRejected(false);
    const previous = lastFix.current;
    const elapsed = previous ? (fix.timestamp - previous.timestamp) / 1000 : 0;
    const match = matchRoute(fix, route, lengths, Math.max(0, progress.current - 15), progress.current + Math.max(65, elapsed * maxSpeed[mode] + 20));
    const deviated = match.distance > Math.max(25, fix.accuracy * 1.5);
    setOffRoute(deviated);
    if (!deviated) setRouteError(false);
    const movement = previous ? meters(previous, fix) : Infinity;
    // Ignore sub-accuracy jitter for both marker and progress, but keep genuine
    // arrivals and heading updates responsive to distinct, fresh fixes.
    if (!previous || movement >= Math.max(2, fix.accuracy * .3)) {
      setPosition(fix); lastFix.current = fix;
      if (typeof fix.heading === "number" && Number.isFinite(fix.heading) && (fix.speed ?? 0) > .5) setCourse(fix.heading);
      else if (previous && movement >= Math.max(5, fix.accuracy)) setCourse(bearing(previous, fix));
      if (!deviated) { progress.current = Math.max(progress.current, match.along); setAlong(progress.current); }
    }
    if (!deviated && fix.accuracy <= 20 && total - progress.current <= 30 && meters(fix, center) <= 20) {
      arrivalSince.current ??= fix.timestamp;
      if (fix.timestamp - arrivalSince.current >= 3000) { stop(); setArrived(true); return; }
    } else arrivalSince.current = null;
    away.current = deviated ? away.current + 1 : 0;
    if (away.current < 3 || Date.now() < retryAfter.current) return;
    const version = generation.current;
    pending.current = true; setRerouting(true); setRouteError(false); retryAfter.current = Date.now() + 30000;
    // Existing API client also supports downloaded offline routing. Always keep
    // the chosen center; a wrong turn must not silently select a different one.
    void fetchRoute(fix, { latitude: center.latitude, longitude: center.longitude }, mode).then(data => {
      if (version !== generation.current) return;
      if (data.route.length < 2) throw new Error("Empty route");
      acceptedRoute.current = data.route; progress.current = 0; lastFix.current = null; seen.current = 0; away.current = 0;
      setAlong(0); setOffRoute(false); onRoute(data);
    }).catch(() => { if (version === generation.current) setRouteError(true); }).finally(() => {
      if (version === generation.current) { pending.current = false; setRerouting(false); }
    });
  }, [active, route, center, mode, fix, fresh, lengths, total, onRoute, stop]);
  const remaining = Math.max(0, total - along);
  const remainingPoints = useMemo(() => route && active ? remainingRoute(route, lengths, along) : route, [route, active, lengths, along]);
  const bend = active && route ? upcomingBend(route, lengths, along) : null;
  const lookAhead = active && route ? pointAlong(route, lengths, Math.min(total, along + (bend === null ? 40 : Math.max(15, bend + 12)))) : null;
  const hasCompass = !!compass.reading && now - compass.reading.at < 3000;
  const heading = hasCompass ? compass.reading!.heading : course;
  const headingSource = hasCompass ? "compass" : course !== null ? "movement" : "none";
  return { active, arrived, start, stop, canStart, position, fresh: fresh && !rejected, remaining, remainingPoints, heading, headingSource, lookAhead, bend,
    near: remaining < 70 && !!position && !!center && meters(position, center) < 85,
    offRoute, rerouting, routeError, compass, dismissArrival: () => setArrived(false) };
}
