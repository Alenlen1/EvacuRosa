import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAvailableCenters: vi.fn(),
  computeRoute: vi.fn(),
}));

vi.mock("./evacuation.service", () => ({
  getAvailableCenters: mocks.getAvailableCenters,
}));

vi.mock("./routing.service", () => ({
  computeRoute: mocks.computeRoute,
}));

import { computeEvacuationRoute } from "./evacuationRouting.service";

const center = {
  id: "center-1",
  barangayId: null,
  name: "Verified evacuation center",
  address: "Santa Rosa City",
  latitude: 14.31,
  longitude: 121.11,
  capacity: 100,
  currentOccupancy: 20,
  status: "AVAILABLE" as const,
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("computeEvacuationRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAvailableCenters.mockResolvedValue([center]);
    mocks.computeRoute.mockResolvedValue({
      found: true,
      path: [
        { latitude: 14.3, longitude: 121.1 },
        { latitude: center.latitude, longitude: center.longitude },
      ],
      distanceMeters: 1200,
      affectedRoads: 0,
      riskLevel: "LOW",
      warnings: [],
    });
  });

  it("returns an available center and its route", async () => {
    const result = await computeEvacuationRoute({ latitude: 14.3, longitude: 121.1 });
    expect(result.found).toBe(true);
    expect(result.recommendedCenter).toEqual(center);
    expect(result.distanceMeters).toBe(1200);
    expect(result.riskLevel).toBe("LOW");
  });

  it("returns a clear failure when no verified centers are available", async () => {
    mocks.getAvailableCenters.mockResolvedValue([]);
    const result = await computeEvacuationRoute({ latitude: 14.3, longitude: 121.1 });
    expect(result.found).toBe(false);
    expect(result.recommendedCenter).toBeNull();
  });
  it("uses the selected travel mode for candidate routes", async () => {
    const start = { latitude: 14.3, longitude: 121.1 };
    await computeEvacuationRoute(start, "car");
    expect(mocks.computeRoute).toHaveBeenCalledWith(start, {
      latitude: center.latitude, longitude: center.longitude,
    }, "car");
  });
});
