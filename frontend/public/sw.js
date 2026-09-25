const CACHE_NAME = "evacurosa-shell-v3";
const APP_SHELL = ["/", "/manifest.json", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("evacurosa-shell-") && k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Never intercept API calls — offline fallback for hazard/center data is
  // handled at the application level (IndexedDB, with honest "last
  // updated" timestamps), not here. Never intercept admin routes at all:
  // admin data must never enter the public PWA cache.
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/admin/")) {
    return;
  }
  if (event.request.method !== "GET") return;

  // Only handle the public document and build assets, never remote tiles,
  // geocoding, Next RSC navigation payloads or development hot updates.
  if (url.origin !== self.location.origin) return;
  const navigation = event.request.mode === "navigate" && url.pathname === "/";
  const asset = url.pathname.startsWith("/_next/static/") || APP_SHELL.slice(1).includes(url.pathname);
  if (!navigation && !asset) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const key = navigation ? "/" : event.request;
    const cached = await cache.match(key);
    // Use fresh HTML online to match the current build. Only versioned assets
    // are cache-first. HTML must never be a fallback for JavaScript or images.
    if (asset && cached) return cached;
    try {
      const response = await fetch(event.request);
      if (response.ok) await cache.put(key, response.clone()).catch(() => {});
      return response;
    } catch (error) {
      if (cached) return cached;
      throw error;
    }
  })());
});
