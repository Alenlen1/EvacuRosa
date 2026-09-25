import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
vi.mock("../services/routing.service", () => ({ computeRoute: vi.fn() }));
vi.mock("../services/evacuationRouting.service", () => ({ computeEvacuationRoute: vi.fn() }));
import { computeRoute } from "../services/routing.service";
import { computeEvacuationRoute } from "../services/evacuationRouting.service";
import { postRoute } from "./route.controller";
import { postEvacuationRoute } from "./evacuationRoute.controller";

describe("route travel-mode API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(computeRoute).mockResolvedValue({ found: false, path: [], distanceMeters: 0, affectedRoads: 0, riskLevel: null, warnings: [] });
    vi.mocked(computeEvacuationRoute).mockResolvedValue({ found: false, route: [], recommendedCenter: null, distanceMeters: 0, riskLevel: null, warnings: [] });
  });
  const point = { latitude: 14.3, longitude: 121.1 };
  function response() {
    return { status: vi.fn().mockReturnThis(), json: vi.fn() };
  }
  it("rejects invalid modes on both endpoints", async () => {
    for (const handler of [postRoute, postEvacuationRoute]) {
      const res = response();
      await handler({ body: { start: point, destination: point, travelMode: "plane" } } as Request, res as unknown as Response);
      expect(res.status).toHaveBeenCalledWith(400);
    }
    expect(computeRoute).not.toHaveBeenCalled();
    expect(computeEvacuationRoute).not.toHaveBeenCalled();
  });
  it("defaults old clients to walking and forwards selected modes", async () => {
    await postRoute({ body: { start: point, destination: point } } as Request, response() as unknown as Response);
    expect(computeRoute).toHaveBeenCalledWith(point, point, "walking");
    await postEvacuationRoute({ body: { start: point, travelMode: "biking" } } as Request, response() as unknown as Response);
    expect(computeEvacuationRoute).toHaveBeenCalledWith(point, "biking");
  });
});
