import { afterEach, beforeEach, expect, it, vi } from "vitest";

const saved = vi.hoisted(() => ({ value: null as unknown }));
vi.mock("./indexedDb", () => ({
  idbGet: async () => (saved.value ? { data: saved.value } : null),
  idbSet: vi.fn(),
}));

beforeEach(() => {
  vi.resetModules();
  saved.value = null;
  vi.stubGlobal(
    "fetch",
    vi.fn(() => {
      throw Error("Unexpected network request");
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

it("does not download data or send GPS when no saved road data is available", async () => {
  const { lookupSavedLocationName } = await import("./routing");
  expect(
    await lookupSavedLocationName({ latitude: 14.3, longitude: 121.1 }),
  ).toBeNull();
  expect(fetch).not.toHaveBeenCalled();
});

it("looks up the street only in the local worker using saved data", async () => {
  saved.value = {
    graph: {
      version: "test",
      data: { nodes: [{ id: "a" }], edges: [{ id: "ab" }] },
    },
    snapshot: {
      formatVersion: 4,
      graphVersion: "test",
      updatedAt: "2026-11-11T00:00:00Z",
      centers: [],
      statusOverrides: [],
      floodReports: [],
      fireIncidents: [],
      earthquakeImpacts: [],
      earthquakeRoadImpacts: [],
    },
  };
  const messages: object[] = [];
  class LocalWorker extends EventTarget {
    postMessage(payload: { id: number; location?: object }) {
      messages.push(payload);
      queueMicrotask(() =>
        this.dispatchEvent(
          new MessageEvent("message", {
            data: {
              id: payload.id,
              ...(payload.location
                ? { locationName: "Sinalhan Road" }
                : { ready: true }),
            },
          }),
        ),
      );
    }
    terminate() {}
  }
  vi.stubGlobal("Worker", LocalWorker);
  const { lookupSavedLocationName } = await import("./routing");
  const point = { latitude: 14.3, longitude: 121.1 };
  expect(await lookupSavedLocationName(point)).toBe("Sinalhan Road");
  expect(messages).toEqual([
    expect.objectContaining({ package: saved.value }),
    expect.objectContaining({ location: point }),
  ]);
  expect(fetch).not.toHaveBeenCalled();
});

it("falls back without a street label if local storage is unavailable", async () => {
  saved.value = { invalid: true };
  const { lookupSavedLocationName } = await import("./routing");
  expect(
    await lookupSavedLocationName({ latitude: 14.3, longitude: 121.1 }),
  ).toBeNull();
  expect(fetch).not.toHaveBeenCalled();
});
