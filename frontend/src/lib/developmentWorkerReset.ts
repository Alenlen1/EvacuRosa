// Runs in the document head, independently of React hydration. Unregistering
// alone leaves the current document controlled until its next navigation.
export const DEVELOPMENT_WORKER_RESET = `
(async function () {
  if (!("serviceWorker" in navigator)) return;
  const workerURL = new URL("/sw.js", location.origin).href;
  const key = "evacurosa-dev-worker-recovery";
  const controlled = navigator.serviceWorker.controller?.scriptURL === workerURL;
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.filter(registration =>
      [registration.active, registration.waiting, registration.installing]
        .some(worker => worker?.scriptURL === workerURL)
    ).map(registration => registration.unregister()));
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.filter(name => name.startsWith("evacurosa-shell-"))
        .map(name => caches.delete(name)));
    }
    if (controlled) {
      // Never loop if unregister fails to release an old worker.
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, "1");
        location.reload();
      }
    } else {
      sessionStorage.removeItem(key);
    }
  } catch (error) {
    console.error("Development service worker recovery failed:", error);
  }
})();
`;
