"use client";

import { useEffect, useRef, useState } from "react";

export type GeolocationStatus =
  | "idle"
  | "locating"
  | "active"
  | "denied"
  | "unavailable"
  | "timeout";

export interface GeolocationState {
  status: GeolocationStatus;
  position: { latitude: number; longitude: number; accuracy: number } | null;
  error: string | null;
}

/**
 * Watches the device's live location. The position only ever lives in this
 * hook's client-side state — it is never sent anywhere or persisted.
 */
export function useGeolocation(): GeolocationState {
  const [state, setState] = useState<GeolocationState>({
    status: "idle",
    position: null,
    error: null,
  });
  const watchIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setState({
        status: "unavailable",
        position: null,
        error: "Geolocation is not supported on this device.",
      });
      return;
    }

    setState((prev) => ({ ...prev, status: "locating" }));

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setState({
          status: "active",
          position: {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          },
          error: null,
        });
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setState({
            status: "denied",
            position: null,
            error: "Location permission was denied.",
          });
        } else if (err.code === err.TIMEOUT) {
          setState((prev) => ({
            ...prev,
            status: "timeout",
            error: "Location request timed out.",
          }));
        } else {
          setState({
            status: "unavailable",
            position: null,
            error: "Location is currently unavailable.",
          });
        }
      },
      {
        enableHighAccuracy: true,
        maximumAge: 10_000,
        timeout: 15_000,
      }
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  return state;
}
