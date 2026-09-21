import { describe, expect, it } from "vitest";
import { triangular, trapezoidal } from "./membershipFunctions";

describe("triangular", () => {
  it("peaks at 1 at the middle point", () => {
    expect(triangular(5, 0, 5, 10)).toBe(1);
  });
  it("is 0 at and beyond both edges", () => {
    expect(triangular(0, 0, 5, 10)).toBe(0);
    expect(triangular(10, 0, 5, 10)).toBe(0);
    expect(triangular(-5, 0, 5, 10)).toBe(0);
  });
  it("is a fraction on the slopes, not a hard step", () => {
    expect(triangular(2.5, 0, 5, 10)).toBeCloseTo(0.5);
  });
});

describe("trapezoidal", () => {
  it("plateaus at 1 across the whole flat top", () => {
    expect(trapezoidal(3, 0, 2, 4, 6)).toBe(1);
    expect(trapezoidal(2, 0, 2, 4, 6)).toBe(1);
    expect(trapezoidal(4, 0, 2, 4, 6)).toBe(1);
  });
  it("is 0 outside the shape", () => {
    expect(trapezoidal(-1, 0, 2, 4, 6)).toBe(0);
    expect(trapezoidal(7, 0, 2, 4, 6)).toBe(0);
  });
});
