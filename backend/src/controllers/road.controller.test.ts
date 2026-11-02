import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
const mocks = vi.hoisted(() => ({ load: vi.fn(), nearest: vi.fn() }));
vi.mock("../services/road.service", () => ({ loadRoadGraph: mocks.load }));
import {
  getNearestRoads,
  getRoadSection,
  getEarthquakeArea,
} from "./road.controller";

function response() {
  const res = { status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  return res;
}
describe("road-preview bounds before graph work", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.load.mockReturnValue({ nearestRoads: mocks.nearest });
    mocks.nearest.mockReturnValue([]);
  });
  it.each([
    "0",
    "-1",
    "11",
    "1000000",
    "1.5",
    "Infinity",
    "NaN",
    "",
    "2e0",
    ["1", "2"],
    { value: "3" },
    { toString: "not callable" },
  ])("rejects invalid limit %j before loading the graph", (limit) => {
    const res = response();
    getNearestRoads(
      { query: { lat: "14.3", lng: "121.1", limit } } as unknown as Request,
      res as unknown as Response,
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(mocks.load).not.toHaveBeenCalled();
  });
  it.each([undefined, "1", "10"])("accepts bounded limit %s", (limit) => {
    const res = response();
    getNearestRoads(
      {
        query: {
          lat: "14.3",
          lng: "121.1",
          ...(limit === undefined ? {} : { limit }),
        },
      } as unknown as Request,
      res as unknown as Response,
    );
    expect(mocks.nearest).toHaveBeenCalledWith(
      14.3,
      121.1,
      limit === undefined ? 5 : Number(limit),
      undefined,
    );
    expect(res.json).toHaveBeenCalledWith({ roads: [] });
  });
  it.each([
    { lat: "", lng: "121.1" },
    { lat: ["14.3", "14.4"], lng: "121.1" },
    { lat: "91", lng: "121.1" },
    { lat: "14.3", lng: "181" },
    { lat: "NaN", lng: "121.1" },
    { lat: "14.3", lng: "Infinity" },
    { lat: "14.3", lng: "121.1", scope: "invalid" },
    { lat: "0", lng: "0", scope: "santa-rosa" },
  ])("rejects malformed or out-of-scope coordinates %j", (query) => {
    const res = response();
    getNearestRoads(
      { query } as unknown as Request,
      res as unknown as Response,
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(mocks.load).not.toHaveBeenCalled();
  });
  it("preserves earthquake radius bounds", () => {
    const res = response();
    getEarthquakeArea(
      {
        query: { lat: "14.3", lng: "121.1", radius: "251" },
      } as unknown as Request,
      res as unknown as Response,
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(mocks.load).not.toHaveBeenCalled();
  });
  it("rejects an oversized road ID before graph work", () => {
    const res = response();
    getRoadSection(
      {
        query: {
          roadId: "x".repeat(129),
          startLat: "14.3",
          startLng: "121.1",
          endLat: "14.3",
          endLng: "121.1",
        },
      } as unknown as Request,
      res as unknown as Response,
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(mocks.load).not.toHaveBeenCalled();
  });
});
