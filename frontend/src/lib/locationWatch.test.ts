import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  watchDeviceLocation,
  LOCATION_CHECK_INTERVAL_MS,
  LOCATION_CHECK_TIMEOUT_MS,
  LOCATION_MAX_AGE_MS,
  LOCATION_REQUEST_DEADLINE_MS,
} from "./locationWatch";
import type { GeolocationState } from "@/hooks/useGeolocation";

function setup(permissionState?: PermissionState, withProbe = true) {
  const page = Object.assign(new EventTarget(), {
    visibilityState: "visible" as DocumentVisibilityState,
  });
  const lifecycle = new EventTarget();
  const permission = Object.assign(new EventTarget(), {
    state: permissionState ?? "granted",
  });
  const watches: { success: PositionCallback; error: PositionErrorCallback }[] =
    [];
  const probes: { success: PositionCallback; error: PositionErrorCallback }[] =
    [];
  const geolocation = {
    watchPosition: vi.fn(
      (success: PositionCallback, error?: PositionErrorCallback | null) => {
        watches.push({ success, error: error! });
        return watches.length;
      },
    ),
    clearWatch: vi.fn(),
    ...(withProbe
      ? {
          getCurrentPosition: vi.fn(
            (
              success: PositionCallback,
              error?: PositionErrorCallback | null,
            ) => {
              probes.push({ success, error: error! });
            },
          ),
        }
      : {}),
  };
  let state: GeolocationState | null = null;
  const update = vi.fn((value: GeolocationState) => {
    state = value;
  });
  const watcher = watchDeviceLocation(update, {
    geolocation,
    page,
    lifecycle,
    permissions: permissionState
      ? { query: vi.fn().mockResolvedValue(permission) }
      : undefined,
  });
  const position = (timestamp = Date.now()) =>
    ({
      timestamp,
      coords: {
        latitude: 14.3,
        longitude: 121.1,
        accuracy: 10,
        heading: null,
        speed: null,
      },
    }) as GeolocationPosition;
  const error = (code: number) =>
    watches.at(-1)!.error({ code } as GeolocationPositionError);
  const success = () => watches.at(-1)!.success(position());
  const returnFromSettings = () => {
    page.visibilityState = "hidden";
    page.dispatchEvent(new Event("visibilitychange"));
    page.visibilityState = "visible";
    page.dispatchEvent(new Event("visibilitychange"));
    lifecycle.dispatchEvent(new Event("focus"));
  };
  return {
    page,
    lifecycle,
    permission,
    geolocation,
    watches,
    probes,
    watcher,
    error,
    success,
    position,
    returnFromSettings,
    update,
    state: () => state!,
  };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("mobile location recovery", () => {
  it("handles No thanks followed by a second attempt timing out, with retry still available", () => {
    const s = setup();
    s.error(1);
    s.watcher.retry();
    s.error(3);
    expect(s.state().status).toBe("unavailable");
    expect(s.state().error).toContain("Check Location Services");
    expect(s.state().error).not.toContain("timed out");
    s.watcher.retry();
    s.success();
    expect(s.state().status).toBe("active");
    s.watcher.dispose();
  });
  it("does not automatically reopen native prompts after denial or timeout", () => {
    const s = setup();
    s.error(1);
    vi.advanceTimersByTime(60_000);
    s.lifecycle.dispatchEvent(new Event("focus"));
    expect(s.watches).toHaveLength(1);
    s.watcher.retry();
    s.error(3);
    vi.advanceTimersByTime(60_000);
    s.lifecycle.dispatchEvent(new Event("focus"));
    expect(s.watches).toHaveLength(2);
    s.watcher.dispose();
  });
  it("restores unavailable state when location is silently switched off after a successful fix", () => {
    const s = setup();
    s.success();
    vi.advanceTimersByTime(LOCATION_CHECK_INTERVAL_MS);
    expect(s.probes).toHaveLength(1);
    s.probes[0].error({ code: 3 } as GeolocationPositionError);
    expect(s.state().status).toBe("unavailable");
    expect(s.state().position).toBeNull();
    s.watcher.retry();
    s.success();
    expect(s.state().status).toBe("active");
    s.watcher.dispose();
  });
  it("bounds silent loss even when the freshness probe never invokes either callback", () => {
    const s = setup();
    s.success();
    vi.advanceTimersByTime(
      LOCATION_CHECK_INTERVAL_MS + LOCATION_CHECK_TIMEOUT_MS,
    );
    expect(s.state().status).toBe("unavailable");
    expect(s.state().position).toBeNull();
    s.watcher.dispose();
  });
  it("refreshes a stationary user's location without declaring it lost", () => {
    const s = setup();
    s.success();
    for (let i = 0; i < 3; i++) {
      vi.advanceTimersByTime(LOCATION_CHECK_INTERVAL_MS);
      s.probes.at(-1)!.success(s.position());
      expect(s.state().status).toBe("active");
    }
    expect(s.watches).toHaveLength(1);
    s.watcher.dispose();
  });
  it("does not accept an old cached position as proof that location is still enabled", () => {
    const s = setup();
    s.success();
    vi.advanceTimersByTime(LOCATION_CHECK_INTERVAL_MS);
    s.probes[0].success(s.position(Date.now() - LOCATION_MAX_AGE_MS - 1));
    expect(s.state().status).toBe("unavailable");
    expect(s.state().position).toBeNull();
    s.watcher.dispose();
  });
  it("keeps a newer watch success when an older freshness check fails later", () => {
    const s = setup();
    s.success();
    vi.advanceTimersByTime(LOCATION_CHECK_INTERVAL_MS);
    const old = s.probes[0];
    s.success();
    old.error({ code: 3 } as GeolocationPositionError);
    vi.advanceTimersByTime(LOCATION_CHECK_TIMEOUT_MS);
    expect(s.state().status).toBe("active");
    s.watcher.dispose();
  });
  it("expires a silent location when the freshness-probe API is unavailable", () => {
    const s = setup(undefined, false);
    s.success();
    vi.advanceTimersByTime(LOCATION_MAX_AGE_MS);
    expect(s.state().status).toBe("unavailable");
    s.watcher.dispose();
  });
  it("checks immediately after settings return without requiring a page reload", () => {
    const s = setup();
    s.success();
    s.returnFromSettings();
    expect(s.state().position).toBeNull();
    expect(s.watches).toHaveLength(2);
    s.error(2);
    expect(s.state().status).toBe("unavailable");
    s.returnFromSettings();
    s.success();
    expect(s.state().status).toBe("active");
    s.watcher.dispose();
  });
  it("recovers immediately when blocked permission becomes granted", async () => {
    const s = setup("denied");
    await Promise.resolve();
    expect(s.state().status).toBe("denied");
    s.permission.state = "granted";
    s.permission.dispatchEvent(new Event("change"));
    s.success();
    expect(s.state().status).toBe("active");
    s.watcher.dispose();
  });
  it("clears a valid position when permission is revoked", async () => {
    const s = setup("granted");
    await Promise.resolve();
    s.success();
    s.permission.state = "denied";
    s.permission.dispatchEvent(new Event("change"));
    expect(s.state().status).toBe("denied");
    expect(s.state().position).toBeNull();
    s.watcher.dispose();
  });
  it("does not reset an acquisition or clear an active fix on focus", () => {
    const s = setup();
    vi.advanceTimersByTime(5_000);
    s.lifecycle.dispatchEvent(new Event("focus"));
    expect(s.watches).toHaveLength(1);
    s.success();
    s.lifecycle.dispatchEvent(new Event("focus"));
    expect(s.watches).toHaveLength(1);
    expect(s.state().position).not.toBeNull();
    s.watcher.dispose();
  });
  it("unlocks retry when an acquisition or dismissed system dialog never returns", () => {
    const s = setup();
    vi.advanceTimersByTime(LOCATION_REQUEST_DEADLINE_MS);
    expect(s.state().status).toBe("unavailable");
    s.watcher.retry();
    s.success();
    expect(s.state().status).toBe("active");
    s.watcher.dispose();
  });
  it("ignores old native callbacks after a new manual attempt", () => {
    const s = setup();
    const old = s.watches[0];
    s.error(1);
    s.watcher.retry();
    old.error({ code: 3 } as GeolocationPositionError);
    expect(s.state().status).toBe("locating");
    s.success();
    expect(s.state().status).toBe("active");
    s.watcher.dispose();
  });
  it("stops checks in the background and cleans up pending timers and listeners", () => {
    const s = setup();
    s.success();
    vi.advanceTimersByTime(LOCATION_CHECK_INTERVAL_MS);
    s.page.visibilityState = "hidden";
    s.page.dispatchEvent(new Event("visibilitychange"));
    s.probes[0].error({ code: 3 } as GeolocationPositionError);
    vi.advanceTimersByTime(60_000);
    expect(s.state().status).toBe("active");
    s.watcher.dispose();
    s.page.visibilityState = "visible";
    s.lifecycle.dispatchEvent(new Event("focus"));
    expect(s.watches).toHaveLength(1);
    expect(s.probes).toHaveLength(1);
  });
  it("does not attach permission listeners after unmount", async () => {
    const s = setup("granted");
    s.watcher.dispose();
    await Promise.resolve();
    s.permission.dispatchEvent(new Event("change"));
    expect(s.watches).toHaveLength(1);
  });
});
