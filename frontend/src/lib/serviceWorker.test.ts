import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

const source = readFileSync(new URL("../../public/sw.js", import.meta.url), "utf8");
function worker(cached?: Response) {
  const listeners: Record<string, (event: any) => void> = {};
  const cache = { match: vi.fn().mockResolvedValue(cached), put: vi.fn().mockResolvedValue(undefined), add: vi.fn().mockResolvedValue(undefined) };
  const fetch = vi.fn().mockResolvedValue(new Response("new build"));
  runInNewContext(source, {
    URL, fetch,
    caches: { open: vi.fn().mockResolvedValue(cache) },
    self: { location: { origin: "https://evacurosa.test" }, addEventListener: (name: string, fn: (event: any) => void) => { listeners[name] = fn; } },
  });
  function request(path: string, mode = "cors") {
    const respondWith = vi.fn();
    listeners.fetch({ request: { url: new URL(path, "https://evacurosa.test").href, method: "GET", mode }, respondWith });
    return respondWith;
  }
  async function prepare() {
    let pending: Promise<void> | undefined;
    const postMessage = vi.fn();
    listeners.message({ data: { type: "PREPARE_OFFLINE" }, ports: [{ postMessage }], waitUntil: (task: Promise<void>) => { pending = task; } });
    await pending;
    return postMessage;
  }
  return { request, fetch, cache, prepare };
}

describe("public app cache", () => {
  it("saves lazy map and routing worker files before reporting readiness", async () => {
    const w = worker();
    const assets = ["/_next/static/chunks/map.js", "/_next/static/chunks/routing.worker.js"];
    w.fetch.mockResolvedValue(new Response(JSON.stringify({ assets })));
    expect(await w.prepare()).toHaveBeenCalledWith({ ok: true });
    for (const path of [...assets, "/"]) expect(w.cache.add).toHaveBeenCalledWith(path);
    expect(w.cache.put).toHaveBeenCalledWith("/offline-assets.json", expect.any(Response));
  });
  it("does not claim readiness when an essential worker file fails to cache", async () => {
    const w = worker();
    w.fetch.mockResolvedValue(new Response(JSON.stringify({ assets: ["/_next/static/chunks/routing.worker.js"] })));
    w.cache.add.mockRejectedValue(new Error("Storage full"));
    expect(await w.prepare()).toHaveBeenCalledWith({ ok: false });
  });
  it("rejects manifests containing API or admin documents", async () => {
    const w = worker();
    w.fetch.mockResolvedValue(new Response(JSON.stringify({ assets: ["/api/roads", "/admin/login"] })));
    expect(await w.prepare()).toHaveBeenCalledWith({ ok: false });
    expect(w.cache.add).not.toHaveBeenCalled();
  });
  it("loads fresh page HTML instead of a previous build", async () => {
    const w = worker(new Response("old build"));
    const response = await w.request("/", "navigate").mock.calls[0][0];
    expect(await response.text()).toBe("new build");
    expect(w.cache.put).toHaveBeenCalled();
  });
  it("keeps the cached public page available offline", async () => {
    const w = worker(new Response("offline shell"));
    w.fetch.mockRejectedValue(new Error("offline"));
    const response = await w.request("/", "navigate").mock.calls[0][0];
    expect(await response.text()).toBe("offline shell");
  });
  it("never substitutes HTML for a missing JavaScript chunk", async () => {
    const w = worker();
    w.fetch.mockRejectedValue(new Error("offline"));
    await expect(w.request("/_next/static/chunks/map.js").mock.calls[0][0]).rejects.toThrow("offline");
  });
  it("reuses cached versioned assets", async () => {
    const w = worker(new Response("javascript"));
    const response = await w.request("/_next/static/chunks/map.js").mock.calls[0][0];
    expect(await response.text()).toBe("javascript");
    expect(w.fetch).not.toHaveBeenCalled();
  });
  it("leaves RSC, APIs, admin, hot updates and external map tiles alone", () => {
    const w = worker();
    for (const path of ["/?_rsc=123", "/api/roads", "/admin/login", "/_next/webpack-hmr", "https://tile.openstreetmap.org/12/1/1.png"]) {
      expect(w.request(path)).not.toHaveBeenCalled();
    }
  });
});
