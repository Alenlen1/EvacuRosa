"use client";

import { useEffect } from "react";

/** Registers the app-shell service worker. Never throws into the render
 * tree — a failed registration (unsupported browser, blocked by a
 * extension, etc.) should degrade to "no offline app-shell caching,"
 * never break the app itself. */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.error("Service worker registration failed:", err);
    });
  }, []);

  return null;
}
