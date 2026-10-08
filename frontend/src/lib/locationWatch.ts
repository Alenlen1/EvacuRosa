import type { GeolocationState } from "@/hooks/useGeolocation";

interface LocationEnvironment {
  geolocation?: Pick<Geolocation, "watchPosition" | "clearWatch">;
  permissions?: Pick<Permissions, "query">;
  page: Pick<Document, "visibilityState" | "addEventListener" | "removeEventListener">;
  lifecycle: Pick<Window, "addEventListener" | "removeEventListener">;
}

/** Recover a terminated mobile location watch after settings/permission changes. */
export function watchDeviceLocation(update: (state: GeolocationState) => void, env: LocationEnvironment) {
  const { geolocation, page, lifecycle } = env;
  let disposed = false;
  let generation = 0;
  let watch: number | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let permission: PermissionStatus | null = null;
  let state: GeolocationState = { status: "idle", position: null, error: null };
  let returningFromBackground = false;

  const publish = (next: GeolocationState) => { state = next; update(next); };
  const cancel = () => {
    generation++;
    if (timer !== null) clearTimeout(timer);
    timer = null;
    if (watch !== null) geolocation?.clearWatch(watch);
    watch = null;
  };
  const schedule = () => {
    if (disposed || page.visibilityState === "hidden" || permission?.state === "denied") return;
    // Do not reopen a browser/OS permission dialog on a timer. Recovery comes
    // from changed permission, returning from settings, or the retry button.
    if (state.status === "denied") return;
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => { timer = null; start(); }, 15_000);
  };
  const start = (manual = false) => {
    if (disposed || !geolocation || page.visibilityState === "hidden") return;
    // Permission dialogs, keyboard interactions and window focus must not
    // discard a working fix or interrupt a GPS acquisition in progress.
    if (!manual && watch !== null && (state.status === "locating" || state.status === "active")) return;
    cancel();
    const current = generation;
    publish({ status: "locating", position: null, error: null });
    const failed = (code: number) => {
      if (disposed || current !== generation) return;
      publish({ status: code === 1 ? "denied" : code === 3 ? "timeout" : "unavailable",
        position: null, error: code === 1 ? "Location permission was denied."
          : code === 3 ? "Location request timed out." : "Location is currently unavailable." });
      schedule();
    };
    try {
      watch = geolocation.watchPosition(position => {
        if (disposed || current !== generation) return;
        if (timer !== null) clearTimeout(timer);
        timer = null;
        publish({ status: "active", position: {
          latitude: position.coords.latitude, longitude: position.coords.longitude,
          accuracy: position.coords.accuracy, timestamp: position.timestamp,
          heading: position.coords.heading, speed: position.coords.speed,
        }, error: null });
      }, error => failed(error.code), { enableHighAccuracy: true, maximumAge: 10_000, timeout: 15_000 });
    } catch { failed(2); }
  };
  const permissionChanged = () => {
    if (disposed) return;
    if (permission?.state === "denied") {
      cancel();
      publish({ status: "denied", position: null, error: "Location permission was denied." });
    } else start();
  };
  const resume = () => {
    if (page.visibilityState === "hidden") return;
    const returned = returningFromBackground;
    returningFromBackground = false;
    if (permission?.state === "denied") return;
    if (state.status === "denied" && !returned) return;
    start();
  };
  const visibilityChanged = () => {
    if (page.visibilityState === "hidden") { returningFromBackground = true; cancel(); }
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
  // Some Safari versions do not support querying this permission.
  try {
    void env.permissions?.query({ name: "geolocation" }).then(result => {
      if (disposed) return;
      permission = result;
      permission.addEventListener("change", permissionChanged);
      if (permission.state === "denied") permissionChanged();
      else if (["denied", "unavailable", "timeout"].includes(state.status)) schedule();
    }).catch(() => {});
  } catch { /* Resume events and manual retry work without the Permissions API. */ }
  return { retry: () => start(true), dispose: () => {
    disposed = true;
    cancel();
    permission?.removeEventListener("change", permissionChanged);
    page.removeEventListener("visibilitychange", visibilityChanged);
    lifecycle.removeEventListener("focus", resume);
    lifecycle.removeEventListener("pageshow", resume);
  } };
}
