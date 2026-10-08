"use client";

import { idbGet, idbSet } from "./indexedDb";
import { getSavedBasemap, prepareDetailedBasemap } from "./basemap";
import { loadBasemapRenderer } from "./basemapRenderer";
import { RoutingError, type RouteResponse, type EvacuationRouteResponse, type LatLng } from "../../services/api";
import type { TravelMode } from "../travelTime";
import { OFFLINE_FORMAT, type OfflinePackage, type OfflineSnapshot, type OfflineGraph } from "../../../../backend/src/algorithms/offline";

const KEY = "routing-package-v1";
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
export type OfflineStatus = { state: "checking" | "downloading" | "ready" | "unavailable"; updatedAt?: string; message?: string; mapReady?: boolean };
let currentPackage: OfflinePackage | null = null;
let worker: Worker | null = null;
let workerVersion: string | null = null;
let nextId = 0;
let preparing: Promise<OfflineStatus> | null = null;

export function validPackage(data: OfflinePackage): boolean {
  return !!data && data.snapshot?.formatVersion === OFFLINE_FORMAT &&
    data.graph?.version === data.snapshot.graphVersion &&
    Number.isFinite(Date.parse(data.snapshot.updatedAt)) &&
    Array.isArray(data.graph.data?.nodes) && data.graph.data.nodes.length > 0 &&
    Array.isArray(data.graph.data.edges) && data.graph.data.edges.length > 0 &&
    Array.isArray(data.snapshot.centers) && Array.isArray(data.snapshot.statusOverrides) &&
    Array.isArray(data.snapshot.floodReports) && Array.isArray(data.snapshot.fireIncidents) &&
    Array.isArray(data.snapshot.earthquakeImpacts);
}

export async function getOfflinePackage(): Promise<OfflinePackage | null> {
  if (currentPackage) return currentPackage;
  const saved = await idbGet<OfflinePackage>(KEY);
  if (saved && validPackage(saved.data)) currentPackage = saved.data;
  return currentPackage;
}

function makeWorker() {
  if (!worker) worker = new Worker(new URL("./routing.worker.ts", import.meta.url), { type: "module" });
  return worker;
}
function requestWorker<T>(payload: object): Promise<T> {
  return new Promise((resolve, reject) => {
    const target = makeWorker();
    const id = ++nextId;
    const cleanup = () => {
      clearTimeout(timer);
      target.removeEventListener("message", receive);
      target.removeEventListener("error", fail);
    };
    const discard = () => {
      target.terminate();
      if (worker === target) { worker = null; workerVersion = null; }
    };
    const fail = () => { cleanup(); discard(); reject(new Error("Could not start offline routing. Reconnect to prepare the app.")); };
    const receive = (event: MessageEvent) => {
      if (event.data.id !== id) return;
      cleanup();
      if (event.data.error) reject(new RoutingError(event.data.error, event.data.failureReason));
      else resolve(event.data as T);
    };
    const timer = setTimeout(() => { cleanup(); discard(); reject(new Error("Offline route calculation timed out. Please retry.")); }, 60000);
    target.addEventListener("message", receive);
    target.addEventListener("error", fail);
    try { target.postMessage({ ...payload, id }); }
    catch (error) { cleanup(); discard(); reject(error); }
  });
}
async function loadWorker(data: OfflinePackage) {
  const version = `${data.graph.version}:${data.snapshot.updatedAt}`;
  if (workerVersion !== version) {
    await requestWorker({ package: data });
    workerVersion = version;
  }
}

// Precache every versioned JS/CSS/font asset, including lazy map and worker
// chunks, before claiming readiness for an offline reload of this build.
async function prepareAppAssets(): Promise<void> {
  if (process.env.NODE_ENV !== "production") return;
  if (!("serviceWorker" in navigator)) throw new Error("This browser cannot save the app for offline reopening.");
  const registration = await navigator.serviceWorker.register("/sw.js");
  const serviceWorker = !registration.installing && !registration.waiting && registration.active
    ? registration.active : await new Promise<ServiceWorker>((resolve, reject) => {
    const target = registration.installing ?? registration.waiting;
    if (!target) { reject(new Error("Offline app installation failed.")); return; }
    const timer = setTimeout(() => reject(new Error("Offline app installation timed out.")), 30000);
    const check = () => { if (target.state === "activated") { clearTimeout(timer); target.removeEventListener("statechange", check); resolve(target); } };
    target.addEventListener("statechange", check);
    check();
  });
  await new Promise<void>((resolve, reject) => {
    const channel = new MessageChannel();
    const timer = setTimeout(() => { channel.port1.close(); reject(new Error("Saving offline app files timed out.")); }, 60000);
    channel.port1.onmessage = (event) => {
      clearTimeout(timer);
      channel.port1.close();
      if (event.data.ok) resolve();
      else reject(new Error("Could not save all app files. Retry while connected."));
    };
    serviceWorker.postMessage({ type: "PREPARE_OFFLINE" }, [channel.port2]);
  });
}

