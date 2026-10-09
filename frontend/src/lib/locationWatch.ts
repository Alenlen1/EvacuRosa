import type { GeolocationState } from "@/hooks/useGeolocation";

interface LocationEnvironment {
  geolocation?: Pick<Geolocation, "watchPosition" | "clearWatch"> & Partial<Pick<Geolocation, "getCurrentPosition">>;
  permissions?: Pick<Permissions, "query">;
  page: Pick<Document, "visibilityState" | "addEventListener" | "removeEventListener">;
  lifecycle: Pick<Window, "addEventListener" | "removeEventListener">;
}

export const LOCATION_CHECK_INTERVAL_MS = 20_000;
export const LOCATION_CHECK_TIMEOUT_MS = 8_000;
export const LOCATION_MAX_AGE_MS = 30_000;
export const LOCATION_REQUEST_DEADLINE_MS = 16_000;
const unavailable = "Location could not be confirmed. Check Location Services and try again.";

/** Tracks fresh fixes, including recovery from silent OS location-service loss. */
export function watchDeviceLocation(update: (state: GeolocationState) => void, env: LocationEnvironment) {
  const { geolocation, page, lifecycle } = env;
  let disposed = false;
  let generation = 0;
  let watch: number | null = null;
  let acquisition: ReturnType<typeof setTimeout> | null = null;
  let freshness: ReturnType<typeof setTimeout> | null = null;
  let probeDeadline: ReturnType<typeof setTimeout> | null = null;
  let probeGeneration = 0;
  let probing = false;
  let lastProbeAt = -Infinity;
  let returning = false;
  let permission: PermissionStatus | null = null;
  let state: GeolocationState = { status: "idle", position: null, error: null };

  const publish = (next: GeolocationState) => { state = next; update(next); };
  const cancelProbe = () => {
    probeGeneration++;
    probing = false;
    if (probeDeadline !== null) clearTimeout(probeDeadline);
    probeDeadline = null;
  };
  const clearTimers = () => {
    if (acquisition !== null) clearTimeout(acquisition);
    if (freshness !== null) clearTimeout(freshness);
    acquisition = freshness = null;
    cancelProbe();
  };
  const cancel = () => {
    generation++;
    clearTimers();
    if (watch !== null) geolocation?.clearWatch(watch);
    watch = null;
  };
  const fail = (code: number) => {
    clearTimers();
    publish({ status: code === 1 ? "denied" : "unavailable", position: null,
      error: code === 1 ? "Location access is blocked. Check your phone and browser location settings." : unavailable });
    // Keep the watch available for a later success, but do not repeatedly
    // reopen native location dialogs after 'No thanks' or timeout.
  };
  const record = (position: GeolocationPosition) => {
    const age = Date.now() - position.timestamp;
    const c = position.coords;
    if (!Number.isFinite(age) || age < -1_000 || age > LOCATION_MAX_AGE_MS ||
      !Number.isFinite(c.latitude) || !Number.isFinite(c.longitude) ||
      !Number.isFinite(c.accuracy) || c.accuracy < 0) { fail(2); return; }
    clearTimers();
    publish({ status: "active", position: {
      latitude: c.latitude, longitude: c.longitude, accuracy: c.accuracy,
      timestamp: position.timestamp, heading: c.heading, speed: c.speed,
    }, error: null });
    freshness = setTimeout(checkFreshness, Math.min(LOCATION_CHECK_INTERVAL_MS, LOCATION_MAX_AGE_MS - age));
  };
  const checkFreshness = () => {
    if (disposed || page.visibilityState === "hidden" || state.status !== "active" || probing) return;
    if (!geolocation?.getCurrentPosition) {
      const remaining = LOCATION_MAX_AGE_MS - (Date.now() - state.position!.timestamp);
      if (remaining > 0) freshness = setTimeout(checkFreshness, remaining);
      else fail(2);
      return;
    }
    probing = true;
    lastProbeAt = Date.now();
    const current = generation;
    const probe = ++probeGeneration;
    const valid = () => !disposed && current === generation && probe === probeGeneration;
    probeDeadline = setTimeout(() => { if (valid()) fail(2); }, LOCATION_CHECK_TIMEOUT_MS);
    try {
      // No cached coordinate may count as proof that location is still working.
      geolocation.getCurrentPosition(position => { if (valid()) record(position); },
        error => { if (valid()) fail(error.code); },
        { enableHighAccuracy: true, maximumAge: 0, timeout: LOCATION_CHECK_TIMEOUT_MS });
    } catch { if (valid()) fail(2); }
  };
  const start = (manual = false) => {
    if (disposed || !geolocation || page.visibilityState === "hidden") return;
    if (!manual && watch !== null && (state.status === "locating" || state.status === "active")) return;
    cancel();
    const current = generation;
    publish({ status: "locating", position: null, error: state.error });
    // Browser timeouts exclude time in permission dialogs. Keep the UI bounded
    // even when a device never reports the result of its system dialog.
    acquisition = setTimeout(() => {
      if (!disposed && current === generation && state.status === "locating") fail(2);
    }, LOCATION_REQUEST_DEADLINE_MS);
    try {
      watch = geolocation.watchPosition(position => {
        if (!disposed && current === generation) record(position);
      }, error => { if (!disposed && current === generation) fail(error.code); },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15_000 });
    } catch { fail(2); }
  };
  const permissionChanged = () => {
    if (disposed) return;
    if (permission?.state === "denied") { cancel(); fail(1); }
    else if (permission?.state === "granted") start();
  };
  const resume = () => {
    if (page.visibilityState === "hidden") return;
    const returned = returning;
    returning = false;
    if (permission?.state === "denied") return;
    if (returned || watch === null) start();
    else if (state.status === "active" && Date.now() - lastProbeAt > 3_000) checkFreshness();
    // Focus from dismissing a native dialog is not permission to open it again.
  };
  const visibilityChanged = () => {
    if (page.visibilityState === "hidden") { returning = true; cancel(); }
    else resume();
  };
  if (!geolocation) {
    publish({ status: "unavailable", position: null, error: "Geolocation is not supported on this device." });
    return { retry: () => {}, dispose: () => { disposed = true; } };
  }
  page.addEventListener("visibilitychange", visibilityChanged);
  lifecycle.addEventListener("focus", resume);
  lifecycle.addEventListener("pageshow", resume);
  start();
  try {
    void env.permissions?.query({ name: "geolocation" }).then(result => {
      if (disposed) return;
      permission = result;
      permission.addEventListener("change", permissionChanged);
      if (permission.state === "denied") permissionChanged();
    }).catch(() => {});
  } catch { /* Safari can recover through resume events and explicit retry. */ }
  return { retry: () => start(true), dispose: () => {
    disposed = true;
    cancel();
    permission?.removeEventListener("change", permissionChanged);
    page.removeEventListener("visibilitychange", visibilityChanged);
    lifecycle.removeEventListener("focus", resume);
    lifecycle.removeEventListener("pageshow", resume);
  } };
}
