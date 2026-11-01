import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
const mocks = vi.hoisted(() => ({ route: vi.fn(), evacuation: vi.fn() }));
vi.mock("../services/routing.service", () => ({ computeRoute: mocks.route }));
vi.mock("../services/evacuationRouting.service", () => ({
  computeEvacuationRoute: mocks.evacuation,
}));
import { postRoute } from "./route.controller";
import { postEvacuationRoute } from "./evacuationRoute.controller";

describe("routing coordinate bounds", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.route.mockResolvedValue({ found: false });
    mocks.evacuation.mockResolvedValue({ found: false });
  });
  it.each([
    { latitude: 91, longitude: 121.1 },
    { latitude: 14.3, longitude: -181 },
    { latitude: NaN, longitude: 121.1 },
    { latitude: 14.3, longitude: Infinity },
    { latitude: "14.3", longitude: 121.1 },
  ])("rejects invalid coordinates %j before computation", async (invalid) => {
    for (const [handler, body] of [
      [
        postRoute,
        { start: invalid, destination: { latitude: 14.3, longitude: 121.1 } },
      ],
      [
        postRoute,
        { start: { latitude: 14.3, longitude: 121.1 }, destination: invalid },
      ],
      [postEvacuationRoute, { start: invalid }],
    ] as const) {
      const res = { status: vi.fn(), json: vi.fn() };
      res.status.mockReturnValue(res);
      await handler({ body } as Request, res as unknown as Response);
      expect(res.status).toHaveBeenCalledWith(400);
    }
    expect(mocks.route).not.toHaveBeenCalled();
    expect(mocks.evacuation).not.toHaveBeenCalled();
  });
  it("still sends valid coordinates to both routing services", async () => {
    const start = { latitude: 14.3, longitude: 121.1 };
    const res = { status: vi.fn(), json: vi.fn() };
    res.status.mockReturnValue(res);
    await postRoute(
      { body: { start, destination: start } } as Request,
      res as unknown as Response,
    );
    await postEvacuationRoute(
      { body: { start } } as Request,
      res as unknown as Response,
    );
    expect(mocks.route).toHaveBeenCalledWith(start, start, "walking");
    expect(mocks.evacuation).toHaveBeenCalledWith(start, "walking");
  });
});
