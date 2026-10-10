const CACHE_NAME = "evacurosa-shell-v5";
const APP_SHELL = ["/", "/manifest.json", "/icons/evacurosa.svg", "/icons/evacurosa-32.png", "/icons/evacurosa-180.png", "/icons/evacurosa-192.png", "/icons/evacurosa-512.png", "/icons/evacurosa-512-maskable.png"];

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

self.addEventListener("message", (event) => {
  if (event.data?.type !== "PREPARE_OFFLINE") return;
  event.waitUntil((async () => {
    try {
      const cache = await caches.open(CACHE_NAME);
      let manifest;
      try {
        const response = await fetch("/offline-assets.json", { cache: "no-store" });
        if (!response.ok) throw new Error("Missing offline build manifest");
        manifest = await response.clone().json();
        await cache.put("/offline-assets.json", response);
      } catch {
        const cached = await cache.match("/offline-assets.json");
        if (!cached) throw new Error("No offline build manifest");
        manifest = await cached.json();
      }
      if (!Array.isArray(manifest.assets) || manifest.assets.length === 0) throw new Error("Empty offline build");
      // Only public build files, never admin documents or API/user data.
      const assets = manifest.assets.filter(path => typeof path === "string" &&
        path.startsWith("/_next/static/") && !path.includes("..") && !path.includes("?"));
      if (assets.length !== manifest.assets.length) throw new Error("Invalid offline build");
      // Small batches avoid flooding mobile connections.
      for (let i = 0; i < assets.length; i += 6) {
        await Promise.all(assets.slice(i, i + 6).map(async path => {
          if (!await cache.match(path)) await cache.add(path);
        }));
      }
      try { await cache.add("/"); } catch { if (!await cache.match("/")) throw new Error("No offline page"); }
      event.ports[0]?.postMessage({ ok: true });
    } catch {
      event.ports[0]?.postMessage({ ok: false });
    }
  })());
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
  const appManifest = url.pathname === "/manifest.json";
  const asset = url.pathname.startsWith("/_next/static/") || APP_SHELL.slice(1).includes(url.pathname);
  if (!navigation && !asset) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const key = navigation ? "/" : event.request;
    const cached = await cache.match(key);
    // Use fresh HTML online to match the current build. Only versioned assets
    // are cache-first. HTML must never be a fallback for JavaScript or images.
    if (asset && !appManifest && cached) return cached;
    try {
      // Installed-app settings (including orientation) must not remain pinned
      // to the manifest saved at first installation.
      const response = appManifest
        ? await fetch(event.request, { cache: "no-cache" })
        : await fetch(event.request);
      if (appManifest && !response.ok && cached) return cached;
      if (response.ok) await cache.put(key, response.clone()).catch(() => {});
      return response;
    } catch (error) {
      if (cached) return cached;
      throw error;
    }
  })());
});
