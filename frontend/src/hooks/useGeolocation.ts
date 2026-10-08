"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { watchDeviceLocation } from "@/lib/locationWatch";

export type GeolocationStatus = "idle" | "locating" | "active" | "denied" | "unavailable" | "timeout";
export interface GeolocationState {
  status: GeolocationStatus;
  position: { latitude: number; longitude: number; accuracy: number; timestamp: number; heading: number | null; speed: number | null } | null;
  error: string | null;
}

/** Live device location stays in memory; it is never persisted by this hook. */
export function useGeolocation(): GeolocationState & { retry: () => void } {
  const [state, setState] = useState<GeolocationState>({ status: "idle", position: null, error: null });
  const retryRef = useRef<() => void>(() => {});
  const retry = useCallback(() => retryRef.current(), []);
  useEffect(() => {
    const watcher = watchDeviceLocation(setState, {
      geolocation: navigator.geolocation, permissions: navigator.permissions,
      page: document, lifecycle: window,
    });
    retryRef.current = watcher.retry;
    return () => { retryRef.current = () => {}; watcher.dispose(); };
  }, []);
  return { ...state, retry };
}
