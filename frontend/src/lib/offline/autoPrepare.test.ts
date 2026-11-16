import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { watchOfflinePreparation } from "./autoPrepare";
import type { OfflineStatus } from "./routing";

const ready: OfflineStatus = {
  state: "ready",
  mapReady: true,
  updatedAt: "2026-11-16T10:00:00.000Z",
};
let connection: { onLine: boolean };
let page: EventTarget & { visibilityState: string };
let stop: (() => void) | undefined;

beforeEach(() => {
  vi.useFakeTimers();
  connection = { onLine: true };
  page = Object.assign(new EventTarget(), { visibilityState: "visible" });
  vi.stubGlobal("window", new EventTarget());
  vi.stubGlobal("document", page);
  vi.stubGlobal("navigator", connection);
});
afterEach(() => {
  stop?.();
  stop = undefined;
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function fixture() {
  const prepare = vi
    .fn<
      (
        online: boolean,
        force: boolean,
        progress: (status: OfflineStatus) => void,
      ) => Promise<OfflineStatus>
    >()
    .mockResolvedValue(ready);
  const publish = vi.fn();
  return {
    prepare,
    publish,
    start() {
      stop = watchOfflinePreparation({ prepare, publish });
    },
  };
}
async function flush() {
  await Promise.resolve();
  await Promise.resolve();
}

describe("automatic offline preparation", () => {
  it("downloads on first open and refreshes after reconnect, even with a recent saved snapshot", async () => {
    const f = fixture();
    f.start();
    await flush();
    expect(f.prepare).toHaveBeenCalledWith(true, true, expect.any(Function));
    connection.onLine = false;
    window.dispatchEvent(new Event("offline"));
    await flush();
    expect(f.prepare).toHaveBeenLastCalledWith(
      false,
      false,
      expect.any(Function),
    );
    connection.onLine = true;
    window.dispatchEvent(new Event("online"));
    await flush();
    expect(f.prepare).toHaveBeenLastCalledWith(
      true,
      true,
      expect.any(Function),
    );
    expect(f.prepare).toHaveBeenCalledTimes(3);
  });

  it("loads the saved package offline without requesting a download", async () => {
    connection.onLine = false;
    const f = fixture();
    f.start();
    await flush();
    await vi.advanceTimersByTimeAsync(120000);
    expect(f.prepare).toHaveBeenCalledExactlyOnceWith(
      false,
      false,
      expect.any(Function),
    );
    expect(f.publish).toHaveBeenLastCalledWith(ready);
  });

  it.each<OfflineStatus>([
    { state: "unavailable" },
    { ...ready, mapReady: false },
    {
      ...ready,
      message: "Update failed. Using previously saved routing data.",
    },
  ])(
    "retries incomplete preparation with capped backoff: %j",
    async (status) => {
      const f = fixture();
      f.prepare.mockResolvedValue(status);
      f.start();
      await flush();
      for (const delay of [5000, 15000, 30000, 60000, 60000])
        await vi.advanceTimersByTimeAsync(delay);
      expect(f.prepare).toHaveBeenCalledTimes(6);
      f.prepare.mockResolvedValue(ready);
      await vi.advanceTimersByTimeAsync(60000);
      expect(f.prepare).toHaveBeenCalledTimes(7);
      await vi.advanceTimersByTimeAsync(180000);
      expect(f.prepare).toHaveBeenCalledTimes(7);
      expect(f.publish).toHaveBeenLastCalledWith(ready);
    },
  );

  it("retries a rejected preparation instead of leaving an unhandled promise", async () => {
    const f = fixture();
    f.prepare.mockRejectedValueOnce(new Error("Temporary failure"));
    f.start();
    await flush();
    expect(f.publish).toHaveBeenLastCalledWith({ state: "unavailable" });
    await vi.advanceTimersByTimeAsync(5000);
    expect(f.publish).toHaveBeenLastCalledWith(ready);
  });

  it("coalesces reconnect and focus events during a running download", async () => {
    const f = fixture();
    let finish!: (status: OfflineStatus) => void;
    f.prepare.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    f.start();
    window.dispatchEvent(new Event("online"));
    window.dispatchEvent(new Event("focus"));
    window.dispatchEvent(new Event("online"));
    expect(f.prepare).toHaveBeenCalledTimes(1);
    finish(ready);
    await flush();
    expect(f.prepare).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(120000);
    expect(f.prepare).toHaveBeenCalledTimes(2);
  });

  it("pauses retries in a hidden tab and resumes when the app is visible", async () => {
    const f = fixture();
    f.prepare.mockResolvedValueOnce({ state: "unavailable" });
    f.start();
    await flush();
    page.visibilityState = "hidden";
    await vi.advanceTimersByTimeAsync(5000);
    expect(f.prepare).toHaveBeenCalledTimes(1);
    page.visibilityState = "visible";
    page.dispatchEvent(new Event("visibilitychange"));
    await flush();
    expect(f.prepare).toHaveBeenCalledTimes(2);
    expect(f.publish).toHaveBeenLastCalledWith(ready);
  });

  it("refreshes on return after suspension but skips repeated focus events while current", async () => {
    const f = fixture();
    f.start();
    await flush();
    window.dispatchEvent(new Event("focus"));
    expect(f.prepare).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(60000);
    window.dispatchEvent(new Event("focus"));
    await flush();
    expect(f.prepare).toHaveBeenCalledTimes(2);
  });

  it("removes listeners and ignores late progress after the page unmounts", async () => {
    const f = fixture();
    let finish!: (status: OfflineStatus) => void;
    f.prepare.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    f.start();
    const progress = f.prepare.mock.calls[0][2];
    stop?.();
    progress({ state: "downloading" });
    finish({ state: "unavailable" });
    await flush();
    window.dispatchEvent(new Event("online"));
    window.dispatchEvent(new Event("focus"));
    page.dispatchEvent(new Event("visibilitychange"));
    await vi.advanceTimersByTimeAsync(120000);
    expect(f.prepare).toHaveBeenCalledTimes(1);
    expect(f.publish).not.toHaveBeenCalled();
  });
});
