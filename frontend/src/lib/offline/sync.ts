"use client";

import type { CachedValue } from "./cache";

export interface SyncResult<T> {
  data: T;
  /** "live" = fresh from the network just now. "cache" = the network call
   * failed and this is whatever was last successfully cached — the caller
   * must show cachedAt to the user rather than imply this is current
   * (section 43's explicit "never imply cached information is current"). */
  source: "live" | "cache";
  cachedAt: string | null;
}

/**
 * Tries a live fetch first; on failure, falls back to whatever's cached.
 * Throws only when BOTH the live fetch fails AND there's nothing cached —
 * exactly the state section 43 says should surface as "reliable
 * information isn't available," not be papered over.
 */
export async function fetchWithCache<T>(
  fetchLive: () => Promise<T>,
  readCache: () => Promise<CachedValue<T> | null>,
  writeCache: (data: T) => Promise<void>
): Promise<SyncResult<T>> {
  try {
    const data = await fetchLive();
    // Caching is a nice-to-have — a write failure (e.g. IndexedDB blocked
    // in private browsing) must never break the live data path.
    writeCache(data).catch(() => {});
    return { data, source: "live", cachedAt: new Date().toISOString() };
  } catch {
    const cached = await readCache().catch(() => null);
    if (cached) {
      return { data: cached.data, source: "cache", cachedAt: cached.cachedAt };
    }
    throw new Error("No connection and no cached data available.");
  }
}
