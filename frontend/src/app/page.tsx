"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState } from "react";
import { MapPin, Droplet, Flame, WifiOff } from "lucide-react";
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

  return (
    <main className="flex h-dvh flex-col">
      {showOfflineBanner && (
        <div className="flex items-center gap-1.5 bg-amber-100 px-4 py-1.5 text-xs text-amber-800">
          <WifiOff size={12} />
          OFFLINE MODE — showing cached data
          {dataAsOf && ` from ${timeAgo(dataAsOf)}`}. Some hazard information
          may be outdated.
        </div>
      )}

      <header className="border-b border-slate-200 bg-white px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-blue-700">EvacuRosa</h1>
            <p className="flex items-center gap-1 text-xs text-slate-500">
              <MapPin size={12} />
              {locationLabel}
            </p>
          </div>
          {(floodReports.length > 0 || fireIncidents.length > 0) && (
            <div className="flex flex-col items-end gap-0.5 text-xs">
              {floodReports.length > 0 && (
                <p className="flex items-center gap-1 text-amber-700">
                  <Droplet size={12} />
                  {blockedFloodCount > 0 && `${blockedFloodCount} road(s) blocked`}
                  {blockedFloodCount > 0 && passableFloodCount > 0 && " · "}
                  {passableFloodCount > 0 && `${passableFloodCount} flooded`}
                </p>
              )}
              {fireIncidents.length > 0 && (
                <p className="flex items-center gap-1 text-red-700">
                  <Flame size={12} />
                  {fireIncidents.length} active fire{fireIncidents.length > 1 ? "s" : ""}
                </p>
              )}
            </div>
          )}
        </div>
        <div className="mt-1 flex justify-end">
          <Link href="/admin/login" className="text-[11px] text-slate-400 underline">
            Barangay / CDRRMO admin
          </Link>
        </div>
      </header>

      <div className="relative flex-1">
        <Map
          geolocation={geolocation}
          destination={destination}
          route={activeRoutePoints}
          centers={centers}
          floodReports={floodReports}
          fireIncidents={fireIncidents}
          earthquakeEvents={earthquakeEvents}
          earthquakeRoadImpacts={earthquakeRoadImpacts}
          onMapClick={(latitude, longitude) => {
            setDestination({ latitude, longitude });
            setResult(null);
            setError(null);
          }}
        />
      </div>

      <div className="border-t border-slate-200 bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <p className="mb-2 text-sm text-slate-600">
          {routingDisabledReason
            ? routingDisabledReason
            : destination
            ? `Destination set at ${destination.latitude.toFixed(
                4
              )}, ${destination.longitude.toFixed(4)}`
            : "Tap the map to choose a destination, or find the nearest evacuation center."}
        </p>

        <div className="flex gap-2">
          <button
            type="button"
            disabled={
              !destination || !geolocation.position || loading !== null || !isOnline
            }
            onClick={handleFindRoute}
            className="flex-1 rounded-lg bg-blue-600 py-3 text-sm font-medium text-white disabled:bg-slate-300"
          >
            {loading === "route" ? "Calculating…" : "Find Safer Route"}
          </button>
          <button
            type="button"
            disabled={!geolocation.position || loading !== null || !isOnline}
            onClick={handleFindEvacuationCenter}
            className="flex-1 rounded-lg border border-blue-600 py-3 text-sm font-medium text-blue-700 disabled:border-slate-300 disabled:text-slate-400"
          >
            {loading === "evacuation" ? "Searching…" : "Find Evacuation Center"}
          </button>
        </div>

        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

        {result?.kind === "route" && (
          <p className="mt-2 text-center text-xs text-slate-500">
            {(result.data.distance / 1000).toFixed(1)} km ·{" "}
            {result.data.affectedRoads > 0
              ? `${result.data.affectedRoads} road segment(s) with a non-open status`
              : "no affected roads"}{" "}
            ·{" "}
            <span className={`font-medium ${riskColor[result.data.riskLevel ?? ""] ?? ""}`}>
              {riskLabel(result.data.riskLevel)}
            </span>
          </p>
        )}

        {result?.kind === "evacuation" && (
          <p className="mt-2 text-center text-xs text-slate-500">
            Recommended: <strong>{result.data.recommendedCenter.name}</strong> ·{" "}
            {(result.data.distance / 1000).toFixed(1)} km ·{" "}
            {result.data.recommendedCenter.capacity -
              result.data.recommendedCenter.currentOccupancy}{" "}
            slots available ·{" "}
            <span className={`font-medium ${riskColor[result.data.riskLevel ?? ""] ?? ""}`}>
              {riskLabel(result.data.riskLevel)}
            </span>
          </p>
        )}

        <p className="mt-2 text-center text-[11px] text-slate-400">
          Hazard and evacuation-center data is cached for offline viewing.
          Route calculation requires a network connection.
        </p>
      </div>
    </main>
  );
}
