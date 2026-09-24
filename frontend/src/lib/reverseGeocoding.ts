export interface DestinationLabel {
  title: string;
  subtitle?: string;
  source: "coordinates" | "center" | "photon";
}

export function coordinateLabel(latitude: number, longitude: number): DestinationLabel {
  return { title: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`, source: "coordinates" };
}

export function destinationKey(latitude: number, longitude: number) {
  return `${latitude.toFixed(6)},${longitude.toFixed(6)}`;
}

/** Treat external data as untrusted; never use provider HTML or replace route coordinates. */
export function formatPhotonLabel(data: unknown): DestinationLabel | null {
  if (!data || typeof data !== "object" || !("features" in data) || !Array.isArray(data.features)) return null;
  const feature = data.features[0];
  if (!feature || typeof feature !== "object" || !feature.properties) return null;
  const properties = feature.properties as Record<string, unknown>;
  const field = (key: string) => typeof properties[key] === "string" ? properties[key].trim().slice(0, 120) : "";
  const title = field("name") || field("street") || field("district") || field("locality") || field("city");
  if (!title) return null;
  const parts = [field("street"), field("district") || field("locality"), field("city"), field("state")];
  const subtitle = [...new Set(parts.filter(part => part && part.toLowerCase() !== title.toLowerCase()))].slice(0, 3).join(", ");
  return { title, subtitle: subtitle || undefined, source: "photon" };
}

function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new DOMException("Cancelled", "AbortError"));
    const abort = () => { clearTimeout(timer); reject(new DOMException("Cancelled", "AbortError")); };
    const timer = setTimeout(() => { signal.removeEventListener("abort", abort); resolve(); }, ms);
    signal.addEventListener("abort", abort, { once: true });
  });
}

/** Session-memory cache only: no GPS tracking, persistent location history or background retries. */
export function createReverseGeocoder(request: typeof fetch = (...args) => fetch(...args)) {
  const cache = new Map<string, { label: DestinationLabel | null; expires: number }>();
  let queue: Promise<unknown> = Promise.resolve();
  let lastRequest = 0;

  return (latitude: number, longitude: number, signal: AbortSignal): Promise<DestinationLabel | null> => {
    const key = destinationKey(latitude, longitude);
    const task = queue.catch(() => {}).then(async () => {
      if (signal.aborted) return null;
      const cached = cache.get(key);
      if (cached && cached.expires > Date.now()) return cached.label;
      let label: DestinationLabel | null = null;
      const controller = new AbortController();
      const cancel = () => controller.abort();
      signal.addEventListener("abort", cancel, { once: true });
      let timeout: ReturnType<typeof setTimeout> | undefined;
      try {
        // Serialize requests and cap request starts at one per second per browser session.
        await wait(Math.max(0, 1000 - (Date.now() - lastRequest)), signal);
        if (signal.aborted) return null;
        lastRequest = Date.now();
        timeout = setTimeout(() => controller.abort(), 5000);
        const query = new URLSearchParams({ lat: String(latitude), lon: String(longitude), limit: "1", lang: "en" });
        const response = await request(`https://photon.komoot.io/reverse?${query}`, {
          signal: controller.signal,
          credentials: "omit",
          referrerPolicy: "no-referrer",
        });
        if (response.ok) label = formatPhotonLabel(await response.json());
      } catch {
        // A place-name lookup must never reject a route request or block its controls.
      } finally {
        if (timeout) clearTimeout(timeout);
        signal.removeEventListener("abort", cancel);
      }
      if (signal.aborted) return null;
      cache.delete(key);
      cache.set(key, { label, expires: Date.now() + (label ? 30 * 60_000 : 60_000) });
      if (cache.size > 100) cache.delete(cache.keys().next().value!);
      return label;
    });
    queue = task;
    return task;
  };
}

export const reverseGeocode = createReverseGeocoder();
