import { describe, expect, it } from "vitest";
import { deriveStatus } from "./evacuation.service";

describe("deriveStatus", () => {
  it("is AVAILABLE under 70% occupancy", () => {
    expect(deriveStatus(50, 100)).toBe("AVAILABLE");
  });

  it("is NEARLY_FULL between 70% and 90%", () => {
    expect(deriveStatus(80, 100)).toBe("NEARLY_FULL");
  });

  it("is FULL at 90% or above", () => {
    expect(deriveStatus(95, 100)).toBe("FULL");
  });

  it("is CLOSED when manually marked CLOSED", () => {
    expect(deriveStatus(0, 100, "CLOSED")).toBe("CLOSED");
  });
});
