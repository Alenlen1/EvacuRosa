import { SANTA_ROSA_CITY_BOUNDS, SANTA_ROSA_CITY_CENTER } from "./mapBounds";
import { formatPhotonLabel, type DestinationLabel } from "./reverseGeocoding";

export interface PlaceResult {
  id: string;
  latitude: number;
  longitude: number;
  label: DestinationLabel;
}

export function withinSearchBounds(latitude: number, longitude: number) {
  const [southwest, northeast] = SANTA_ROSA_CITY_BOUNDS;
  return Number.isFinite(latitude) && Number.isFinite(longitude) &&
    latitude >= southwest[0] && latitude <= northeast[0] &&
    longitude >= southwest[1] && longitude <= northeast[1];
}

export function parsePlaceResults(data: unknown): PlaceResult[] {
  if (!data || typeof data !== "object" || !("features" in data) || !Array.isArray(data.features)) return [];
  const results: PlaceResult[] = [];
  const seen = new Set<string>();
  for (const feature of data.features) {
    const coordinates = feature?.geometry?.coordinates;
    if (feature?.geometry?.type !== "Point" || !Array.isArray(coordinates)) continue;
    const [longitude, latitude] = coordinates;
    if (typeof latitude !== "number" || typeof longitude !== "number" || !withinSearchBounds(latitude, longitude)) continue;
    const label = formatPhotonLabel({ features: [feature] });
    if (!label) continue;
    const id = `${latitude},${longitude}:${label.title}`;
    if (!seen.has(id)) { results.push({ id, latitude, longitude, label }); seen.add(id); }
  }
  return results.slice(0, 6);
}

const cache = new Map<string, { results: PlaceResult[]; expires: number }>();

export async function searchPlaces(query: string, signal: AbortSignal): Promise<PlaceResult[]> {
  const key = query.trim().toLowerCase();
  if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
  const saved = cache.get(key);
  if (saved && saved.expires > Date.now()) return saved.results;
  const [sw, ne] = SANTA_ROSA_CITY_BOUNDS;
  const params = new URLSearchParams({
    q: query.trim(), lang: "en", limit: "6",
    lat: String(SANTA_ROSA_CITY_CENTER[0]), lon: String(SANTA_ROSA_CITY_CENTER[1]),
    bbox: `${sw[1]},${sw[0]},${ne[1]},${ne[0]}`,
  });
  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal.addEventListener("abort", cancel, { once: true });
  const timer = setTimeout(cancel, 8000);
  try {
    const response = await fetch(`https://photon.komoot.io/api/?${params}`, {
      signal: controller.signal, credentials: "omit", referrerPolicy: "no-referrer",
    });
    if (!response.ok) throw new Error("Place search is temporarily unavailable. You can still select a point on the map.");
    const results = parsePlaceResults(await response.json());
    if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
    cache.set(key, { results, expires: Date.now() + 10 * 60_000 });
    if (cache.size > 50) cache.delete(cache.keys().next().value!);
    return results;
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", cancel);
  }
}
