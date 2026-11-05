import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import { RoadGraph } from "../algorithms/astar/graph";
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
  it.each([
    { width: "501", height: "20" },
    { width: "20", height: "0" },
    { width: "20", height: "" },
    { width: ["10", "20"], height: "20" },
    { width: "NaN", height: "20" },
    { width: "20" },
    { shape: "polygon", width: "20", height: "20" },
    { width: "20", height: "20", rotation: "" },
    { width: "20", height: "20", rotation: " " },
    { width: "20", height: "20", rotation: "NaN" },
    { width: "20", height: "20", rotation: "Infinity" },
    { width: "20", height: "20", rotation: "-1" },
    { width: "20", height: "20", rotation: "360" },
    { width: "20", height: "20", rotation: ["0", "45"] },
    { width: "20", height: "20", rotation: { value: "45" } },
  ])(
    "rejects invalid rectangle parameters before loading the graph: %j",
    (fields) => {
      const res = response();
      getEarthquakeArea(
        {
          query: { shape: "rectangle", lat: "14.3", lng: "121.1", ...fields },
        } as unknown as Request,
        res as unknown as Response,
      );
      expect(res.status).toHaveBeenCalledWith(400);
      expect(mocks.load).not.toHaveBeenCalled();
    },
  );
  it.each([
    [undefined, 60],
    ["0", 60],
    ["90", 20],
  ])(
    "previews the clipped rotated rectangle with angle %s",
    (rotation, expectedDistance) => {
      mocks.load.mockReturnValue(
        new RoadGraph({
          nodes: [
            { id: "A", latitude: 14.3, longitude: 121.1 },
            { id: "B", latitude: 14.301, longitude: 121.1 },
          ],
          edges: [
            {
              id: "AB",
              roadId: "inside",
              fromNodeId: "A",
              toNodeId: "B",
              distanceMeters: 111.2,
              status: "OPEN",
            },
          ],
        }),
      );
      const res = response();
      getEarthquakeArea(
        {
          query: {
            shape: "rectangle",
            lat: "14.3005",
            lng: "121.1",
            width: "20",
            height: "60",
            ...(rotation === undefined ? {} : { rotation }),
          },
        } as unknown as Request,
        res as unknown as Response,
      );
      expect(res.status).not.toHaveBeenCalled();
      const roads = res.json.mock.calls[0][0].roads;
      expect(roads).toHaveLength(1);
      expect(roads[0].roadId).toBe("inside");
      expect(roads[0].distanceMeters).toBe(expectedDistance);
    },
  );
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
