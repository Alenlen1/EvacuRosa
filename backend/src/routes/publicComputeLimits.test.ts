import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import express from "express";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";

const handlers = vi.hoisted(() => ({ route: vi.fn(), preview: vi.fn() }));
vi.mock("../controllers/route.controller", () => ({
  postRoute: handlers.route,
}));
vi.mock("../controllers/evacuationRoute.controller", () => ({
  postEvacuationRoute: handlers.route,
}));
vi.mock("../controllers/road.controller", () => ({
  getNearestRoads: handlers.preview,
  getRoadSection: handlers.preview,
  getEarthquakeArea: handlers.preview,
}));
import { routeRouter } from "./route.routes";
import { evacuationRouteRouter } from "./evacuationRoute.routes";
import { roadRouter } from "./road.routes";
import { publicComputeLimiters } from "../middleware/publicComputeLimit.middleware";
import { parseTrustProxyHops } from "../config/environment";

describe("public computation limits on actual routers", () => {
  const app = express();
  let server: Server;
  let url: string;
  let client = 0;
  let ip: string;
  const request = (path = "/api/route", forwarded = ip) =>
    fetch(url + path, {
      method:
        path.startsWith("/api/roads") || path === "/api/health"
          ? "GET"
          : "POST",
      headers: { "X-Forwarded-For": forwarded },
    });
  beforeAll(async () => {
    handlers.route.mockImplementation((_req, res) => res.json({ route: [] }));
    handlers.preview.mockImplementation((_req, res) => res.json({ roads: [] }));
    app.use("/api/route", routeRouter);
    app.use("/api/evacuation-route", evacuationRouteRouter);
    app.use("/api/roads", roadRouter);
    app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
    await new Promise<void>((resolve) => {
      server = app.listen(0, "127.0.0.1", resolve);
    });
    url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  beforeEach(async () => {
    vi.useRealTimers();
    app.set("trust proxy", 1);
    ip = `192.0.2.${++client}`;
    handlers.route.mockClear();
    handlers.preview.mockClear();
    await publicComputeLimiters.routing.resetKey("127.0.0.1");
  });
  afterAll(async () => {
    vi.useRealTimers();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  });

  it("shares the route budget across both actions and blocks before handlers run", async () => {
    for (let i = 0; i < 60; i++)
      expect(
        (await request(i % 2 ? "/api/evacuation-route" : "/api/route")).status,
      ).toBe(200);
    const blocked = await request("/api/evacuation-route");
    expect(blocked.status).toBe(429);
    expect(await blocked.json()).toEqual({
      error: expect.stringContaining("Please wait"),
    });
    expect(Number(blocked.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(blocked.headers.get("Cache-Control")).toBe("no-store");
    expect(blocked.headers.get("RateLimit")).toContain("remaining=0");
    expect(handlers.route).toHaveBeenCalledTimes(60);
    expect((await request("/api/route", "198.51.100.1")).status).toBe(200);
    expect((await request("/api/roads/nearest")).status).toBe(200);
    expect((await request("/api/health")).status).toBe(200);
  });

  it("shares a separate road-preview budget across all three preview endpoints", async () => {
    const paths = [
      "/api/roads/nearest",
      "/api/roads/section",
      "/api/roads/earthquake-area",
    ];
    for (let i = 0; i < 120; i++)
      expect((await request(paths[i % 3])).status).toBe(200);
    for (const path of paths) expect((await request(path)).status).toBe(429);
    expect(handlers.preview).toHaveBeenCalledTimes(120);
    expect((await request()).status).toBe(200);
  });

  it("does not let forged forwarded headers bypass limits on direct localhost", async () => {
    app.set("trust proxy", parseTrustProxyHops());
    for (let i = 0; i < 60; i++)
      expect((await request("/api/route", `192.0.2.${i + 1}`)).status).toBe(
        200,
      );
    expect((await request("/api/route", "203.0.113.99")).status).toBe(429);
  });

  it("uses the nearest untrusted address with one proxy, not spoofed leftmost entries", async () => {
    for (let i = 0; i < 60; i++)
      expect(
        (await request("/api/route", `198.51.100.${i + 1}, ${ip}`)).status,
      ).toBe(200);
    expect((await request("/api/route", `203.0.113.99, ${ip}`)).status).toBe(
      429,
    );
  });

  it("groups IPv6 address rotation within a subnet", async () => {
    for (let i = 0; i < 60; i++)
      expect(
        (await request("/api/route", "2001:db8:1234:5600::1")).status,
      ).toBe(200);
    expect(
      (await request("/api/route", "2001:db8:1234:56ff::abcd")).status,
    ).toBe(429);
    expect((await request("/api/route", "2001:db8:1234:5700::1")).status).toBe(
      200,
    );
  });

  it("allows retry after the window expires and does not count CORS preflight", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-01T00:00:00Z"));
    for (let i = 0; i < 60; i++) expect((await request()).status).toBe(200);
    expect((await request()).status).toBe(429);
    expect(
      (
        await fetch(url + "/api/route", {
          method: "OPTIONS",
          headers: { "X-Forwarded-For": ip },
        })
      ).status,
    ).toBe(200);
    vi.setSystemTime(new Date("2026-11-01T00:01:01Z"));
    expect((await request()).status).toBe(200);
  });

  it.each(["true", "-1", "6", "1.5", "", "NaN"])(
    "rejects unsafe proxy hop configuration %s",
    (value) => {
      expect(() => parseTrustProxyHops(value)).toThrow("TRUST_PROXY_HOPS");
    },
  );
});
