"use client";

import { useEffect } from "react";

/** Registers the app-shell service worker. Never throws into the render
 * tree — a failed registration (unsupported browser, blocked by a
 * extension, etc.) should degrade to "no offline app-shell caching,"
 * never break the app itself. */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    // Development chunks change constantly; don't mix them with cached builds.
    if (process.env.NODE_ENV !== "production") {
      async function clearDevelopmentWorker() {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.filter((registration) =>
          [registration.active, registration.waiting, registration.installing].some((worker) =>
            worker?.scriptURL === new URL("/sw.js", window.location.origin).href
          )
        ).map((registration) => registration.unregister()));
        if ("caches" in window) {
          const keys = await caches.keys();
          await Promise.all(keys.filter((key) => key.startsWith("evacurosa-shell-"))
            .map((key) => caches.delete(key)));
        }
      }
      clearDevelopmentWorker().catch((err) => console.error("Development cache cleanup failed:", err));
      return;
    }
    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.error("Service worker registration failed:", err);
    });
  }, []);

  return null;
}
