import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";
import { DEVELOPMENT_WORKER_RESET } from "./developmentWorkerReset";

function browser(controlled: boolean, recovered = false) {
  const unregister = vi.fn().mockResolvedValue(true);
  const otherUnregister = vi.fn();
  const context = {
    URL, console,
    navigator: { serviceWorker: {
      controller: controlled ? { scriptURL: "http://localhost:3000/sw.js" } : null,
      getRegistrations: vi.fn().mockResolvedValue([
        { active: { scriptURL: "http://localhost:3000/sw.js" }, unregister },
        { active: { scriptURL: "http://localhost:3000/other.js" }, unregister: otherUnregister },
      ]),
    } },
    window: { caches: {} },
    caches: { keys: vi.fn().mockResolvedValue(["evacurosa-shell-v3", "other-data"]), delete: vi.fn().mockResolvedValue(true) },
    location: { origin: "http://localhost:3000", reload: vi.fn() },
    sessionStorage: { getItem: vi.fn().mockReturnValue(recovered ? "1" : null), setItem: vi.fn(), removeItem: vi.fn() },
  };
  return { context, unregister, otherUnregister };
}

describe("pre-hydration development worker recovery", () => {
  it("removes only app workers/caches and reloads a controlled page once", async () => {
    const b = browser(true);
    await runInNewContext(DEVELOPMENT_WORKER_RESET, b.context);
    expect(b.unregister).toHaveBeenCalledOnce();
    expect(b.otherUnregister).not.toHaveBeenCalled();
    expect(b.context.caches.delete).toHaveBeenCalledExactlyOnceWith("evacurosa-shell-v3");
    expect(b.context.location.reload).toHaveBeenCalledOnce();
  });
  it("does not reload normal pages or loop on a persistent controller", async () => {
    for (const b of [browser(false), browser(true, true)]) {
      await runInNewContext(DEVELOPMENT_WORKER_RESET, b.context);
      expect(b.context.location.reload).not.toHaveBeenCalled();
    }
  });
});
