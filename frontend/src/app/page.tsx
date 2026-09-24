"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState } from "react";
import { MapPin, Droplet, Flame, WifiOff, Activity, Map as MapIcon, Building2, ShieldAlert, ArrowRight, ChevronDown, ChevronUp, Users, Route, Clock, X } from "lucide-react";
import { Brand } from "@/components/ui/Brand";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { MapLegend } from "@/components/map/MapLegend";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
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

const Map = dynamic(() => import("@/components/map/Map"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-slate-100 text-sm text-slate-500">
      Loading map…
    </div>
  ),
});

const riskColor: Record<string, string> = {
  VERY_LOW: "text-green-700",
  LOW: "text-green-700",
  MODERATE: "text-amber-700",
  HIGH: "text-red-700",
  VERY_HIGH: "text-red-700",
};

function riskLabel(level: string | null) {
  if (!level) return "risk unknown";
  return level.replace("_", " ").toLowerCase() + " risk";
}

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
  const [panel, setPanel] = useState<"map" | "centers" | "hazards">("map");
  const [expanded, setExpanded] = useState(false);
  const [selectedCenter, setSelectedCenter] = useState<EvacuationCenter | null>(null);
  const geolocation = useGeolocation();
  const isOnline = useOnlineStatus();
  const [destination, setDestination] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [centers, setCenters] = useState<EvacuationCenter[]>([]);
  const [floodReports, setFloodReports] = useState<FloodReport[]>([]);
  const [fireIncidents, setFireIncidents] = useState<FireIncident[]>([]);
  const [earthquakeEvents, setEarthquakeEvents] = useState<EarthquakeEvent[]>([]);
  const [earthquakeRoadImpacts, setEarthquakeRoadImpacts] = useState<EarthquakeRoadImpact[]>([]);
  const [result, setResult] = useState<ActiveResult>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<"route" | "evacuation" | null>(null);
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
      ? "Location active"
      : geolocation.status === "locating"
      ? "Finding your location…"
      : geolocation.status === "denied"
      ? "Location permission denied"
      : geolocation.status === "timeout"
      ? "Location request timed out"
      : "Location unavailable";

  const blockedFloodCount = floodReports.filter((r) => r.roadImpassable).length;
  const passableFloodCount = floodReports.length - blockedFloodCount;
  const showOfflineBanner = !isOnline || usingCachedData;

  async function handleFindRoute() {
    if (!geolocation.position || !destination) return;
    setLoading("route");
    setError(null);
    setResult(null);
    try {
      const data = await fetchRoute(
        {
          latitude: geolocation.position.latitude,
          longitude: geolocation.position.longitude,
        },
        destination
      );
      setResult({ kind: "route", data });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not calculate a route.");
    } finally {
      setLoading(null);
    }
  }

  async function handleFindEvacuationCenter() {
    if (!geolocation.position) return;
    setLoading("evacuation");
    setError(null);
    setResult(null);
    try {
      const data = await fetchEvacuationRoute({
        latitude: geolocation.position.latitude,
        longitude: geolocation.position.longitude,
      });
      setResult({ kind: "evacuation", data });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not find an evacuation center."
      );
    } finally {
      setLoading(null);
    }
  }

  const activeRoutePoints =
    result?.kind === "route" || result?.kind === "evacuation" ? result.data.route : null;

  // Route calculation genuinely requires the backend — there is no
  // client-side routing engine, so offline correctly means "can't
  // calculate a route" rather than a confusing failed request.
  const routingDisabledReason = !isOnline
    ? "Route calculation needs a connection."
    : null;

  const displayedCenter = selectedCenter ?? (result?.kind === "evacuation" ? result.data.recommendedCenter : null);
  const choosePanel = (value: "map" | "centers" | "hazards") => {
    setPanel(value);
    setExpanded(value !== "map");
  };

  return (
    <main className="public-app">
      <header className="app-header">
        <h1><Brand /></h1>
        <p className="brand-promise">Safe routes. Safe shelters.<br /><strong>A safer Santa Rosa.</strong></p>
        <span className="city-label"><MapPin size={16} /> Santa Rosa, Laguna</span>
        <Link href="/admin/login" className="admin-link">Admin sign in <ArrowRight size={15} /></Link>
      </header>
      {showOfflineBanner && (
        <div className="offline-banner" role="status"><WifiOff size={17} />
          <span>Offline / cached data{dataAsOf && ` · updated ${timeAgo(dataAsOf)}`}. Hazard information may be outdated.</span>
        </div>
      )}
      <div className="public-workspace">
        <nav className="navigation-rail" aria-label="Map views">
          <button onClick={() => choosePanel("map")} aria-pressed={panel === "map"}><MapIcon size={23} /><span>Map</span></button>
          <button onClick={() => choosePanel("centers")} aria-pressed={panel === "centers"}><Building2 size={23} /><span>Evacuation centers</span></button>
          <button onClick={() => choosePanel("hazards")} aria-pressed={panel === "hazards"}><ShieldAlert size={23} /><span>Hazard information</span></button>
          <div className="rail-caption">EVACUROSA<br />CITY NAVIGATION</div>
        </nav>
        <section className="map-workspace" aria-label="Santa Rosa evacuation map">
          <div className="hazard-strip">
            <button onClick={() => choosePanel("hazards")}><Droplet className="flood-color" size={24} /><span><strong>Flood</strong><small>{floodReports.length} reports · {blockedFloodCount} blocked</small></span></button>
            <button onClick={() => choosePanel("hazards")}><Flame className="fire-color" size={24} /><span><strong>Fire</strong><small>{fireIncidents.length} incidents loaded</small></span></button>
            <button onClick={() => choosePanel("hazards")}><Activity className="earthquake-color" size={24} /><span><strong>Earthquake</strong><small>{earthquakeEvents.length} events loaded</small></span></button>
          </div>
          <div className="map-canvas">
            <Map
              geolocation={geolocation}
              destination={destination}
              route={activeRoutePoints}
              centers={centers}
              floodReports={floodReports}
              fireIncidents={fireIncidents}
              earthquakeEvents={earthquakeEvents}
              earthquakeRoadImpacts={earthquakeRoadImpacts}
              onSelectCenter={(center) => { setSelectedCenter(center); setPanel("centers"); setExpanded(true); }}
              onMapClick={(latitude, longitude) => {
                setDestination({ latitude, longitude });
                setResult(null);
                setError(null);
                setPanel("map");
              }}
            />
            <div className="map-location-status"><span className={geolocation.status === "active" ? "live-dot" : "inactive-dot"} />{locationLabel}</div>
            <MapLegend />
          </div>
        </section>
        <aside className={`information-panel ${expanded ? "is-expanded" : ""}`} aria-label="Navigation information">
          <button className="sheet-toggle" onClick={() => setExpanded(!expanded)} aria-expanded={expanded} aria-controls="panel-details">
            <span>{result ? "Route details" : panel === "centers" ? "Evacuation centers" : panel === "hazards" ? "Hazard information" : "Plan your route"}</span>
            {expanded ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
          </button>
          <div className="panel-scroll" id="panel-details">
            <div className="panel-heading"><span className="eyebrow">SANTA ROSA · LAGUNA</span><h2>{panel === "hazards" ? "Hazard information" : panel === "centers" ? "Evacuation centers" : result ? "Your route" : "Find your way to safety"}</h2>
              <p>{panel === "hazards" ? "Reported conditions and verified road impacts." : "Choose a point on the map or find a recommended evacuation center."}</p>
            </div>
            {panel === "hazards" && (
              <section className="hazard-details">
                <div className="info-notice">Loaded reports are not an all-clear. Conditions can change; follow local emergency guidance.</div>
                <h3><Droplet size={18} /> Flood reports</h3>
                <p>{blockedFloodCount} blocked road reports · {passableFloodCount} passable flood reports</p>
                {floodReports.map(report => <article className="record-card" key={report.id}><strong>{report.severity} flood</strong><span>{report.roadImpassable ? "Road blocked" : "Road passable"} · {report.roadId}</span>{report.notes && <p>{report.notes}</p>}</article>)}
                <h3><Flame size={18} /> Fire incidents</h3>
                {fireIncidents.length === 0 && <p>No fire incidents loaded.</p>}
                {fireIncidents.map(incident => <article className="record-card" key={incident.id}><strong>{incident.severity} fire</strong><span>{incident.radiusMeters} m radius · {incident.confirmedBlockedRoadIds.length} confirmed blocked roads</span>{incident.notes && <p>{incident.notes}</p>}</article>)}
                <h3><Activity size={18} /> Earthquake events</h3>
                {earthquakeEvents.length === 0 && <p>No earthquake events loaded.</p>}
                {earthquakeEvents.map(event => <article className="record-card" key={event.id}><strong>M{event.magnitude.toFixed(1)} · {event.status}</strong><span>{earthquakeRoadImpacts.filter(impact => impact.earthquakeEventId === event.id).length} verified road impacts</span><span>{new Date(event.occurredAt).toLocaleString()}</span></article>)}
              </section>
            )}
            {displayedCenter && panel !== "hazards" && (
              <section className="selected-center">
                <div className="section-title"><span className="eyebrow">{!selectedCenter && result?.kind === "evacuation" ? "RECOMMENDED CENTER" : "SELECTED CENTER"}</span>{selectedCenter && <button className="icon-button" aria-label="Close center details" onClick={() => setSelectedCenter(null)}><X size={18} /></button>}</div>
                <div className="shelter-symbol"><Building2 size={30} /></div>
                <h3>{displayedCenter.name}</h3>
                <p>{displayedCenter.address}</p>
                <StatusBadge status={displayedCenter.status} />
                <div className="center-occupancy"><Users size={20} /><span><strong>{displayedCenter.currentOccupancy} / {displayedCenter.capacity}</strong><small>Current occupancy</small></span></div>
                {displayedCenter.contactInformation && <p>{displayedCenter.contactInformation}</p>}
                {displayedCenter.notes && <p>{displayedCenter.notes}</p>}
              </section>
            )}
            {result && (
              <section className="route-summary" aria-live="polite">
                <div className="section-title"><h3>Route calculated</h3><Route size={19} /></div>
                <p>{result.kind === "evacuation" ? result.data.recommendedCenter.name : destination ? `Destination: ${destination.latitude.toFixed(4)}, ${destination.longitude.toFixed(4)}` : "Selected destination"}</p>
                <div className="route-metrics"><div><strong>{(result.data.distance / 1000).toFixed(1)} km</strong><small>Route distance</small></div><div><Clock size={18} /><small>Travel time unavailable</small></div></div>
                <p className={`route-risk ${riskColor[result.data.riskLevel ?? ""] ?? ""}`}>{riskLabel(result.data.riskLevel)}</p>
                {result.kind === "route" && <p>{result.data.affectedRoads} road segment(s) with a non-open status</p>}
                {result.kind === "evacuation" && <p>{result.data.recommendedCenter.capacity - result.data.recommendedCenter.currentOccupancy} slots available</p>}
                {result.data.warnings.map((warning, index) => <p className="warning-message" key={index}><ShieldAlert size={16} />{warning}</p>)}
              </section>
            )}
            {panel === "centers" && (
              <section className="center-list"><h3>Evacuation centers <span>{centers.length}</span></h3>
                {centers.length === 0 && <p className="empty-message">No evacuation centers loaded.</p>}
                {centers.map(center => <button className="center-list-item" key={center.id} onClick={() => setSelectedCenter(center)} aria-pressed={selectedCenter?.id === center.id}><Building2 size={23} /><span><strong>{center.name}</strong><small>{center.currentOccupancy} / {center.capacity} occupied</small><StatusBadge status={center.status} /></span><ArrowRight size={16} /></button>)}
              </section>
            )}
            <p className="data-note">Hazard and center data is cached for offline viewing. Calculating a route requires a connection.</p>
          </div>
          <div className="route-actions">
            <p>{routingDisabledReason ?? (destination ? `Destination: ${destination.latitude.toFixed(4)}, ${destination.longitude.toFixed(4)}` : "Tap the map to set your destination.")}</p>
            <button type="button" className="primary-button" disabled={!destination || !geolocation.position || loading !== null || !isOnline} onClick={() => { setExpanded(true); handleFindRoute(); }}>
              {loading === "route" ? "Calculating…" : "Find safer route"}<ArrowRight size={18} />
            </button>
            <button type="button" className="secondary-button" disabled={!geolocation.position || loading !== null || !isOnline} onClick={() => { setSelectedCenter(null); setPanel("map"); setExpanded(true); handleFindEvacuationCenter(); }}>
              <Building2 size={18} />{loading === "evacuation" ? "Searching…" : "Find evacuation center"}
            </button>
            {!geolocation.position && <p className="location-help">{locationLabel}. Enable location access to calculate a route.</p>}
            {error && <p className="error-message" role="alert">{error}</p>}
          </div>
        </aside>
      </div>
    </main>
  );
}
