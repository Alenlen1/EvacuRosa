import { afterEach, describe, expect, it, vi } from "vitest";
import { coordinateLabel, createReverseGeocoder, formatPhotonLabel } from "./reverseGeocoding";

const response = { features: [{ properties: { name: "Rizal Boulevard", street: "Rizal Boulevard", city: "Santa Rosa", state: "Laguna" } }] };
const ok = () => new Response(JSON.stringify(response));

afterEach(() => { vi.useRealTimers(); });

describe("destination labels", () => {
  it("uses a short label without duplicating the street", () => {
    expect(formatPhotonLabel(response)).toEqual({ title: "Rizal Boulevard", subtitle: "Santa Rosa, Laguna", source: "photon" });
  });

  it("rejects missing and malformed names and formats the coordinate fallback", () => {
    for (const value of [null, {}, { features: [] }, { features: [{ properties: { name: 123 } }] }]) {
      expect(formatPhotonLabel(value)).toBeNull();
    }
    expect(coordinateLabel(14.312412, 121.112312).title).toBe("14.3124, 121.1123");
  });

  it("reuses cached names and sends only destination coordinates", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValueOnce(ok());
    const lookup = createReverseGeocoder(request);
    const first = await lookup(14.3, 121.1, new AbortController().signal);
    expect(await lookup(14.3, 121.1, new AbortController().signal)).toEqual(first);
    expect(request).toHaveBeenCalledTimes(1);
    expect(String(request.mock.calls[0][0])).toContain("lat=14.3&lon=121.1");
    expect(request.mock.calls[0][1]?.credentials).toBe("omit");
  });

  it("deduplicates concurrent lookups for the same destination", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValueOnce(ok());
    const lookup = createReverseGeocoder(request);
    const values = await Promise.all([lookup(14.3, 121.1, new AbortController().signal), lookup(14.3, 121.1, new AbortController().signal)]);
    expect(values[0]).toEqual(values[1]);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("falls back on HTTP and network failures without retrying immediately", async () => {
    for (const request of [vi.fn<typeof fetch>().mockRejectedValue(new Error("offline")), vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 429 }))]) {
      const lookup = createReverseGeocoder(request);
      expect(await lookup(14.3, 121.1, new AbortController().signal)).toBeNull();
      expect(await lookup(14.3, 121.1, new AbortController().signal)).toBeNull();
      expect(request).toHaveBeenCalledTimes(1);
    }
  });

  it("never starts a cancelled lookup", async () => {
    const request = vi.fn<typeof fetch>();
    const controller = new AbortController();
    controller.abort();
    expect(await createReverseGeocoder(request)(14.3, 121.1, controller.signal)).toBeNull();
    expect(request).not.toHaveBeenCalled();
  });

  it("discards a stale result even if the provider ignores cancellation", async () => {
    let finish!: (value: Response) => void;
    const request = vi.fn<typeof fetch>().mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const controller = new AbortController();
    const promise = createReverseGeocoder(request)(14.3, 121.1, controller.signal);
    await vi.waitFor(() => expect(request).toHaveBeenCalledOnce());
    controller.abort();
    finish(ok());
    expect(await promise).toBeNull();
  });

  it("aborts a timed-out request and resolves to the coordinate fallback", async () => {
    vi.useFakeTimers();
    const request = vi.fn<typeof fetch>().mockImplementation((_url, options) => new Promise((_resolve, reject) => {
      options?.signal?.addEventListener("abort", () => reject(new DOMException("Timed out", "AbortError")));
    }));
    const promise = createReverseGeocoder(request)(14.3, 121.1, new AbortController().signal);
    await vi.advanceTimersByTimeAsync(5100);
    expect(await promise).toBeNull();
    expect(request.mock.calls[0][1]?.signal?.aborted).toBe(true);
  });

  it("spaces different destination requests at least one second apart", async () => {
    vi.useFakeTimers();
    const request = vi.fn<typeof fetch>().mockImplementation(async () => ok());
    const lookup = createReverseGeocoder(request);
    const first = lookup(14.3, 121.1, new AbortController().signal);
    await vi.advanceTimersByTimeAsync(1);
    await first;
    const second = lookup(14.31, 121.11, new AbortController().signal);
    await vi.advanceTimersByTimeAsync(500);
    expect(request).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(501);
    await second;
    expect(request).toHaveBeenCalledTimes(2);
  });
});
