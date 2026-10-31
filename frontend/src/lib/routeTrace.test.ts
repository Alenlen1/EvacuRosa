import { describe, expect, it, vi } from "vitest";
import { traceRoutePaths } from "./routeTrace";

function path(length = 300) {
  const cancel = vi.fn();
  let finish!: () => void;
  const finished = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const animate = vi.fn(() => ({ cancel, finished }));
  const element = {
    getTotalLength: vi.fn(() => length),
    animate,
  } as unknown as SVGPathElement;
  return { element, animate, cancel, finish };
}

describe("route tracing", () => {
  it("reveals the approach only after both route strokes finish", async () => {
    const outline = path(),
      line = path(),
      complete = vi.fn();
    const stop = traceRoutePaths(
      [outline.element, line.element],
      false,
      complete,
    );
    expect(complete).not.toHaveBeenCalled();
    outline.finish();
    await Promise.resolve();
    expect(complete).not.toHaveBeenCalled();
    line.finish();
    await vi.waitFor(() => expect(complete).toHaveBeenCalledOnce());
    stop();
    expect(complete).toHaveBeenCalledOnce();
  });
  it("reveals the approach immediately when interaction reveals the full route", () => {
    const stroke = path(),
      complete = vi.fn();
    const stop = traceRoutePaths([stroke.element], false, complete);
    stop();
    expect(stroke.cancel).toHaveBeenCalledOnce();
    expect(complete).toHaveBeenCalledOnce();
  });
  it("does not delay the approach for reduced motion or unsupported renderers", () => {
    for (const reduced of [true, false]) {
      const complete = vi.fn();
      traceRoutePaths([], reduced, complete);
      expect(complete).toHaveBeenCalledOnce();
    }
  });
  it("reveals both strokes from start to end and leaves the full stroke afterwards", () => {
    const outline = path(),
      line = path();
    const stop = traceRoutePaths([outline.element, line.element], false);
    for (const stroke of [outline, line]) {
      expect(stroke.animate).toHaveBeenCalledWith(
        [
          { strokeDasharray: "300 300", strokeDashoffset: 300 },
          { strokeDasharray: "300 300", strokeDashoffset: 0 },
        ],
        { duration: 1400, easing: "ease-in-out", fill: "none" },
      );
    }
    stop();
    expect(outline.cancel).toHaveBeenCalledOnce();
    expect(line.cancel).toHaveBeenCalledOnce();
  });
  it("respects reduced motion", () => {
    const stroke = path();
    traceRoutePaths([stroke.element], true)();
    expect(stroke.animate).not.toHaveBeenCalled();
  });
  it("gracefully handles empty routes and unsupported renderers", () => {
    const empty = path(0),
      invalid = path(NaN);
    expect(() =>
      traceRoutePaths(
        [null, undefined, {} as SVGPathElement, empty.element, invalid.element],
        false,
      )(),
    ).not.toThrow();
    expect(empty.animate).not.toHaveBeenCalled();
    expect(invalid.animate).not.toHaveBeenCalled();
  });
});
