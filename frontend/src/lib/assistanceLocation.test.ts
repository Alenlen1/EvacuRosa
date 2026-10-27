import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GeolocationState } from "@/hooks/useGeolocation";
import {
  ASSISTANCE_LOCATION_TIMEOUT_MS,
  captureAssistanceLocation,
  recentAssistanceLocation,
} from "./assistanceLocation";

const now = Date.parse("2026-10-27T10:00:00Z");
const cached = (age = 5_000): GeolocationState => ({
  status: "active",
  error: null,
  position: {
    latitude: 14.3,
    longitude: 121.1,
    accuracy: 198,
    timestamp: now - age,
    heading: null,
    speed: null,
  },
});

function device() {
  let success!: PositionCallback;
  let failure!: PositionErrorCallback;
  const geolocation = {
    getCurrentPosition: vi.fn(
      (
        next: PositionCallback,
        fail?: PositionErrorCallback | null,
        _options?: PositionOptions,
      ) => {
        success = next;
        failure = fail!;
      },
    ),
  };
  const position = (latitude = 14.31) =>
    ({
      timestamp: now,
      coords: { latitude, longitude: 121.12, accuracy: 12 },
    }) as GeolocationPosition;
  return {
    geolocation,
    success: (value = position()) => success(value),
    failure: (code: number) => failure({ code } as GeolocationPositionError),
    position,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(now);
});
afterEach(() => vi.useRealTimers());

describe("assistance location capture", () => {
  it("reuses a recent active map reading without another location request and preserves its age and accuracy", async () => {
    const d = device();
    const result = await captureAssistanceLocation({
      cached: cached(),
      geolocation: d.geolocation,
      signal: new AbortController().signal,
    });
    expect(d.geolocation.getCurrentPosition).not.toHaveBeenCalled();
    expect(result.source).toBe("map");
    expect(result.fix.recordedAt).toBe(new Date(now - 5_000).toISOString());
    expect(result.fix.accuracy).toBe(198);
  });
  it.each([10_001, -1, Infinity])(
    "does not reuse a reading with an invalid age of %s ms",
    (age) => {
      expect(recentAssistanceLocation(cached(age))).toBeNull();
    },
  );
  it("does not reuse a reading after the map reports location unavailable", () => {
    expect(
      recentAssistanceLocation({ ...cached(), status: "unavailable" }),
    ).toBeNull();
  });
  it("rejects invalid coordinates even when the map reading is recent", () => {
    const state = cached();
    state.position!.latitude = 95;
    expect(recentAssistanceLocation(state)).toBeNull();
    state.position!.latitude = 14.3;
    state.position!.accuracy = -1;
    expect(recentAssistanceLocation(state)).toBeNull();
  });
  it("gets a new device reading when the map reading is too old", async () => {
    const d = device();
    const result = captureAssistanceLocation({
      cached: cached(15_000),
      geolocation: d.geolocation,
      signal: new AbortController().signal,
    });
    d.success();
    expect((await result).source).toBe("device");
    expect(d.geolocation.getCurrentPosition).toHaveBeenCalledOnce();
  });
  it("the fresh-location action bypasses a valid cached reading", async () => {
    const d = device();
    const result = captureAssistanceLocation({
      cached: cached(),
      forceFresh: true,
      geolocation: d.geolocation,
      signal: new AbortController().signal,
    });
    d.success();
    expect((await result).fix.latitude).toBe(14.31);
    expect(d.geolocation.getCurrentPosition.mock.calls[0][2]).toMatchObject({
      maximumAge: 0,
      enableHighAccuracy: true,
    });
  });
  it("stops waiting after the deadline even if the browser never calls back", async () => {
    const d = device();
    const result = captureAssistanceLocation({
      geolocation: d.geolocation,
      signal: new AbortController().signal,
    });
    const rejection = expect(result).rejects.toThrow("taking too long");
    await vi.advanceTimersByTimeAsync(ASSISTANCE_LOCATION_TIMEOUT_MS);
    await rejection;
    d.success();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("ignores a device result that arrives after the user stops the capture", async () => {
    const d = device(),
      abort = new AbortController();
    const result = captureAssistanceLocation({
      geolocation: d.geolocation,
      signal: abort.signal,
    });
    const rejection = expect(result).rejects.toMatchObject({
      name: "AbortError",
    });
    abort.abort();
    d.success();
    await rejection;
    expect(vi.getTimerCount()).toBe(0);
  });
  it("does not start a capture if the signal is already aborted", async () => {
    const d = device(),
      abort = new AbortController();
    abort.abort();
    await expect(
      captureAssistanceLocation({
        cached: cached(),
        geolocation: d.geolocation,
        signal: abort.signal,
      }),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(d.geolocation.getCurrentPosition).not.toHaveBeenCalled();
  });
  it("shows a permission error without waiting for the deadline", async () => {
    const d = device();
    const result = captureAssistanceLocation({
      geolocation: d.geolocation,
      signal: new AbortController().signal,
    });
    d.failure(1);
    await expect(result).rejects.toThrow("permission was denied");
    expect(vi.getTimerCount()).toBe(0);
  });
});
