import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import express from "express";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";

const data = vi.hoisted(() => ({
  nodes: [{ id: "A", latitude: 14.3, longitude: 121.1 }],
  edges: [],
}));
vi.mock("../services/road.service", () => ({ loadRoadGraphData: () => data }));
import { offlineRouter } from "./offline.routes";

describe("compressed offline graph delivery", () => {
  let server: Server;
  let url: string;
  beforeAll(async () => {
    const app = express();
    app.use(offlineRouter);
    await new Promise<void>((resolve, reject) => {
      server = app.listen(0, "127.0.0.1", (error) =>
        error ? reject(error) : resolve(),
      );
    });
    url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/graph`;
  });
  afterAll(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  });
  it.each(["gzip", "identity"])(
    "delivers the same versioned graph with %s encoding",
    async (encoding) => {
      const response = await fetch(url, {
        headers: { "Accept-Encoding": encoding },
      });
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain(
        "application/json",
      );
      expect(response.headers.get("content-encoding")).toBe(
        encoding === "gzip" ? "gzip" : null,
      );
      const body = (await response.json()) as {
        version: string;
        data: typeof data;
      };
      expect(body.data).toEqual(data);
      expect(response.headers.get("etag")).toBe(`"${body.version}"`);
      const unchanged = await fetch(url, {
        headers: { "If-None-Match": `"${body.version}"` },
      });
      expect(unchanged.status).toBe(304);
      expect(await unchanged.text()).toBe("");
    },
  );
});
