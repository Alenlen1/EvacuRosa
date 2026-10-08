"use client";
import { FileSource, PMTiles, TileType } from "pmtiles";
import manifest from "../../../public/maps/manifest.json";
import { idbGet, idbSet } from "./indexedDb";

const KEY = "detailed-basemap-v1";
export interface SavedBasemap {
  formatVersion: 1;
  version: string;
  bytes: number;
  blob: Blob;
}
let savedMap: SavedBasemap | null = null;
let preparing: Promise<SavedBasemap> | null = null;

export function openBasemap(data: SavedBasemap): PMTiles {
  return new PMTiles(new FileSource(new File([data.blob], `santa-rosa-${data.version}.pmtiles`)));
}

export async function validateBasemap(data: SavedBasemap): Promise<void> {
  if (data.formatVersion !== 1 || !/^[a-f0-9]{64}$/.test(data.version) ||
    !(data.blob instanceof Blob) || data.bytes !== data.blob.size || data.bytes < 127) {
    throw new Error("Saved offline map is incomplete.");
  }
  const hash = await crypto.subtle.digest("SHA-256", await data.blob.arrayBuffer());
  const actual = Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, "0")).join("");
  if (actual !== data.version) throw new Error("Offline map verification failed. Please retry the download.");
  const header = await openBasemap(data).getHeader();
  if (header.specVersion !== 3 || header.tileType !== TileType.Mvt || header.maxZoom < manifest.maxDataZoom ||
    header.minLon > manifest.bounds[0] || header.minLat > manifest.bounds[1] ||
    header.maxLon < manifest.bounds[2] || header.maxLat < manifest.bounds[3]) {
    throw new Error("The offline map does not cover Santa Rosa.");
  }
}

export async function getSavedBasemap(): Promise<SavedBasemap | null> {
  if (savedMap) return savedMap;
  const saved = await idbGet<SavedBasemap>(KEY);
  if (!saved) return null;
  try {
    await validateBasemap(saved.data);
    savedMap = saved.data;
    return savedMap;
  } catch { return null; }
}

export async function prepareDetailedBasemap(online: boolean): Promise<SavedBasemap> {
  if (preparing) return preparing;
  preparing = (async () => {
    const previous = await getSavedBasemap();
    if (previous?.version === manifest.sha256 || (!online && previous)) return previous;
    if (!online) throw new Error("Connect once to download the detailed offline map.");
    const response = await fetch(`${manifest.url}?v=${manifest.sha256}`, {
      cache: "no-store", signal: AbortSignal.timeout(120000),
    });
    if (!response.ok) throw new Error("Detailed map download failed. Retry while connected.");
    const blob = await response.blob();
    if (blob.size !== manifest.bytes) throw new Error("Detailed map download is incomplete. Please retry.");
    const data: SavedBasemap = { formatVersion: 1, version: manifest.sha256, bytes: blob.size, blob };
    await validateBasemap(data);
    // Validate first, then replace the complete file in one IDB transaction.
    await idbSet(KEY, data);
    const stored = await idbGet<SavedBasemap>(KEY);
    if (!stored) throw new Error("Your browser could not save the detailed map. Check available storage.");
    await validateBasemap(stored.data);
    savedMap = stored.data;
    window.dispatchEvent(new Event("evacurosa-basemap-ready"));
    return savedMap;
  })();
  try { return await preparing; } finally { preparing = null; }
}
