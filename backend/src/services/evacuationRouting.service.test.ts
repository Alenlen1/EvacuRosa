import { describe, expect, it } from "vitest";
import { computeEvacuationRoute } from "./evacuationRouting.service";

// Integration-style test against the real dev fixtures (road graph,
// centers, flood/fire data) — this is the automated version of what was
// previously only checked by hand with curl against a running server.

describe("computeEvacuationRoute", () => {
  it("recommends a center that is neither FULL nor CLOSED", async () => {
    const result = await computeEvacuationRoute({ latitude: 14.3123, longitude: 121.1113 });

    expect(result.found).toBe(true);
    expect(result.recommendedCenter).not.toBeNull();
    expect(["AVAILABLE", "NEARLY_FULL"]).toContain(result.recommendedCenter?.status);
  });

  it("returns a real riskLevel and non-negative distance for the recommendation", async () => {
    const result = await computeEvacuationRoute({ latitude: 14.3123, longitude: 121.1113 });

    expect(result.riskLevel).not.toBeNull();
    expect(result.distanceMeters).toBeGreaterThanOrEqual(0);
  });
});
