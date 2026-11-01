import { afterEach, describe, expect, it, vi } from "vitest";
import {
  publicRoutingSignature,
  watchPublicRouting,
} from "./publicRoutingSync";

function fixture() {
  vi.useFakeTimers();
  let changed = () => {};
  let reconnect = () => {};
  const load = vi
    .fn<() => Promise<{ data: string; fresh: boolean }>>()
    .mockResolvedValue({ data: "open", fresh: true });
  const publish = vi.fn(),
    invalidate = vi.fn(),
    failed = vi.fn(),
    unsubscribe = vi.fn();
  const available = vi.fn(() => true);
  const watcher = watchPublicRouting({
    load,
    signature: (value) => value,
    publish,
    invalidate,
    failed,
    available,
    subscribe(change, resume) {
      changed = change;
      reconnect = resume;
      return unsubscribe;
    },
  });
  return {
    load,
    publish,
    invalidate,
    failed,
    available,
    unsubscribe,
    watcher,
    changed: () => changed(),
    reconnect: () => reconnect(),
  };
}
const flush = () => vi.advanceTimersByTimeAsync(0);
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe("public routing hazard updates", () => {
  it("invalidates immediately and coalesces realtime bursts before publishing fresh hazards", async () => {
    const f = fixture();
    await flush();
    f.load.mockResolvedValue({ data: "blocked", fresh: true });
    f.changed();
    f.changed();
    f.changed();
    expect(f.invalidate).toHaveBeenCalledTimes(3);
    expect(f.publish).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(200);
    expect(f.load).toHaveBeenCalledTimes(2);
    expect(f.publish).toHaveBeenLastCalledWith("blocked", true);
    f.watcher.stop();
  });
  it("detects a blockage through fallback polling without realtime", async () => {
    const f = fixture();
    await flush();
    f.load.mockResolvedValue({ data: "blocked", fresh: true });
    await vi.advanceTimersByTimeAsync(15000);
    expect(f.invalidate).toHaveBeenCalledOnce();
    expect(f.publish).toHaveBeenLastCalledWith("blocked", true);
    await vi.advanceTimersByTimeAsync(15000);
    expect(f.invalidate).toHaveBeenCalledOnce();
    expect(f.publish).toHaveBeenLastCalledWith("blocked", false);
    f.watcher.stop();
  });
  it("discards an older snapshot when a change arrives during its fetch", async () => {
    const f = fixture();
    await flush();
    let finish!: (value: { data: string; fresh: boolean }) => void;
    f.load.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    await vi.advanceTimersByTimeAsync(15000);
    f.changed();
    f.load.mockResolvedValue({ data: "blocked", fresh: true });
    await vi.advanceTimersByTimeAsync(200);
    finish({ data: "outdated", fresh: true });
    await flush();
    expect(f.publish.mock.calls.map((call) => call[0])).toEqual([
      "open",
      "blocked",
    ]);
    expect(f.publish).toHaveBeenLastCalledWith("blocked", true);
    f.watcher.stop();
  });
  it("does not verify a changed route from cached hazards and retries after failure", async () => {
    const f = fixture();
    await flush();
    f.load.mockResolvedValue({ data: "old cache", fresh: false });
    f.changed();
    await vi.advanceTimersByTimeAsync(200);
    expect(f.failed).toHaveBeenCalledOnce();
    expect(f.publish).toHaveBeenCalledTimes(1);
    f.load.mockResolvedValue({ data: "open", fresh: true });
    await vi.advanceTimersByTimeAsync(15000);
    expect(f.publish).toHaveBeenLastCalledWith("open", true);
    f.watcher.stop();
  });
  it("survives a failed fetch and rechecks after reconnect", async () => {
    const f = fixture();
    await flush();
    f.load.mockRejectedValueOnce(new Error("offline"));
    f.changed();
    await vi.advanceTimersByTimeAsync(200);
    expect(f.failed).toHaveBeenCalledOnce();
    f.reconnect();
    await vi.advanceTimersByTimeAsync(200);
    expect(f.publish).toHaveBeenLastCalledWith("open", true);
    f.watcher.stop();
  });
  it("skips background polling when unavailable and cleans up subscriptions", async () => {
    const f = fixture();
    await flush();
    f.available.mockReturnValue(false);
    await vi.advanceTimersByTimeAsync(30000);
    expect(f.load).toHaveBeenCalledTimes(1);
    f.watcher.stop();
    f.changed();
    await vi.advanceTimersByTimeAsync(30000);
    expect(f.load).toHaveBeenCalledTimes(1);
    expect(f.unsubscribe).toHaveBeenCalledOnce();
  });
  it("never publishes a response completed after unmount", async () => {
    const f = fixture();
    await flush();
    let finish!: (value: { data: string; fresh: boolean }) => void;
    f.load.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    await vi.advanceTimersByTimeAsync(15000);
    f.watcher.stop();
    finish({ data: "late", fresh: true });
    await flush();
    expect(f.publish).toHaveBeenCalledTimes(1);
    expect(f.failed).not.toHaveBeenCalled();
  });
  it("does not treat a different database row order as a hazard change", () => {
    expect(publicRoutingSignature([[{ id: "a" }, { id: "b" }]])).toBe(
      publicRoutingSignature([[{ id: "b" }, { id: "a" }]]),
    );
  });
});
