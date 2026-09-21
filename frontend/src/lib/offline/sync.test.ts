import { describe, expect, it, vi } from "vitest";
import { fetchWithCache } from "./sync";

describe("fetchWithCache", () => {
  it("returns live data and writes it to cache when the network succeeds", async () => {
    const fetchLive = vi.fn().mockResolvedValue(["a", "b"]);
    const readCache = vi.fn();
    const writeCache = vi.fn().mockResolvedValue(undefined);

    const result = await fetchWithCache(fetchLive, readCache, writeCache);

    expect(result.source).toBe("live");
    expect(result.data).toEqual(["a", "b"]);
    expect(writeCache).toHaveBeenCalledWith(["a", "b"]);
    expect(readCache).not.toHaveBeenCalled();
  });

  it("falls back to cached data when the network fails", async () => {
    const fetchLive = vi.fn().mockRejectedValue(new Error("offline"));
    const readCache = vi.fn().mockResolvedValue({ data: ["cached"], cachedAt: "2026-01-01T00:00:00.000Z" });
    const writeCache = vi.fn();

    const result = await fetchWithCache(fetchLive, readCache, writeCache);

    expect(result.source).toBe("cache");
    expect(result.data).toEqual(["cached"]);
    expect(result.cachedAt).toBe("2026-01-01T00:00:00.000Z");
    expect(writeCache).not.toHaveBeenCalled();
  });

  it("throws a clear error when both the network and the cache are empty", async () => {
    const fetchLive = vi.fn().mockRejectedValue(new Error("offline"));
    const readCache = vi.fn().mockResolvedValue(null);
    const writeCache = vi.fn();

    await expect(fetchWithCache(fetchLive, readCache, writeCache)).rejects.toThrow(
      "No connection and no cached data available."
    );
  });

  it("does not let a cache WRITE failure break the live data path", async () => {
    const fetchLive = vi.fn().mockResolvedValue(["a"]);
    const readCache = vi.fn();
    const writeCache = vi.fn().mockRejectedValue(new Error("IndexedDB blocked"));

    const result = await fetchWithCache(fetchLive, readCache, writeCache);

    expect(result.source).toBe("live");
    expect(result.data).toEqual(["a"]);
  });
});
