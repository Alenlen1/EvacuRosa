import { describe, expect, it, vi } from "vitest";
import {
  clearRouteSelection,
  parseRouteSelection,
  readRouteSelection,
  ROUTE_SESSION_KEY,
  saveRouteSelection,
  type RouteSelection,
} from "./routeSession";

const selection: RouteSelection = {
  destination: { latitude: 14.33, longitude: 121.11 },
  travelMode: "biking",
  intent: "route",
};
function storage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
  };
}
describe("route session selections", () => {
  it("restores a destination and mode after recreating page state", () => {
    const store = storage();
    saveRouteSelection(selection, store);
    expect(readRouteSelection(store)).toEqual(selection);
  });
  it("keeps evacuation intent so availability is rechecked rather than reusing a route", () => {
    const store = storage();
    saveRouteSelection({ ...selection, intent: "evacuation" }, store);
    expect(readRouteSelection(store)?.intent).toBe("evacuation");
  });
  it("remembers an evacuation search even without a destination yet", () => {
    const store = storage();
    const search = {
      ...selection,
      destination: null,
      intent: "evacuation" as const,
    };
    saveRouteSelection(search, store);
    expect(readRouteSelection(store)).toEqual(search);
  });
  it("restores a pin without claiming a route was previously requested", () => {
    const store = storage();
    saveRouteSelection({ ...selection, intent: null }, store);
    expect(readRouteSelection(store)?.intent).toBeNull();
  });
  it("removes only the saved selection when the destination is cleared", () => {
    const store = storage();
    store.setItem("unrelated", "keep");
    saveRouteSelection(selection, store);
    clearRouteSelection(store);
    expect(readRouteSelection(store)).toBeNull();
    expect(store.getItem("unrelated")).toBe("keep");
  });
  it("overwrites the previous destination and mode", () => {
    const store = storage();
    saveRouteSelection(selection, store);
    const next = {
      destination: { latitude: 14.31, longitude: 121.12 },
      travelMode: "car" as const,
      intent: null,
    };
    saveRouteSelection(next, store);
    expect(readRouteSelection(store)).toEqual(next);
  });
  it("does not store origin, route, risk, contacts, or consent even if extras are supplied", () => {
    const store = storage();
    const extra = {
      ...selection,
      start: { latitude: 1, longitude: 2 },
      route: ["old"],
      consent: true,
      contact: "private",
      risk: "LOW",
    };
    saveRouteSelection(extra, store);
    expect(JSON.parse(store.getItem(ROUTE_SESSION_KEY)!)).toEqual({
      version: 1,
      ...selection,
    });
  });
  it.each([
    null,
    "bad-json",
    "null",
    "{}",
    JSON.stringify({ version: 2, ...selection }),
    JSON.stringify({ version: 1, ...selection, travelMode: "__proto__" }),
    JSON.stringify({ version: 1, ...selection, destination: null }),
    JSON.stringify({
      version: 1,
      ...selection,
      destination: { latitude: 91, longitude: 121 },
    }),
    JSON.stringify({
      version: 1,
      ...selection,
      destination: { latitude: "14", longitude: 121 },
    }),
    JSON.stringify({ version: 1, ...selection, intent: "unknown" }),
  ])("ignores invalid saved selections: %s", (raw) => {
    expect(parseRouteSelection(raw)).toBeNull();
  });
  it("does not break routing if browser storage is blocked or full", () => {
    const fail = vi.fn(() => {
      throw new Error("Storage unavailable");
    });
    const store = { getItem: fail, setItem: fail, removeItem: fail };
    expect(readRouteSelection(store)).toBeNull();
    expect(() => saveRouteSelection(selection, store)).not.toThrow();
    expect(() => clearRouteSelection(store)).not.toThrow();
  });
});
