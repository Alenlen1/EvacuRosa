import { afterEach, expect, it, vi } from "vitest";

const storage = vi.hoisted(() => new Map<string, unknown>());
vi.mock("./indexedDb", () => ({
  idbGet: async (key: string) =>
    storage.has(key) ? { data: storage.get(key) } : null,
  idbSet: async (key: string, value: unknown) => {
    storage.set(key, value);
  },
}));
vi.mock("./basemap", () => ({
  getSavedBasemap: async () => null,
  prepareDetailedBasemap: async () => {},
}));
vi.mock("./basemapRenderer", () => ({ loadBasemapRenderer: async () => {} }));
afterEach(() => {
  vi.unstubAllGlobals();
  storage.clear();
});

it("takes a new hazard snapshot when a forced refresh arrives during preparation", async () => {
  const before = new Date().toISOString();
  const after = new Date(Date.now() + 1000).toISOString();
  const snapshot = {
    formatVersion: 4,
    graphVersion: "graph",
    updatedAt: before,
    hazardsAvailable: true,
    floodReports: [],
    fireIncidents: [],
    earthquakeImpacts: [],
    earthquakeRoadImpacts: [],
    statusOverrides: [],
    centers: [],
  };
  storage.set("routing-package-v1", {
    snapshot,
    graph: {
      version: "graph",
      data: {
        nodes: [{ id: "a", latitude: 14.3, longitude: 121.1 }],
        edges: [{ id: "edge" }],
      },
    },
  });
  let release!: () => void;
  let ready!: () => void;
  const firstInit = new Promise<void>((resolve) => {
    ready = resolve;
  });
  let initial = true;
  class TestWorker extends EventTarget {
    postMessage(payload: { id: number }) {
      const reply = () =>
        this.dispatchEvent(
          new MessageEvent("message", { data: { id: payload.id } }),
        );
      if (initial) {
        initial = false;
        release = reply;
        ready();
      } else queueMicrotask(reply);
    }
    terminate() {}
  }
  vi.stubGlobal("Worker", TestWorker);
  vi.stubGlobal("navigator", { onLine: true });
  const fetch = vi.fn(
    async () => new Response(JSON.stringify({ ...snapshot, updatedAt: after })),
  );
  vi.stubGlobal("fetch", fetch);
  const { prepareOfflineRouting } = await import("./routing");
  const preparing = prepareOfflineRouting(true);
  await firstInit;
  const refresh = prepareOfflineRouting(true, true);
  expect(fetch).not.toHaveBeenCalled();
  release();
  expect((await preparing).updatedAt).toBe(before);
  expect((await refresh).updatedAt).toBe(after);
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(fetch).toHaveBeenCalledWith(
    expect.stringContaining("/snapshot"),
    expect.objectContaining({ cache: "no-store" }),
  );
});
