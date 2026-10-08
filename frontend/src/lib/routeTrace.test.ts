import { describe, expect, it, vi } from "vitest";
import { traceRoutePaths } from "./routeTrace";

function path(length = 300) {
  const cancel = vi.fn();
  const animate = vi.fn(() => ({ cancel }));
  const element = { getTotalLength: vi.fn(() => length), animate } as unknown as SVGPathElement;
  return { element, animate, cancel };
}

describe("route tracing", () => {
  it("reveals both strokes from start to end and leaves the full stroke afterwards", () => {
    const outline = path(), line = path();
    const stop = traceRoutePaths([outline.element, line.element], false);
    for (const stroke of [outline, line]) {
      expect(stroke.animate).toHaveBeenCalledWith([
        { strokeDasharray: "300 300", strokeDashoffset: 300 },
        { strokeDasharray: "300 300", strokeDashoffset: 0 },
      ], { duration: 1400, easing: "ease-in-out", fill: "none" });
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
    const empty = path(0), invalid = path(NaN);
    expect(() => traceRoutePaths([null, undefined, {} as SVGPathElement, empty.element, invalid.element], false)()).not.toThrow();
    expect(empty.animate).not.toHaveBeenCalled();
    expect(invalid.animate).not.toHaveBeenCalled();
  });
});
