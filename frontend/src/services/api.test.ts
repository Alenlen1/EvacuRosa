import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  deleteAssistanceRequest,
  fetchAssistanceRequests,
  fetchEvacuationRoute,
  fetchRoute,
  fetchFloodReports,
  fetchFireIncidents,
  fetchEarthquakes,
  fetchEarthquakeArea,
  fetchEvacuationCenters,
  RoutingError,
  shareAssistanceLocation,
} from "./api";
const start = { latitude: 14.3, longitude: 121.1 };
const destination = { latitude: 14.31, longitude: 121.11 };
const offline = vi.hoisted(() => ({
  getOfflinePackage: vi.fn(),
  calculateOfflineRoute: vi.fn(),
  calculateOfflineEvacuationRoute: vi.fn(),
}));
vi.mock("../lib/offline/routing", () => offline);
beforeEach(() => {
  vi.clearAllMocks();
  offline.getOfflinePackage.mockResolvedValue(null);
});
afterEach(() => vi.unstubAllGlobals());
describe("earthquake rectangle preview", () => {
  it.each([undefined, 37.5])(
    "sends the rectangle's rotation (%s) to the road preview",
    async (rotationDegrees) => {
      const fetch = vi
        .fn()
        .mockResolvedValue(new Response(JSON.stringify({ roads: [] })));
      vi.stubGlobal("fetch", fetch);
      await expect(
        fetchEarthquakeArea({
          shape: "rectangle",
          ...start,
          widthMeters: 30,
          heightMeters: 80,
          ...(rotationDegrees === undefined ? {} : { rotationDegrees }),
        }),
      ).resolves.toEqual([]);
      const url = new URL(fetch.mock.calls[0][0]);
      expect(url.pathname).toBe("/api/roads/earthquake-area");
      expect(url.searchParams.get("rotation")).toBe(
        String(rotationDegrees ?? 0),
      );
      expect(url.searchParams.get("width")).toBe("30");
      expect(url.searchParams.get("height")).toBe("80");
    },
  );
});
describe("location-sharing API", () => {
  it("bypasses caches for current hazards, shelters and new routes", async () => {
    const fetch = vi.fn().mockImplementation(
      async () =>
        new Response(
          JSON.stringify({
            reports: [],
            incidents: [],
            events: [],
            roadImpacts: [],
            centers: [],
          }),
        ),
    );
    vi.stubGlobal("fetch", fetch);
    vi.stubGlobal("navigator", { onLine: true });
    await Promise.all([
      fetchFloodReports(),
      fetchFireIncidents(),
      fetchEarthquakes(),
      fetchEvacuationCenters(),
      fetchRoute(start, destination),
      fetchEvacuationRoute(start),
    ]);
    expect(fetch).toHaveBeenCalledTimes(6);
    for (const [, options] of fetch.mock.calls as unknown as [
      string,
      RequestInit,
    ][])
      expect(options).toMatchObject({
        cache: "no-store",
        signal: expect.any(AbortSignal),
      });
  });
  it("calculates locally without any request when disconnected", async () => {
    vi.stubGlobal("navigator", { onLine: false });
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    offline.calculateOfflineRoute.mockResolvedValue({ source: "offline" });
    offline.calculateOfflineEvacuationRoute.mockResolvedValue({
      source: "offline",
    });
    await expect(fetchRoute(start, destination, "car")).resolves.toMatchObject({
      source: "offline",
    });
    await expect(fetchEvacuationRoute(start, "walking")).resolves.toMatchObject(
      { source: "offline" },
    );
    expect(fetch).not.toHaveBeenCalled();
    expect(offline.calculateOfflineRoute).toHaveBeenCalledWith(
      start,
      destination,
      "car",
    );
  });
  it.each(["network", "server"])(
    "does not silently use stale hazards after an online %s failure",
    async (failure) => {
      vi.stubGlobal("navigator", { onLine: true });
      offline.getOfflinePackage.mockResolvedValue({});
      offline.calculateOfflineRoute.mockResolvedValue({ source: "offline" });
      vi.stubGlobal(
        "fetch",
        failure === "network"
          ? vi.fn().mockRejectedValue(new TypeError("Disconnected"))
          : vi.fn().mockResolvedValue(new Response(null, { status: 503 })),
      );
      await expect(fetchRoute(start, destination)).rejects.toThrow(
        "Current road closures could not be verified",
      );
      await expect(fetchEvacuationRoute(start)).rejects.toThrow(
        "Current road closures could not be verified",
      );
      expect(offline.calculateOfflineRoute).not.toHaveBeenCalled();
      expect(offline.calculateOfflineEvacuationRoute).not.toHaveBeenCalled();
    },
  );
  it.each(["route", "evacuation"])(
    "uses offline routing if connectivity is lost during a %s request",
    async (kind) => {
      const connection = { onLine: true };
      vi.stubGlobal("navigator", connection);
      vi.stubGlobal(
        "fetch",
        vi.fn().mockImplementation(async () => {
          connection.onLine = false;
          throw new TypeError("Disconnected");
        }),
      );
      offline.calculateOfflineRoute.mockResolvedValue({ source: "offline" });
      offline.calculateOfflineEvacuationRoute.mockResolvedValue({
        source: "offline",
      });
      await expect(
        kind === "route"
          ? fetchRoute(start, destination)
          : fetchEvacuationRoute(start),
      ).resolves.toMatchObject({ source: "offline" });
    },
  );
  it("deletes only the selected request with authorization and no caching", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetch);
    await expect(
      deleteAssistanceRequest("admin-token", "selected-id"),
    ).resolves.toBeUndefined();
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/admin/assistance-requests/selected-id"),
      expect.objectContaining({
        method: "DELETE",
        cache: "no-store",
        headers: { Authorization: "Bearer admin-token" },
      }),
    );
  });
  it.each([403, 404, 503])(
    "does not claim deletion on HTTP %s",
    async (status) => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          new Response(JSON.stringify({ error: "Delete failed" }), {
            status,
          }),
        ),
      );
      await expect(deleteAssistanceRequest("token", "id")).rejects.toThrow(
        "Delete failed",
      );
    },
  );
  it.each(["route", "evacuation"])(
    "preserves confirmed hazard failures for %s requests",
    async (kind) => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          new Response(
            JSON.stringify({
              warnings: ["No route"],
              failureReason: "HAZARD_BLOCKED",
            }),
            { status: 422 },
          ),
        ),
      );
      const call =
        kind === "route"
          ? fetchRoute(start, destination)
          : fetchEvacuationRoute(start);
      await expect(call).rejects.toMatchObject({
        name: "RoutingError",
        failureReason: "HAZARD_BLOCKED",
      });
      expect(offline.calculateOfflineRoute).not.toHaveBeenCalled();
      expect(offline.calculateOfflineEvacuationRoute).not.toHaveBeenCalled();
    },
  );
  it("does not offer hazard assistance for server/network failures", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: "Unavailable",
            failureReason: "HAZARD_BLOCKED",
          }),
          { status: 503 },
        ),
      ),
    );
    await expect(fetchRoute(start, destination)).rejects.toMatchObject({
      failureReason: undefined,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("Network error")),
    );
    await expect(fetchRoute(start, destination)).rejects.toBeInstanceOf(
      RoutingError,
    );
  });
  it("posts consent and personal details only to private intake, without caching", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ id: "request-id" }), { status: 201 }),
      );
    vi.stubGlobal("fetch", fetch);
    const body = {
      id: "request-id",
      submissionKey: "a".repeat(64),
      consent: true as const,
      start,
      destination,
      accuracy: 10,
      recordedAt: new Date().toISOString(),
      travelMode: "walking" as const,
      kind: "route" as const,
      name: "Test",
    };
    await expect(shareAssistanceLocation(body)).resolves.toEqual({
      id: "request-id",
    });
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/assistance-requests"),
      expect.objectContaining({
        method: "POST",
        cache: "no-store",
        body: JSON.stringify(body),
      }),
    );
  });
  it("does not claim success on a failed submission", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ error: "Not saved" }), { status: 503 }),
        ),
    );
    await expect(
      shareAssistanceLocation({
        id: "test",
        submissionKey: "a".repeat(64),
        consent: true,
        start,
        accuracy: 20,
        recordedAt: new Date().toISOString(),
        kind: "evacuation",
        travelMode: "walking",
      }),
    ).rejects.toThrow("Not saved");
  });
  it("uses authorization and no cache for dashboard polling", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ requests: [] })));
    vi.stubGlobal("fetch", fetch);
    await expect(fetchAssistanceRequests("test-token")).resolves.toEqual([]);
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/admin/assistance-requests"),
      expect.objectContaining({
        cache: "no-store",
        headers: { Authorization: "Bearer test-token" },
      }),
    );
  });
});
