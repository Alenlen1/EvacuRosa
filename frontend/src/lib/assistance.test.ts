import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ASSISTANCE_STORAGE_KEY,
  newAssistanceCredentials,
  readAssistance,
  writeAssistance,
  acceptAssistance,
  consumeAssistanceEvents,
  type TrackedAssistance,
} from "./assistance";
const id = "ea956074-b82a-4df1-b9dc-b02ee7dbd542";
const snapshot = (version: number): TrackedAssistance => ({
  request: {
    id,
    status: "PENDING",
    version,
    latitude: 14.3,
    longitude: 121.1,
    accuracy_meters: 20,
    location_recorded_at: "2026-10-21",
    created_at: "2026-10-21",
    status_updated_at: null,
  },
  history: [],
});
beforeEach(() => {
  const values = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => values.get(k) ?? null,
    setItem: (k: string, v: string) => values.set(k, v),
    removeItem: (k: string) => values.delete(k),
  });
});
afterEach(() => vi.unstubAllGlobals());
describe("private assistance persistence and version handling", () => {
  it("uses cryptographic identities and preserves retry keys across reopening", () => {
    const a = newAssistanceCredentials(),
      b = newAssistanceCredentials();
    expect(a.id).not.toBe(b.id);
    expect(a.submissionKey).toMatch(/^[0-9a-f]{64}$/);
    writeAssistance(a);
    expect(readAssistance()).toEqual(a);
  });
  it.each(["invalid", "{}", JSON.stringify({ id, trackingToken: "guess" })])(
    "rejects invalid local capability data",
    (raw) => {
      localStorage.setItem(ASSISTANCE_STORAGE_KEY, raw);
      expect(readAssistance()).toBeNull();
    },
  );
  it("restores a valid cached snapshot without treating local storage as server authority", () => {
    const saved = { id, trackingToken: "a".repeat(43), cached: snapshot(1) };
    writeAssistance(saved);
    expect(readAssistance()).toEqual(saved);
  });
  it("discards corrupt cached locations while retaining the recovery capability", () => {
    const saved = {
      id,
      trackingToken: "a".repeat(43),
      cached: {
        ...snapshot(1),
        request: { ...snapshot(1).request, latitude: "invalid" },
      },
    };
    localStorage.setItem(ASSISTANCE_STORAGE_KEY, JSON.stringify(saved));
    expect(readAssistance()?.cached).toBeUndefined();
    expect(readAssistance()?.trackingToken).toHaveLength(43);
  });
  it("does not overwrite newer server status with a delayed response", () => {
    const latest = snapshot(3),
      old = snapshot(2);
    expect(acceptAssistance(latest, old)).toBe(latest);
    expect(acceptAssistance(old, latest)).toBe(latest);
  });
});
describe("private notification stream", () => {
  it("passes the capability in headers, parses split events and preserves cleanup", async () => {
    const encoder = new TextEncoder(),
      stream = new ReadableStream({
        start(controller) {
          controller.enqueue(
            encoder.encode('data: {"type":"connection","connected":true}\n'),
          );
          controller.enqueue(
            encoder.encode('\ndata: {"type":"changed","id":"example"}\n\n'),
          );
          controller.close();
        },
      });
    const fetch = vi.fn().mockResolvedValue(new Response(stream));
    vi.stubGlobal("fetch", fetch);
    const change = vi.fn(),
      connection = vi.fn(),
      abort = new AbortController();
    await consumeAssistanceEvents(
      "https://api.example.invalid/requests/id/events",
      "private-token",
      abort.signal,
      change,
      connection,
    );
    expect(connection).toHaveBeenCalledWith(true);
    expect(change).toHaveBeenCalledTimes(2);
    expect(fetch).toHaveBeenCalledWith(
      "https://api.example.invalid/requests/id/events",
      expect.objectContaining({
        cache: "no-store",
        headers: {
          Authorization: "Bearer private-token",
          Accept: "text/event-stream",
        },
        signal: abort.signal,
      }),
    );
  });
  it("fails a denied subscription so the caller can fall back to status polling", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("Denied", { status: 403 })),
    );
    await expect(
      consumeAssistanceEvents(
        "https://api.invalid/events",
        "token",
        new AbortController().signal,
        () => {},
        () => {},
      ),
    ).rejects.toThrow("Live connection unavailable");
  });
});
