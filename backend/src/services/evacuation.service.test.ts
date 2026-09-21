import { describe, expect, it } from "vitest";
import { deriveStatus, getAllCenters, getAvailableCenters } from "./evacuation.service";

// No SUPABASE_URL/keys are set in the test environment, so these exercise
// the dev-fixture fallback path deliberately.

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

  it("is CLOSED when manually marked CLOSED regardless of occupancy", () => {
    expect(deriveStatus(0, 100, "CLOSED")).toBe("CLOSED");
  });
});

describe("evacuation center fallback + filtering", () => {
  it("loads the dev fixture when Supabase isn't configured", async () => {
    const centers = await getAllCenters();
    expect(centers.length).toBeGreaterThan(0);
  });

  it("excludes FULL and CLOSED centers from available candidates", async () => {
    const available = await getAvailableCenters();
    expect(available.every((c) => c.status !== "FULL" && c.status !== "CLOSED")).toBe(true);
    // the dev fixture includes one of each on purpose
    expect(available.length).toBeGreaterThan(0);
    expect(available.length).toBeLessThan((await getAllCenters()).length);
  });
});
