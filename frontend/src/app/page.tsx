"use client";
import { useLanguage, LanguageProvider, LanguageToggle } from "@/components/LanguageProvider";
import { LocationRecovery } from "@/components/LocationRecovery";
import { ShelterSupplies } from "@/components/map/ShelterSupplies";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { MapPin, WifiOff, Map as MapIcon, Building2, ShieldAlert, ArrowRight, Users, X, Phone } from "lucide-react";
import { FloodIcon as Droplet, FireIcon as Flame, EarthquakeIcon as Activity } from "@/components/ui/HazardIcons";
import { Brand } from "@/components/ui/Brand";
import { MobileNavigation } from "@/components/ui/MobileNavigation";
import { EmergencyContact } from "@/components/ui/EmergencyContact";
import { AssistancePrompt } from "@/components/map/AssistancePrompt";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { MapLegend } from "@/components/map/MapLegend";
import { PlaceSearch } from "@/components/map/PlaceSearch";
import type { PlaceResult } from "@/lib/placeSearch";
import { RouteDetails } from "@/components/map/RouteDetails";
import { RouteSheet, type SheetState } from "@/components/map/RouteSheet";
import { estimatedTravelTime, TRAVEL_MODES, type TravelMode } from "@/lib/travelTime";
import { TravelModeSelector } from "@/components/map/TravelModeSelector";
import { useDestinationLabel } from "@/hooks/useDestinationLabel";
import type { DestinationLabel } from "@/lib/reverseGeocoding";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { readRouteSelection, saveRouteSelection, clearRouteSelection } from "@/lib/routeSession";
import { prepareOfflineRouting, getOfflinePackage, type OfflineStatus } from "@/lib/offline/routing";
import { fetchWithCache } from "@/lib/offline/sync";
import {
  cacheEvacuationCenters,
  getCachedEvacuationCenters,
  cacheFloodReports,
  getCachedFloodReports,
  cacheFireIncidents,
  getCachedFireIncidents,
  cacheEarthquakeEvents,
  getCachedEarthquakeEvents,
  cacheEarthquakeRoadImpacts,
  getCachedEarthquakeRoadImpacts,
} from "@/lib/offline/cache";
import {
  fetchRoute,
  RoutingError,
  type AssistanceContext,
  fetchEvacuationCenters,
  fetchEvacuationRoute,
  fetchFloodReports,
  fetchFireIncidents,
  fetchEarthquakes,
  type RouteResponse,
  type EvacuationCenter,
  type EvacuationRouteResponse,
  type FloodReport,
  type FireIncident,
  type EarthquakeEvent,
  type EarthquakeRoadImpact,
} from "@/services/api";

const Map = dynamic(async () => {
  const { loadMapRotation } = await import("@/lib/loadMapRotation");
  await loadMapRotation();
  return import("@/components/map/Map");
}, {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-slate-100 text-sm text-slate-500">
      Loading map…
    </div>
  ),
});

function timeAgo(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  return `${Math.round(hours / 24)} day(s) ago`;
}

type ActiveResult =
  | { kind: "route"; data: RouteResponse }
  | { kind: "evacuation"; data: EvacuationRouteResponse }
  | null;

export default function Home() {
  return <LanguageProvider><PublicHome /></LanguageProvider>;
}

