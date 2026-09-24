import { afterEach, describe, expect, it, vi } from "vitest";
import { parsePlaceResults, searchPlaces } from "./placeSearch";

const feature = (name: string, longitude = 121.11, latitude = 14.31) => ({
  geometry: { type: "Point", coordinates: [longitude, latitude] },
  properties: { name, city: "Santa Rosa", state: "Laguna" },
});
afterEach(() => vi.unstubAllGlobals());

describe("Santa Rosa place search", () => {
  it("uses GeoJSON longitude/latitude order and a readable label", () => {
    const [result] = parsePlaceResults({ features: [feature("Market Area")] });
    expect(result.latitude).toBe(14.31);
    expect(result.longitude).toBe(121.11);
    expect(result.label.title).toBe("Market Area");
    expect(result.label.subtitle).toBe("Santa Rosa, Laguna");
  });
  it("rejects out-of-bounds and malformed results and removes duplicates", () => {
    expect(parsePlaceResults({ features: [null, {}, feature("Outside", 120.9, 14.6), feature("Invalid", NaN), feature("Here"), feature("Here")] })).toHaveLength(1);
    expect(parsePlaceResults(null)).toEqual([]);
  });
  it("sends the existing map bounds and caches repeat queries", async () => {
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify({ features: [feature("Test place")] })));
    vi.stubGlobal("fetch", request);
    const signal = new AbortController().signal;
    await searchPlaces("Test place", signal);
    await searchPlaces("test place", signal);
    expect(request).toHaveBeenCalledTimes(1);
    const url = new URL(request.mock.calls[0][0]);
    expect(url.searchParams.get("bbox")).toBe("121.05,14.27,121.15,14.36");
    expect(url.searchParams.get("q")).toBe("Test place");
  });
  it("does not start cancelled searches", async () => {
    const request = vi.fn();
    vi.stubGlobal("fetch", request);
    const controller = new AbortController();
    controller.abort();
    await expect(searchPlaces("cancelled", controller.signal)).rejects.toMatchObject({ name: "AbortError" });
    expect(request).not.toHaveBeenCalled();
  });
  it("reports provider errors instead of treating them as no matches", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 429 })));
    await expect(searchPlaces("rate limited", new AbortController().signal)).rejects.toThrow("temporarily unavailable");
  });
});
