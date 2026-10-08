import { readFileSync } from "node:fs";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import manifest from "../../../public/maps/manifest.json";

const blob = new Blob([readFileSync(new URL("../../../public/maps/santa-rosa.pmtiles", import.meta.url))]);
const store = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn() }));
vi.mock("./indexedDb", () => ({ idbGet: store.get, idbSet: store.set }));
beforeEach(() => {
  vi.resetModules(); vi.resetAllMocks();
  store.get.mockResolvedValue(null);
  vi.stubGlobal("window", { dispatchEvent: vi.fn() });
});
afterEach(() => vi.unstubAllGlobals());
function saved(version = manifest.sha256) { return { formatVersion: 1 as const, version, bytes: blob.size, blob }; }

describe("detailed offline basemap", () => {
  it("validates the actual shipped archive and reads detailed vector tiles from a local file", async () => {
    const { validateBasemap, openBasemap } = await import("./basemap");
    await validateBasemap(saved());
    const archive = openBasemap(saved());
    const header = await archive.getHeader();
    expect(header.maxZoom).toBe(15);
    const metadata = await archive.getMetadata() as { vector_layers: { id: string }[] };
    const layers = metadata.vector_layers.map(layer => layer.id);
    expect(layers).toEqual(expect.arrayContaining(["roads", "buildings", "water", "places"]));
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Offline")));
    // Santa Rosa city center at native zoom 15.
    const z = 15, lon = 121.1137, lat = 14.3146;
    const x = Math.floor((lon + 180) / 360 * 2 ** z);
    const y = Math.floor((1 - Math.asinh(Math.tan(lat * Math.PI / 180)) / Math.PI) / 2 * 2 ** z);
    expect((await archive.getZxy(z, x, y))?.data.byteLength).toBeGreaterThan(0);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("reuses the saved archive without downloading it again", async () => {
    store.get.mockResolvedValue({ data: saved() });
    vi.stubGlobal("fetch", vi.fn());
    const { prepareDetailedBasemap } = await import("./basemap");
    await prepareDetailedBasemap(true);
    await prepareDetailedBasemap(false);
    expect(fetch).not.toHaveBeenCalled();
    expect(store.set).not.toHaveBeenCalled();
  });
  it("downloads and verifies the whole archive before saving it", async () => {
    store.get.mockResolvedValueOnce(null).mockResolvedValue({ data: saved() });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(blob)));
    const { prepareDetailedBasemap } = await import("./basemap");
    await expect(prepareDetailedBasemap(true)).resolves.toMatchObject({ version: manifest.sha256 });
    expect(store.set).toHaveBeenCalledWith("detailed-basemap-v1", expect.objectContaining({ bytes: manifest.bytes }));
  });
  it("rejects incomplete downloads without overwriting saved data", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("not a map")));
    const { prepareDetailedBasemap } = await import("./basemap");
    await expect(prepareDetailedBasemap(true)).rejects.toThrow("incomplete");
    expect(store.set).not.toHaveBeenCalled();
  });
  it("rejects same-size corrupted archives before saving them", async () => {
    const corrupted = new Uint8Array(await blob.arrayBuffer()); corrupted[100] ^= 1;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(corrupted)));
    const { prepareDetailedBasemap } = await import("./basemap");
    await expect(prepareDetailedBasemap(true)).rejects.toThrow("verification failed");
    expect(store.set).not.toHaveBeenCalled();
  });
  it("explains the initial download requirement when offline with no archive", async () => {
    vi.stubGlobal("fetch", vi.fn());
    const { prepareDetailedBasemap } = await import("./basemap");
    await expect(prepareDetailedBasemap(false)).rejects.toThrow("Connect once");
    expect(fetch).not.toHaveBeenCalled();
  });
});
