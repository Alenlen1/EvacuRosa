import type { OfflineStatus } from "./routing";

const RETRY_DELAYS = [5000, 15000, 30000, 60000];
const RESUME_REFRESH_MS = 60000;

/** Keep offline files current without a download control. Work pauses when the
 * page is hidden; reconnecting or returning to the app resumes preparation. */
export function watchOfflinePreparation({
  prepare,
  publish,
}: {
  prepare: (
    online: boolean,
    force: boolean,
    progress: (status: OfflineStatus) => void,
  ) => Promise<OfflineStatus>;
  publish: (status: OfflineStatus) => void;
}) {
  let stopped = false;
  let busy = false;
  let queued = false;
  let retries = 0;
  let lastRefresh = 0;
  let lastOnline: boolean | undefined;
  let lastStatus: OfflineStatus | undefined;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;

  const complete = () =>
    lastStatus?.state === "ready" &&
    lastStatus.mapReady === true &&
    !lastStatus.message;
  const visible = () => document.visibilityState !== "hidden";
  const update = (status: OfflineStatus) => {
    if (!stopped) publish(status);
  };

  async function refresh() {
    if (stopped || !visible()) return;
    clearTimeout(retryTimer);
    if (busy) {
      // Several connection/focus events need only one following snapshot.
      queued = true;
      return;
    }
    busy = true;
    const online = navigator.onLine;
    try {
      // Force a fresh hazard/center snapshot on reconnect. The existing
      // preparer still reuses the verified graph and unchanged basemap.
      lastStatus = await prepare(online, online, update);
    } catch {
      lastStatus = { state: "unavailable" };
    }
    busy = false;
    if (stopped) return;
    lastOnline = online;
    lastRefresh = Date.now();
    update(lastStatus);
    if (queued) {
      queued = false;
      void refresh();
      return;
    }
    if (complete()) retries = 0;
    else if (online && navigator.onLine && visible()) {
      // Retry partial downloads and saved-data fallbacks too. A temporary
      // backend or storage failure must not leave preparation stuck forever.
      const delay = RETRY_DELAYS[Math.min(retries++, RETRY_DELAYS.length - 1)];
      retryTimer = setTimeout(() => void refresh(), delay);
    }
  }

  const reconnect = () => {
    retries = 0;
    void refresh();
  };
  const resume = () => {
    if (
      visible() &&
      (!complete() ||
        lastOnline !== navigator.onLine ||
        Date.now() - lastRefresh >= RESUME_REFRESH_MS)
    )
      void refresh();
  };
  window.addEventListener("online", reconnect);
  window.addEventListener("offline", reconnect);
  window.addEventListener("focus", resume);
  document.addEventListener("visibilitychange", resume);
  void refresh();

  return () => {
    stopped = true;
    clearTimeout(retryTimer);
    window.removeEventListener("online", reconnect);
    window.removeEventListener("offline", reconnect);
    window.removeEventListener("focus", resume);
    document.removeEventListener("visibilitychange", resume);
  };
}