function PublicHome() {
  const { t } = useLanguage();
  const [panel, setPanel] = useState<"map" | "centers" | "hazards">("map");
  const [sheetState, setSheetState] = useState<SheetState>("collapsed");
  const [travelMode, setTravelMode] = useState<TravelMode>("walking");
  const [selectedCenter, setSelectedCenter] = useState<EvacuationCenter | null>(null);
  const [searchSelection, setSearchSelection] = useState<PlaceResult | null>(null);
  const geolocation = useGeolocation();
  const isOnline = useOnlineStatus();
  const [offlineStatus, setOfflineStatus] = useState<OfflineStatus>({ state: "checking" });
  const [offlineRetry, setOfflineRetry] = useState(0);
  const canRoute = isOnline || offlineStatus.state === "ready";
  useEffect(() => {
    let cancelled = false;
    const update = (status: OfflineStatus) => { if (!cancelled) setOfflineStatus(status); };
    void prepareOfflineRouting(isOnline, offlineRetry > 0, update).then(update);
    return () => { cancelled = true; };
  }, [isOnline, offlineRetry]);

  const [destination, setDestination] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [centers, setCenters] = useState<EvacuationCenter[]>([]);
  useEffect(() => {
    if (isOnline || offlineStatus.state !== "ready") return;
    let cancelled = false;
    void getOfflinePackage().then(data => { if (!cancelled && data) setCenters(data.snapshot.centers); });
    return () => { cancelled = true; };
  }, [isOnline, offlineStatus]);

  const [floodReports, setFloodReports] = useState<FloodReport[]>([]);
  const [fireIncidents, setFireIncidents] = useState<FireIncident[]>([]);
  const [earthquakeEvents, setEarthquakeEvents] = useState<EarthquakeEvent[]>([]);
  const [earthquakeRoadImpacts, setEarthquakeRoadImpacts] = useState<EarthquakeRoadImpact[]>([]);
  const [result, setResult] = useState<ActiveResult>(null);
  const [error, setError] = useState<string | null>(null);
  const [assistanceContext, setAssistanceContext] = useState<AssistanceContext | null>(null);
  const [loading, setLoading] = useState<"route" | "evacuation" | null>(null);
  const routeVersion = useRef(0);
  const routeIntent = useRef<"route" | "evacuation" | null>(null);
  const [resultMode, setResultMode] = useState<TravelMode>("walking");
  const restoredOnce = useRef(false);
  const pendingRestore = useRef<"route" | "evacuation" | null>(null);
  const [restoring, setRestoring] = useState(false);
  useEffect(() => () => { routeVersion.current += 1; }, []);

  function cancelRestore() {
    pendingRestore.current = null;
    setRestoring(false);
  }

  useEffect(() => {
    // Read only after hydration; Strict Mode must not restore twice.
    if (restoredOnce.current) return;
    restoredOnce.current = true;
    const saved = readRouteSelection();
    if (!saved) return;
    setDestination(saved.destination);
    setTravelMode(saved.travelMode);
    routeIntent.current = saved.intent;
    pendingRestore.current = saved.intent;
    setRestoring(saved.intent !== null);
    if (saved.destination || saved.intent) setSheetState("partial");
  }, []);

  function clearDestination() {
    cancelRestore();
    clearRouteSelection();
    routeIntent.current = null;
    setSearchSelection(null);
    // Ignore pending responses after removing their destination.
    routeVersion.current += 1;
    setDestination(null);
    setResult(null);
    setSelectedCenter(null);
    setError(null);
    setLoading(null);
  }
  // Oldest of the four data sources' timestamps — the most conservative
  // "as of" claim to show, and whether ANY of them came from cache rather
  // than a live fetch just now.
  const [dataAsOf, setDataAsOf] = useState<string | null>(null);
  const [usingCachedData, setUsingCachedData] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const timestamps: string[] = [];
    let anyFromCache = false;

    function record(result: { source: "live" | "cache"; cachedAt: string | null }) {
      if (result.source === "cache") anyFromCache = true;
      if (result.cachedAt) timestamps.push(result.cachedAt);
    }

    async function loadAll() {
      const [centersResult, floodResult, fireResult, earthquakeResult] = await Promise.allSettled([
        fetchWithCache(fetchEvacuationCenters, getCachedEvacuationCenters, cacheEvacuationCenters),
        fetchWithCache(fetchFloodReports, getCachedFloodReports, cacheFloodReports),
        fetchWithCache(fetchFireIncidents, getCachedFireIncidents, cacheFireIncidents),
        fetchWithCache(
          () => fetchEarthquakes().then((r) => r.events),
          getCachedEarthquakeEvents,
          cacheEarthquakeEvents
        ),
      ]);

      if (cancelled) return;

      if (centersResult.status === "fulfilled") {
        setCenters(centersResult.value.data);
        record(centersResult.value);
      }
      if (floodResult.status === "fulfilled") {
        setFloodReports(floodResult.value.data);
        record(floodResult.value);
      }
      if (fireResult.status === "fulfilled") {
        setFireIncidents(fireResult.value.data);
        record(fireResult.value);
      }
      if (earthquakeResult.status === "fulfilled") {
        setEarthquakeEvents(earthquakeResult.value.data);
        record(earthquakeResult.value);
      }

      // Road impacts are small and only meaningful alongside events, so
      // they piggyback on the network's success/failure rather than
      // getting their own online/offline banner accounting.
      try {
        const { roadImpacts } = await fetchEarthquakes();
        if (!cancelled) {
          setEarthquakeRoadImpacts(roadImpacts);
          cacheEarthquakeRoadImpacts(roadImpacts).catch(() => {});
        }
      } catch {
        const cached = await getCachedEarthquakeRoadImpacts().catch(() => null);
        if (!cancelled && cached) setEarthquakeRoadImpacts(cached.data);
      }

      if (!cancelled) {
        setUsingCachedData(anyFromCache);
        if (timestamps.length > 0) {
          setDataAsOf(timestamps.sort()[0]); // oldest — most conservative claim
        }
      }
    }

    loadAll();
    return () => {
      cancelled = true;
    };
  }, []);

  const locationLabel =
    geolocation.status === "active"
      ? t("Location active")
      : geolocation.status === "locating"
      ? t("Finding your location…")
      : geolocation.status === "denied"
      ? t("Location permission denied")
      : geolocation.status === "timeout"
      ? t("Location unavailable")
      : t("Location unavailable");

  const blockedFloodCount = floodReports.filter((r) => r.roadImpassable).length;
  const passableFloodCount = floodReports.length - blockedFloodCount;
  const showOfflineBanner = !isOnline || usingCachedData;

  async function handleFindRoute(mode: TravelMode = travelMode, keepPrevious = false) {
    if (!geolocation.position || !destination) return;
    cancelRestore();
    saveRouteSelection({ destination, travelMode: mode, intent: "route" });
    routeIntent.current = "route";
    const version = ++routeVersion.current;
    setLoading("route");
    setError(null);
    if (!keepPrevious) setResult(null);
    try {
      const data = await fetchRoute(
        {
          latitude: geolocation.position.latitude,
          longitude: geolocation.position.longitude,
        },
        destination,
        mode
      );
      if (version === routeVersion.current) { setResult({ kind: "route", data }); setResultMode(mode); }
    } catch (err) {
      if (version === routeVersion.current) {
        setSheetState("partial");
        setResult(null); setError(err instanceof Error ? err.message : "Could not calculate a route.");
        setAssistanceContext(err instanceof RoutingError && err.failureReason === "HAZARD_BLOCKED"
          ? { kind: "route", travelMode: mode, destination } : null);
      }
    } finally {
      if (version === routeVersion.current) setLoading(null);
    }
  }

  async function handleFindEvacuationCenter(mode: TravelMode = travelMode, keepPrevious = false) {
    if (!geolocation.position) return;
    cancelRestore();
    saveRouteSelection({ destination: null, travelMode: mode, intent: "evacuation" });
    routeIntent.current = "evacuation";
    const version = ++routeVersion.current;
    setLoading("evacuation");
    setError(null);
    if (!keepPrevious) setResult(null);
    try {
      const data = await fetchEvacuationRoute({
        latitude: geolocation.position.latitude,
        longitude: geolocation.position.longitude,
      }, mode);
      if (version === routeVersion.current) {
        setResult({ kind: "evacuation", data }); setResultMode(mode);
        setDestination({ latitude: data.recommendedCenter.latitude, longitude: data.recommendedCenter.longitude });
        saveRouteSelection({ destination: { latitude: data.recommendedCenter.latitude, longitude: data.recommendedCenter.longitude }, travelMode: mode, intent: "evacuation" });
      }
    } catch (err) {
      if (version === routeVersion.current) { setSheetState("partial"); setResult(null); setError(
        err instanceof Error ? err.message : "Could not find an evacuation center."
      );
        setAssistanceContext(err instanceof RoutingError && err.failureReason === "HAZARD_BLOCKED"
          ? { kind: "evacuation", travelMode: mode } : null);
      }
    } finally {
      if (version === routeVersion.current) setLoading(null);
    }
  }

  // Deliberately inspect current render state each time. Consuming the ref
  // synchronously prevents repeated calculations as GPS fixes arrive.
  useEffect(() => {
    const intent = pendingRestore.current;
    if (!intent || !restoring || !canRoute || geolocation.status !== "active" || !geolocation.position) return;
    if (intent === "route" && !destination) return;
    pendingRestore.current = null;
    if (intent === "evacuation") void handleFindEvacuationCenter();
    else void handleFindRoute();
  });

  const activeRoutePoints =
    result && resultMode === travelMode ? result.data.route : null;

  const routingDisabledReason = !canRoute
    ? t("Connect once to download offline routing data.")
    : null;

  const recommendedCenter = result?.kind === "evacuation" ? result.data.recommendedCenter : undefined;
  const lookedUpDestination = useDestinationLabel(destination, centers, isOnline && !recommendedCenter && !searchSelection);
  const destinationName = searchSelection ? { label: searchSelection.label, loading: false } : lookedUpDestination;
  const routeCenter = recommendedCenter ?? centers.find(center => destination &&
    center.latitude === destination.latitude && center.longitude === destination.longitude);
  const routeLabel: DestinationLabel | null = recommendedCenter
    ? { title: recommendedCenter.name, subtitle: recommendedCenter.address || recommendedCenter.barangayName, source: "center" }
    : destinationName.label;
  const sheetTitle = panel === "hazards" ? t("Hazard information")
    : panel === "centers" ? selectedCenter?.name ?? t("Evacuation centers")
    : routeLabel?.title ?? t("Plan your route");
  const travelTime = result ? estimatedTravelTime(result.data.distance, resultMode) : null;
  const sheetSummary = loading ? t("Calculating your route…") : error ? t("Unable to calculate a route.")
    : panel === "map" && result
    ? `${result.data.source === "offline" ? t("Offline route") + " · " : ""}${(result.data.distance / 1000).toFixed(1)} km${travelTime ? ` · ${travelTime}` : ""} · ${t("Route risk")}: ${t((result.data.riskLevel ?? "UNKNOWN").replaceAll("_", " "))}`
    : panel === "map" ? `${t(TRAVEL_MODES[travelMode].label)} · ${t("Tap for travel options")}`
    : panel === "centers" ? t("Capacity, supplies and contact details") : t("Reported conditions and verified road impacts.");

  const displayedCenter = selectedCenter ?? (result?.kind === "evacuation" ? result.data.recommendedCenter : null);
  const emergencyContactProps = {
    position: geolocation.position,
    routingUnavailable: !geolocation.position ? t("Enable location access to find a route") : !canRoute ? t("Connect once to download offline routing data.") : loading ? t("Route calculation in progress") : null,
    onFindCenter: () => {
      setSelectedCenter(null);
      setPanel("map");
      setSheetState("partial");
      void handleFindEvacuationCenter();
    },
  };
  const choosePanel = (value: "map" | "centers" | "hazards") => {
    setPanel(value);
    setSheetState(value === "map" ? "collapsed" : "partial");
  };

  const routeButtons = <>
            <button type="button" className="primary-button" disabled={!destination || !geolocation.position || loading !== null || !canRoute} onClick={() => { setPanel("map"); setSheetState("collapsed"); handleFindRoute(); }}>
              {loading === "route" ? t("Calculating…") : t("Find safer route")}<ArrowRight size={18} />
            </button>
            <button type="button" className="secondary-button" disabled={!geolocation.position || loading !== null || !canRoute} onClick={() => { setSelectedCenter(null); setPanel("map"); setSheetState("collapsed"); handleFindEvacuationCenter(); }}>
              <Building2 size={18} />{loading === "evacuation" ? t("Searching…") : t("Find evacuation center")}
            </button>
  </>;
  const hazardOverview = (
          <div className="hazard-strip">
            <button onClick={() => choosePanel("hazards")}><Droplet className="flood-color" size={24} /><span><strong>{t("Flood")}</strong><small>{t("{count} reports · {blocked} blocked", { count: floodReports.length, blocked: blockedFloodCount })}</small></span></button>
            <button onClick={() => choosePanel("hazards")}><Flame className="fire-color" size={24} /><span><strong>{t("Fire")}</strong><small>{t("{count} incidents loaded", { count: fireIncidents.length })}</small></span></button>
            <button onClick={() => choosePanel("hazards")}><Activity className="earthquake-color" size={24} /><span><strong>{t("Earthquake")}</strong><small>{t("{count} events loaded", { count: earthquakeEvents.length })}</small></span></button>
          </div>
  );

  return (
    <main className={`public-app public-view-${panel}`}>
      <header className="app-header">
        <h1><Brand /></h1>
        <p className="brand-promise">{t("Safe routes. Safe shelters.")}<br /><strong>{t("A safer Santa Rosa.")}</strong></p>
        <span className="city-label"><MapPin size={16} /> Santa Rosa, Laguna</span>
        <Link href="/admin/login" className="admin-link">{t("Admin sign in")}<ArrowRight size={15} /></Link>
        <LanguageToggle />
        <MobileNavigation activeSection={panel} onSelect={choosePanel} />
        <EmergencyContact {...emergencyContactProps} />
      </header>
      {showOfflineBanner && (
        <div className="offline-banner" role="status"><WifiOff size={17} />
          <span>{t("Offline / cached data")}{dataAsOf && ` · updated ${timeAgo(dataAsOf)}`}. {t("Hazard information may be outdated.")}</span>
        </div>
      )}
      <div className="offline-readiness" role="status">
        <span className="offline-readiness-copy"><strong>{offlineStatus.state === "ready"
          ? t(process.env.NODE_ENV !== "production" ? "Offline ready for this session"
            : offlineStatus.mapReady ? "Offline maps and routes ready" : "Offline routes ready")
          : offlineStatus.state === "downloading" || offlineStatus.state === "checking"
          ? t("Preparing offline routing… Keep the app open.")
          : t("Offline routing is not ready.")}</strong>
          {offlineStatus.updatedAt && <small title={new Date(offlineStatus.updatedAt).toLocaleString()}>{t("Saved {time}", { time: timeAgo(offlineStatus.updatedAt) })}</small>}
          {offlineStatus.message && <span>{t(offlineStatus.message)}</span>}
        </span>
        {isOnline && offlineStatus.state !== "downloading" && offlineStatus.state !== "checking" &&
          <button type="button" onClick={() => setOfflineRetry(value => value + 1)}>{t(offlineStatus.state === "ready" ? "Update offline data" : "Retry download")}</button>}
      </div>
      <LocationRecovery location={geolocation} onRetry={geolocation.retry} />
      <div className="public-workspace">
        <nav className="navigation-rail" aria-label={t("Map views")}>
          <button onClick={() => choosePanel("map")} aria-pressed={panel === "map"}><MapIcon size={23} /><span>{t("Map")}</span></button>
          <button onClick={() => choosePanel("centers")} aria-pressed={panel === "centers"}><Building2 size={23} /><span>{t("Evacuation centers")}</span></button>
          <button onClick={() => choosePanel("hazards")} aria-pressed={panel === "hazards"}><ShieldAlert size={23} /><span>{t("Hazard information")}</span></button>
          <div className="rail-caption">EVACUROSA<br />CITY NAVIGATION</div>
        </nav>
        <section className="map-workspace" aria-label={t("Santa Rosa evacuation map")}>
          <PlaceSearch centers={centers} online={isOnline} onSelect={place => {
            cancelRestore();
            saveRouteSelection({ destination: { latitude: place.latitude, longitude: place.longitude }, travelMode, intent: null });
            routeIntent.current = null;
            routeVersion.current += 1;
            setLoading(null);
            setResult(null);
            setError(null);
            setSelectedCenter(null);
            setDestination({ latitude: place.latitude, longitude: place.longitude });
            setSearchSelection({ ...place });
            setPanel("map");
            setSheetState("collapsed");
          }} />
          <div className="desktop-hazard-overview">{hazardOverview}</div>
          <div className="map-canvas">
            <Map
              navigationCenter={routeCenter}
              travelMode={travelMode}
              onNavigationRoute={data => { setResult({ kind: "route", data }); setResultMode(travelMode); }}
              onNavigationStart={() => { setPanel("map"); setSheetState("collapsed"); }}
              offlineReady={offlineStatus.state === "ready"}
              geolocation={geolocation}
              onRetryLocation={geolocation.retry}
              destination={destination}
              destinationLabel={destinationName.label?.title}
              searchFocus={searchSelection}
              onClearDestination={clearDestination}
              route={activeRoutePoints}
              centers={centers}
              floodReports={floodReports}
              fireIncidents={fireIncidents}
              earthquakeEvents={earthquakeEvents}
              earthquakeRoadImpacts={earthquakeRoadImpacts}
              onSelectCenter={(center) => { setSelectedCenter(center); setPanel("centers"); setSheetState("partial"); }}
              onMapClick={(latitude, longitude) => {
                cancelRestore();
                saveRouteSelection({ destination: { latitude, longitude }, travelMode, intent: null });
                routeIntent.current = null;
                setSearchSelection(null);
                routeVersion.current += 1;
                setLoading(null);
                setDestination({ latitude, longitude });
                setResult(null);
                setError(null);
                setPanel("map");
                setSheetState("collapsed");
              }}
            />
            <div className="map-location-status"><span className={geolocation.status === "active" ? "live-dot" : "inactive-dot"} />{locationLabel}</div>
            <div className="map-secondary-controls">
              <EmergencyContact placement="floating" {...emergencyContactProps} />
              <MapLegend />
            </div>
          </div>
        </section>
        <RouteSheet state={sheetState} onChange={setSheetState} title={sheetTitle} summary={sheetSummary} hideDetails={panel === "map" && !!error} onClearDestination={destination || restoring || result ? clearDestination : undefined} mobileActions={
          <>
            {routeButtons}
            <p className="mobile-routing-hint" role="status">{routingDisabledReason ?? (!geolocation.position ? locationLabel : !destination ? t("Tap the map to set your destination.") : t(TRAVEL_MODES[travelMode].label))}</p>
          </>
        } actions={
          <>
          <div className={`route-actions${destination ? " has-destination" : ""}${error ? " has-route-error" : ""}`}>
            {restoring && <p role="status">{!canRoute
              ? t("Saved selection restored. Connect to the internet to recalculate.")
              : t("Saved selection restored. Waiting for location access to recalculate.")}</p>}
            {error && <section className="route-emergency-help" aria-label={t("Emergency assistance")}>
              <p className="error-message" role="alert">{error.startsWith("No ") ? t("No route found for {mode}.", { mode: t(TRAVEL_MODES[travelMode].label) }) : t("Unable to calculate a route.")}</p>
              {assistanceContext && <AssistancePrompt key={routeVersion.current} context={assistanceContext} />}
              <button type="button" className="emergency-contact-button" disabled aria-describedby="emergency-contact-pending">
                <Phone size={18} aria-hidden="true" />{t("Emergency contact")}</button>
              <p id="emergency-contact-pending">{t("CDRRMO number pending verification. Calling unavailable.")}</p>
              <details className="route-failure-details"><summary>{t("Details")}</summary><p>{error}</p></details>
            </section>}
            <TravelModeSelector value={travelMode} onChange={mode => {
              if (mode === travelMode) return;
              const resumeWhenReady = pendingRestore.current;
              saveRouteSelection({ destination, travelMode: mode, intent: routeIntent.current });
              routeVersion.current += 1;
              setTravelMode(mode);
              setAssistanceContext(null);
              setLoading(null);
              setError(null);
              if (resumeWhenReady) {
                // Keep waiting for a fresh location/connection, using the new mode.
                return;
              }
              if (routeIntent.current && (!canRoute || !geolocation.position)) {
                setResult(null);
                setError(!canRoute ? t("Connect once to download offline routing data.") : t("Enable location access to recalculate for this travel mode."));
              } else if (routeIntent.current === "evacuation") {
                void handleFindEvacuationCenter(mode, true);
              } else if (routeIntent.current === "route") {
                void handleFindRoute(mode, true);
              }
            }} />
            {routingDisabledReason && <p>{routingDisabledReason}</p>}
            {!destination && !result && <p>{t("Tap the map to set your destination.")}</p>}
            {destinationName.loading && !recommendedCenter && <p role="status">{t("Finding place name…")}</p>}
            <div className="desktop-route-buttons">{routeButtons}</div>
            {!geolocation.position && <p className="location-help">{locationLabel}. {t("Enable location access to calculate a route.")}</p>}
          </div>
          {panel === "hazards" && <Link href="/admin/login" className="mobile-staff-access">{t("Staff access · Admin sign in")}</Link>}
          </>
        }>
            <div className="mobile-hazard-overview">{hazardOverview}</div>
            {loading && <p role="status" className="route-update-status">{t("Updating route for {mode}…", { mode: t(TRAVEL_MODES[travelMode].label) })}{result ? " " + t("Previous route details shown below until calculation finishes.") : ""}</p>}
            {panel === "map" && result && <RouteDetails result={result} label={routeLabel} center={routeCenter} travelMode={resultMode} hideHeading />}
            {panel === "map" && !result && !error && routeLabel && (
              <section className="destination-heading">
                {routeLabel.subtitle && <p>{routeLabel.subtitle}</p>}
              </section>
            )}
            <div className={`panel-heading ${panel === "map" && (result || destination) ? "route-intro" : ""}`}><span className="eyebrow">SANTA ROSA · LAGUNA</span><h2>{panel === "hazards" ? t("Hazard information") : panel === "centers" ? t("Evacuation centers") : result ? t("Your route") : t("Find your way to safety")}</h2>
              <p>{panel === "hazards" ? t("Reported conditions and verified road impacts.") : panel === "centers" ? t("Choose a center to review capacity, supplies, and location.") : t("Choose a point on the map or find a recommended evacuation center.")}</p>
            </div>
            {panel === "map" && !destination && !result && !error && <div className="route-onboarding">
              <span className="route-onboarding-icon"><MapPin size={22} aria-hidden="true" /></span>
              <div><strong>{t("Where do you need to go?")}</strong><p>{t("Search above or tap the map. No destination? Find an evacuation center below.")}</p></div>
            </div>}
            {panel === "hazards" && (
              <section className="hazard-details">
                <div className="info-notice">{t("Loaded reports are not an all-clear. Conditions can change; follow local emergency guidance.")}</div>
                <h3><Droplet size={18} /> {t("Flood reports")}</h3>
                <p>{t("{blocked} blocked road reports · {passable} passable flood reports", { blocked: blockedFloodCount, passable: passableFloodCount })}</p>
                {floodReports.map(report => <article className="record-card" key={report.id}><strong>{t(report.severity)} {t("Flood")}</strong><span>{report.roadImpassable ? t("Road blocked") : t("Road passable")} · {report.roadId}</span>{report.notes && <p>{report.notes}</p>}</article>)}
                <h3><Flame size={18} /> {t("Fire incidents")}</h3>
                {fireIncidents.length === 0 && <p>{t("No fire incidents loaded.")}</p>}
                {fireIncidents.map(incident => <article className="record-card" key={incident.id}><strong>{t(incident.severity)} {t("Fire")}</strong><span>{incident.radiusMeters} m radius · {incident.confirmedBlockedRoadIds.length} {t("confirmed blocked roads")}</span>{incident.notes && <p>{incident.notes}</p>}</article>)}
                <h3><Activity size={18} /> {t("Earthquake events")}</h3>
                {earthquakeEvents.length === 0 && <p>{t("No earthquake events loaded.")}</p>}
                {earthquakeEvents.map(event => <article className="record-card" key={event.id}><strong>M{event.magnitude.toFixed(1)} · {event.status}</strong><span>{earthquakeRoadImpacts.filter(impact => impact.earthquakeEventId === event.id).length} {t("verified road impacts")}</span><span>{new Date(event.occurredAt).toLocaleString()}</span></article>)}
              </section>
            )}
            {displayedCenter && panel === "centers" && (
              <section className="selected-center">
                <div className="section-title"><span className="eyebrow">{!selectedCenter && result?.kind === "evacuation" ? t("RECOMMENDED CENTER") : t("SELECTED CENTER")}</span>{selectedCenter && <button className="icon-button" aria-label={t("Close center details")} onClick={() => setSelectedCenter(null)}><X size={18} /></button>}</div>
                <div className="shelter-symbol"><Building2 size={30} /></div>
                <h3>{displayedCenter.name}</h3>
                <p>{displayedCenter.address}</p>
                <StatusBadge status={displayedCenter.status} />
                <div className="center-occupancy"><Users size={20} /><span><strong>{displayedCenter.currentOccupancy} / {displayedCenter.capacity}</strong><small>{t("Current occupancy")}</small></span></div>
                {displayedCenter.contactInformation && <p>{displayedCenter.contactInformation}</p>}
                <ShelterSupplies center={displayedCenter} />
                {displayedCenter.notes && <p>{displayedCenter.notes}</p>}
                <button type="button" className="secondary-button center-route-button" disabled={displayedCenter.status === "CLOSED" || displayedCenter.status === "FULL"} onClick={() => {
                  cancelRestore();
                  const point = { latitude: displayedCenter.latitude, longitude: displayedCenter.longitude };
                  saveRouteSelection({ destination: point, travelMode, intent: null });
                  routeVersion.current += 1;
                  routeIntent.current = null;
                  setDestination(point);
                  setSearchSelection({ id: `center-${displayedCenter.id}`, ...point, label: { title: displayedCenter.name, subtitle: displayedCenter.address, source: "center" } });
                  setResult(null); setError(null); setAssistanceContext(null); setLoading(null);
                  setPanel("map"); setSheetState("partial");
                }}><MapPin size={18} aria-hidden="true" />{t("Use as destination")}</button>
                {(displayedCenter.status === "CLOSED" || displayedCenter.status === "FULL") && <p>{t("This center is not accepting arrivals. Choose another center.")}</p>}
              </section>
            )}
            {panel === "centers" && (
              <section className="center-list"><h3>{t("Evacuation centers")}<span>{centers.length}</span></h3>
                {centers.length === 0 && <p className="empty-message">{t("No evacuation centers loaded.")}</p>}
                {centers.map(center => <button className="center-list-item" key={center.id} onClick={() => setSelectedCenter(center)} aria-pressed={selectedCenter?.id === center.id}><Building2 size={23} /><span><strong>{center.name}</strong><small>{center.currentOccupancy} / {center.capacity} {t("occupied")}</small><StatusBadge status={center.status} /></span><ArrowRight size={16} /></button>)}
              </section>
            )}
            {panel !== "map" && result && <details className="other-route"><summary>{t("Active route")}</summary><RouteDetails result={result} label={routeLabel} center={routeCenter} travelMode={resultMode} /></details>}
            {!(panel === "map" && error) && <details className="route-failure-details"><summary>{t("About this data")}</summary>
              {routeLabel?.source === "photon" && <p className="geocoder-credit">Approximate place name · <a href="https://photon.komoot.io" target="_blank" rel="noreferrer">Photon</a> / <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a></p>}
              <p>{t("Roads and routing are saved automatically while online. Offline routes use the last saved hazard and center data.")}</p>
              {offlineStatus.updatedAt && <p>{t("Saved data")}: {new Date(offlineStatus.updatedAt).toLocaleString()}</p>}
              {process.env.NODE_ENV !== "production" && <p>{t("Development mode: keep this page open. Offline reload requires a production build.")}</p>}
            </details>}
        </RouteSheet>
      </div>
    </main>
  );
}
