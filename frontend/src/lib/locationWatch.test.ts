import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { watchDeviceLocation } from "./locationWatch";
import type { GeolocationState } from "@/hooks/useGeolocation";

function setup(permissionState?: PermissionState) {
  const page = Object.assign(new EventTarget(), { visibilityState: "visible" as DocumentVisibilityState });
  const lifecycle = new EventTarget();
  const permission = Object.assign(new EventTarget(), { state: permissionState ?? "granted" });
  const callbacks: { success: PositionCallback; error: PositionErrorCallback }[] = [];
  const geolocation = {
    watchPosition: vi.fn((success: PositionCallback, error?: PositionErrorCallback | null) => {
      callbacks.push({ success, error: error! }); return callbacks.length;
    }),
    clearWatch: vi.fn(),
  };
  let state: GeolocationState | null = null;
  const update = vi.fn((value: GeolocationState) => { state = value; });
  const watcher = watchDeviceLocation(update, { geolocation, page, lifecycle,
    permissions: permissionState ? { query: vi.fn().mockResolvedValue(permission) } : undefined,
  });
  const error = (code: number) => callbacks.at(-1)!.error({ code } as GeolocationPositionError);
  const success = () => callbacks.at(-1)!.success({ timestamp: 123,
    coords: { latitude: 14.3, longitude: 121.1, accuracy: 10, heading: null, speed: null },
  } as GeolocationPosition);
  return { page, lifecycle, permission, geolocation, callbacks, watcher, error, success, update, state: () => state! };
}
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("mobile location recovery", () => {
  it("keeps an active location through focus and permission-dialog events", async () => {
    const s = setup("granted"); await Promise.resolve(); s.success();
    vi.advanceTimersByTime(5_000);
    s.lifecycle.dispatchEvent(new Event("focus"));
    s.lifecycle.dispatchEvent(new Event("pageshow"));
    s.permission.dispatchEvent(new Event("change"));
    expect(s.geolocation.watchPosition).toHaveBeenCalledTimes(1);
    expect(s.state().status).toBe("active"); expect(s.state().position).not.toBeNull();
    s.watcher.dispose();
  });
  it("does not restart an acquisition when focus arrives several seconds later", () => {
    const s = setup(); vi.advanceTimersByTime(5_000);
    s.lifecycle.dispatchEvent(new Event("focus"));
    expect(s.geolocation.watchPosition).toHaveBeenCalledTimes(1);
    s.watcher.dispose();
  });
  it("does not repeatedly request denied access when permission querying is unsupported", () => {
    const s = setup(); s.error(1); vi.advanceTimersByTime(60_000);
    s.lifecycle.dispatchEvent(new Event("focus"));
    s.lifecycle.dispatchEvent(new Event("pageshow"));
    expect(s.geolocation.watchPosition).toHaveBeenCalledTimes(1);
    s.watcher.retry(); s.success(); expect(s.state().status).toBe("active");
    s.watcher.dispose();
  });
  it("recovers an OS location-switch error on returning, without repeating the OS prompt", async () => {
    const s = setup("granted"); await Promise.resolve(); s.error(1);
    vi.advanceTimersByTime(15_000);
    s.lifecycle.dispatchEvent(new Event("focus"));
    expect(s.geolocation.watchPosition).toHaveBeenCalledTimes(1);
    s.page.visibilityState = "hidden"; s.page.dispatchEvent(new Event("visibilitychange"));
    s.page.visibilityState = "visible"; s.page.dispatchEvent(new Event("visibilitychange"));
    expect(s.geolocation.watchPosition).toHaveBeenCalledTimes(2);
    s.success(); expect(s.state().status).toBe("active"); s.watcher.dispose();
  });
  it("recovers after returning from settings without a Permissions API", () => {
    const s = setup(); s.error(1);
    s.page.visibilityState = "hidden"; s.page.dispatchEvent(new Event("visibilitychange"));
    vi.advanceTimersByTime(100);
    s.page.visibilityState = "visible"; s.page.dispatchEvent(new Event("visibilitychange"));
    s.lifecycle.dispatchEvent(new Event("focus"));
    expect(s.geolocation.watchPosition).toHaveBeenCalledTimes(2);
    s.success(); expect(s.state().status).toBe("active"); expect(s.state().error).toBeNull();
    s.watcher.dispose();
  });
  it("recovers immediately when a blocked permission becomes granted", async () => {
    const s = setup("denied"); await Promise.resolve();
    expect(s.state().status).toBe("denied");
    vi.advanceTimersByTime(60_000);
    expect(s.geolocation.watchPosition).toHaveBeenCalledTimes(1);
    s.permission.state = "granted"; s.permission.dispatchEvent(new Event("change"));
    s.success(); expect(s.state().status).toBe("active"); s.watcher.dispose();
  });
  it("retries unavailable GPS automatically and ignores old watch callbacks", () => {
    const s = setup(); const old = s.callbacks[0]; s.error(2);
    vi.advanceTimersByTime(15_000);
    expect(s.geolocation.clearWatch).toHaveBeenCalledWith(1);
    old.error({ code: 1 } as GeolocationPositionError);
    expect(s.state().status).toBe("locating");
    s.success(); vi.advanceTimersByTime(60_000);
    expect(s.geolocation.watchPosition).toHaveBeenCalledTimes(2); s.watcher.dispose();
  });
  it("clears an old location after a timeout and supports an explicit retry", () => {
    const s = setup(); s.success(); s.error(3);
    expect(s.state().position).toBeNull();
    s.watcher.retry(); s.success(); expect(s.state().status).toBe("active"); s.watcher.dispose();
  });
  it("revocation removes the old position and prevents repeated permission requests", async () => {
    const s = setup("granted"); await Promise.resolve(); s.success();
    s.permission.state = "denied"; s.permission.dispatchEvent(new Event("change"));
    expect(s.state().position).toBeNull();
    s.lifecycle.dispatchEvent(new Event("focus")); vi.advanceTimersByTime(60_000);
    expect(s.geolocation.watchPosition).toHaveBeenCalledTimes(1); s.watcher.dispose();
  });
  it("does not retry in the background and cleans up listeners and timers", () => {
    const s = setup(); s.error(2);
    s.page.visibilityState = "hidden"; s.page.dispatchEvent(new Event("visibilitychange"));
    vi.advanceTimersByTime(60_000); expect(s.geolocation.watchPosition).toHaveBeenCalledTimes(1);
    s.watcher.dispose(); s.page.visibilityState = "visible";
    s.lifecycle.dispatchEvent(new Event("focus")); s.page.dispatchEvent(new Event("visibilitychange"));
    vi.advanceTimersByTime(60_000); expect(s.geolocation.watchPosition).toHaveBeenCalledTimes(1);
  });
  it("does not attach permission listeners after unmount", async () => {
    const s = setup("granted"); s.watcher.dispose(); await Promise.resolve();
    s.permission.dispatchEvent(new Event("change")); expect(s.geolocation.watchPosition).toHaveBeenCalledTimes(1);
  });
  it("does not repeatedly reopen a dismissed browser permission prompt", async () => {
    const s = setup("prompt"); await Promise.resolve(); s.error(1);
    vi.advanceTimersByTime(60_000);
    expect(s.geolocation.watchPosition).toHaveBeenCalledTimes(1);
    s.watcher.retry(); expect(s.geolocation.watchPosition).toHaveBeenCalledTimes(2);
    s.watcher.dispose();
  });
});
