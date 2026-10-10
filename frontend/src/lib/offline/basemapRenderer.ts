"use client";

let loading: Promise<typeof import("protomaps-leaflet")> | null = null;

/** Warm the lazy renderer while connected, before reporting map readiness. */
export function loadBasemapRenderer() {
  if (!loading) {
    loading = (async () => {
      const leaflet = await import("leaflet");
      // This Leaflet plugin expects the browser global even in module builds.
      window.L = leaflet;
      return import("protomaps-leaflet");
    })().catch((error) => {
      loading = null;
      throw error;
    });
  }
  return loading;
}
