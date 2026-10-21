import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAvailableCenters: vi.fn(),
  computeRoute: vi.fn(),
  createRoutePlanner: vi.fn(),
}));

vi.mock("./evacuation.service", () => ({
  getAvailableCenters: mocks.getAvailableCenters,
}));

vi.mock("./routing.service", () => ({
  createRoutePlanner: mocks.createRoutePlanner,
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
  it("only identifies hazard failure when no available center is reachable", async () => {
    mocks.getAvailableCenters.mockResolvedValue([center]);
    mocks.computeRoute.mockReturnValue({
      found: false,
      failureReason: "HAZARD_BLOCKED",
    });
    expect(
      (await computeEvacuationRoute({ latitude: 14.3, longitude: 121.1 }))
        .failureReason,
    ).toBe("HAZARD_BLOCKED");
    mocks.getAvailableCenters.mockResolvedValue([]);
    expect(
      (await computeEvacuationRoute({ latitude: 14.3, longitude: 121.1 }))
        .failureReason,
    ).toBeUndefined();
  });
  it("does not offer assistance when another center can be reached", async () => {
    mocks.getAvailableCenters.mockResolvedValue([
      center,
      { ...center, id: "second" },
    ]);
    mocks.computeRoute.mockReturnValueOnce({
      found: false,
      failureReason: "HAZARD_BLOCKED",
    });
    const result = await computeEvacuationRoute({
      latitude: 14.3,
      longitude: 121.1,
    });
    expect(result.found).toBe(true);
    expect(result.failureReason).toBeUndefined();
  });
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createRoutePlanner.mockResolvedValue(mocks.computeRoute);
    mocks.getAvailableCenters.mockResolvedValue([center]);
    mocks.computeRoute.mockReturnValue({
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
    const result = await computeEvacuationRoute({
      latitude: 14.3,
      longitude: 121.1,
    });
    expect(result.found).toBe(true);
    expect(result.recommendedCenter).toEqual(center);
    expect(result.distanceMeters).toBe(1200);
    expect(result.riskLevel).toBe("LOW");
  });

  it("returns a clear failure when no verified centers are available", async () => {
    mocks.getAvailableCenters.mockResolvedValue([]);
    const result = await computeEvacuationRoute({
      latitude: 14.3,
      longitude: 121.1,
    });
    expect(result.found).toBe(false);
    expect(result.recommendedCenter).toBeNull();
    expect(mocks.createRoutePlanner).not.toHaveBeenCalled();
  });
  it("shares one planner and preserves risk-aware ranking across candidates", async () => {
    const safer = { ...center, id: "safer-center" };
    mocks.getAvailableCenters.mockResolvedValue([center, safer]);
    mocks.computeRoute
      .mockReturnValueOnce({
        found: true,
        path: [],
        distanceMeters: 1000,
        riskLevel: "HIGH",
      })
      .mockReturnValueOnce({
        found: true,
        path: [],
        distanceMeters: 1500,
        riskLevel: "LOW",
      });
    const result = await computeEvacuationRoute({
      latitude: 14.3,
      longitude: 121.1,
    });
    expect(result.recommendedCenter?.id).toBe("safer-center");
    expect(mocks.createRoutePlanner).toHaveBeenCalledTimes(1);
    expect(mocks.computeRoute).toHaveBeenCalledTimes(2);
  });
  it("uses the selected travel mode for candidate routes", async () => {
    const start = { latitude: 14.3, longitude: 121.1 };
    await computeEvacuationRoute(start, "car");
    expect(mocks.computeRoute).toHaveBeenCalledWith(
      start,
      {
        latitude: center.latitude,
        longitude: center.longitude,
      },
      "car",
    );
  });
});
