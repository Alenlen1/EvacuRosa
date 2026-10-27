import type { GeolocationState } from "@/hooks/useGeolocation";

export interface AssistanceLocation {
  latitude: number;
  longitude: number;
  accuracy: number;
  recordedAt: string;
}

export const ASSISTANCE_RECENT_LOCATION_MS = 10_000;
export const ASSISTANCE_LOCATION_TIMEOUT_MS = 20_000;

function validCoordinates(
  latitude: number,
  longitude: number,
  accuracy: number,
) {
  return (
    Number.isFinite(latitude) &&
    Math.abs(latitude) <= 90 &&
    Number.isFinite(longitude) &&
    Math.abs(longitude) <= 180 &&
    Number.isFinite(accuracy) &&
    accuracy >= 0
  );
}

export function recentAssistanceLocation(
  state?: GeolocationState,
  now = Date.now(),
): AssistanceLocation | null {
  const position = state?.status === "active" ? state.position : null;
  if (!position) return null;
  const age = now - position.timestamp;
  if (
    !Number.isFinite(age) ||
    age < 0 ||
    age > ASSISTANCE_RECENT_LOCATION_MS ||
    !validCoordinates(position.latitude, position.longitude, position.accuracy)
  )
    return null;
  return {
    latitude: position.latitude,
    longitude: position.longitude,
    accuracy: position.accuracy,
    recordedAt: new Date(position.timestamp).toISOString(),
  };
}

/** A one-time capture. Aborted or late callbacks can never update the form. */
export function captureAssistanceLocation({
  cached,
  forceFresh = false,
  geolocation,
  signal,
}: {
  cached?: GeolocationState;
  forceFresh?: boolean;
  geolocation?: Pick<Geolocation, "getCurrentPosition">;
  signal: AbortSignal;
}): Promise<{ fix: AssistanceLocation; source: "map" | "device" }> {
  if (signal.aborted)
    return Promise.reject(
      new DOMException("Location capture stopped.", "AbortError"),
    );
  const recent = !forceFresh && recentAssistanceLocation(cached);
  if (recent) return Promise.resolve({ fix: recent, source: "map" });
  if (!geolocation)
    return Promise.reject(
      new Error(
        "Location is unavailable. Enable your device's location services or report your location through official emergency channels.",
      ),
    );

  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (
      result?: { fix: AssistanceLocation; source: "device" },
      error?: Error,
    ) => {
      if (settled) return;
      settled = true;
      clearTimeout(deadline);
      signal.removeEventListener("abort", abort);
      if (result) resolve(result);
      else reject(error);
    };
    const abort = () =>
      finish(
        undefined,
        new DOMException("Location capture stopped.", "AbortError"),
      );
    const timeout =
      "Location is taking too long. Check your device's location settings and try again, or report your location through official emergency channels.";
    // The browser timeout excludes permission prompts, so also bound the UI wait.
    const deadline = setTimeout(
      () => finish(undefined, new Error(timeout)),
      ASSISTANCE_LOCATION_TIMEOUT_MS,
    );
    signal.addEventListener("abort", abort, { once: true });
    try {
      geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude, accuracy } = position.coords;
          const age = Date.now() - position.timestamp;
          if (
            !validCoordinates(latitude, longitude, accuracy) ||
            !Number.isFinite(age) ||
            age < 0 ||
            age > ASSISTANCE_RECENT_LOCATION_MS
          ) {
            finish(
              undefined,
              new Error(
                "A recent, valid location could not be confirmed. Please try again.",
              ),
            );
            return;
          }
          finish({
            fix: {
              latitude,
              longitude,
              accuracy,
              recordedAt: new Date(position.timestamp).toISOString(),
            },
            source: "device",
          });
        },
        (error) =>
          finish(
            undefined,
            new Error(
              error.code === 1
                ? "Location permission was denied. Enable it in browser settings or report your location through official emergency channels."
                : error.code === 3
                  ? timeout
                  : "Location is unavailable. Check your device's location services and try again.",
            ),
          ),
        {
          enableHighAccuracy: true,
          maximumAge: 0,
          timeout: ASSISTANCE_LOCATION_TIMEOUT_MS,
        },
      );
    } catch (error) {
      finish(
        undefined,
        error instanceof Error
          ? error
          : new Error("Could not retrieve your location."),
      );
    }
  });
}