async function downloadPackage(saved: OfflinePackage | null) {
  const response = await fetch(`${API_URL}/api/offline-routing/snapshot`, { cache: "no-store", signal: AbortSignal.timeout(60000) });
  if (!response.ok) throw new Error("Offline routing download failed. Retry while connected.");
  const snapshot = await response.json() as OfflineSnapshot;
  if (snapshot.formatVersion !== OFFLINE_FORMAT) throw new Error("Offline routing needs an app update. Reload while connected.");
  let graph = saved?.graph;
  if (!graph || graph.version !== snapshot.graphVersion) {
    const response = await fetch(`${API_URL}/api/offline-routing/graph`, { signal: AbortSignal.timeout(120000) });
    if (!response.ok) throw new Error("Could not download the Santa Rosa road network.");
    graph = await response.json() as OfflineGraph;
  }
  const data = { graph, snapshot };
  if (!validPackage(data)) throw new Error("Downloaded routing data is incomplete. Please retry.");
  // Atomic replacement: never combine new hazards with an old road graph.
  await idbSet(KEY, data);
  const verification = await idbGet<OfflinePackage>(KEY);
  if (!verification || !validPackage(verification.data)) throw new Error("Your browser could not save offline routing data. Check available storage.");
  currentPackage = data;
  return data;
}

export async function prepareOfflineRouting(online: boolean, force = false,
  progress?: (status: OfflineStatus) => void): Promise<OfflineStatus> {
  if (preparing) return preparing;
  preparing = (async () => {
    let saved: OfflinePackage | null = null;
    try {
      saved = await getOfflinePackage();
      if (online && navigator.onLine) {
        progress?.({ state: "downloading", updatedAt: saved?.snapshot.updatedAt });
        if (!saved || force || Date.now() - Date.parse(saved.snapshot.updatedAt) > 30 * 60 * 1000) {
          saved = await downloadPackage(saved);
        }
      }
      if (!saved) return { state: "unavailable" as const, message: "Connect once to download offline routing data." };
      await loadWorker(saved);
      await prepareAppAssets();
      const mapStatus = await prepareMap(online, saved.snapshot.updatedAt, progress);
      if (online) void navigator.storage?.persist?.().catch(() => false);
      return { state: "ready" as const, updatedAt: saved.snapshot.updatedAt, ...mapStatus };
    } catch (error) {
      // A failed refresh must not disable an already usable offline package.
      if (saved) {
        try {
          await loadWorker(saved);
          await prepareAppAssets();
          const mapStatus = await prepareMap(online, saved.snapshot.updatedAt, progress);
          return { state: "ready" as const, updatedAt: saved.snapshot.updatedAt,
            ...mapStatus, message: ["Update failed. Using previously saved routing data.", mapStatus.message].filter(Boolean).join(" ") };
        } catch { /* Report readiness failure below. */ }
      }
      return { state: "unavailable" as const, message: error instanceof Error ? error.message : "Offline preparation failed." };
    }
  })();
  try { return await preparing; } finally { preparing = null; }
}

async function prepareMap(online: boolean, updatedAt: string, progress?: (status: OfflineStatus) => void) {
  if (online) progress?.({ state: "downloading", updatedAt, message: "Saving the detailed offline map… Keep the app open." });
  let rendererReady = false;
  try {
    await loadBasemapRenderer();
    rendererReady = true;
    await prepareDetailedBasemap(online && navigator.onLine);
    return { mapReady: true };
  } catch {
    const previous = await getSavedBasemap().catch(() => null);
    if (!rendererReady) return { mapReady: false,
      message: "Detailed map code is not loaded yet. Reconnect and retry preparation." };
    return { mapReady: !!previous, message: previous
      ? "Map update failed. Using the previously saved detailed map."
      : "Detailed map is not saved yet. Basic offline roads are available. Retry while connected." };
  }
}

export async function calculateOfflineRoute(start: LatLng, destination: LatLng, travelMode: TravelMode): Promise<RouteResponse> {
  const data = await getOfflinePackage();
  if (!data) throw new Error("Connect once to download offline routing data.");
  await loadWorker(data);
  return (await requestWorker<{ result: RouteResponse }>({ start, destination, travelMode })).result;
}
export async function calculateOfflineEvacuationRoute(start: LatLng, travelMode: TravelMode): Promise<EvacuationRouteResponse> {
  const data = await getOfflinePackage();
  if (!data) throw new Error("Connect once to download offline routing data.");
  await loadWorker(data);
  return (await requestWorker<{ result: EvacuationRouteResponse }>({ start, destination: null, travelMode })).result;
}
