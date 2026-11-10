import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

const source = readFileSync(new URL("../../../public/sw.js", import.meta.url), "utf8");
const origin = "https://example.test";
const workerURL = `${origin}/_next/static/chunks/worker.js#params=entry-chunks`;

function response(url: string) {
  const result = new Response("worker bootstrap", {
    headers: { "Content-Type": "application/javascript" },
  });
  // Cache API responses retain the URL they were originally fetched from.
  Object.defineProperty(result, "url", { value: url });
  return result;
}

async function serve(destination: string, cached: Response | null, online: boolean) {
  const handlers = new Map<string, (event: unknown) => void>();
  const networkResponse = response(workerURL.split("#")[0]);
  const fetch = vi.fn(async () => {
    if (!online) throw new Error("Offline");
    return networkResponse;
  });
  const cache = { match: async () => cached, put: vi.fn(async () => {}) };
  runInNewContext(source, {
    self: {
      location: { origin },
      addEventListener: (name: string, handler: (event: unknown) => void) =>
        handlers.set(name, handler),
    },
    caches: { open: async () => cache },
    fetch,
    Response,
    URL,
  });
  let result!: Promise<Response>;
  handlers.get("fetch")!({
    request: { url: workerURL, method: "GET", mode: "same-origin", destination },
    respondWith: (value: Promise<Response>) => { result = value; },
  });
  return { result: await result, fetch, networkResponse };
}

describe("offline worker bootstrap URLs", () => {
  it.each(["worker", "sharedworker"])(
    "keeps the original %s URL fragment when serving a cached bootstrap offline",
    async (destination) => {
      const cached = response(workerURL.split("#")[0]);
      const { result, fetch } = await serve(destination, cached, false);
      // Empty Response.url lets the browser retain workerURL, including params.
      expect(result.url).toBe("");
      expect(await result.text()).toBe("worker bootstrap");
      expect(result.headers.get("Content-Type")).toBe("application/javascript");
      expect(fetch).not.toHaveBeenCalled();
    },
  );

  it("also preserves the original worker URL on an online cache miss", async () => {
    const { result, fetch } = await serve("worker", null, true);
    expect(result.url).toBe("");
    expect(await result.text()).toBe("worker bootstrap");
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("leaves ordinary cached JavaScript responses unchanged", async () => {
    const cached = response(workerURL.split("#")[0]);
    const { result } = await serve("script", cached, false);
    expect(result).toBe(cached);
    expect(result.url).toBe(workerURL.split("#")[0]);
  });
});
