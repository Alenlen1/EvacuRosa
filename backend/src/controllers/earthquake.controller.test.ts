import { describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import type { EarthquakeRoadImpact } from "../types/earthquake";

const state = vi.hoisted(() => ({ impacts: [] as EarthquakeRoadImpact[] }));
vi.mock("../services/earthquake.service", () => ({
  getRecentEarthquakes: async () => [],
  getVerifiedRoadImpacts: async () => state.impacts,
}));
vi.mock("../services/road.service", async () => {
  const { RoadGraph } = await import("../algorithms/astar/graph");
  return {
    loadRoadGraph: () =>
      new RoadGraph({
        nodes: [
          { id: "A", latitude: 14.3, longitude: 121.1 },
          { id: "B", latitude: 14.31, longitude: 121.1 },
          { id: "C", latitude: 14.32, longitude: 121.1 },
        ],
        edges: [
          {
            id: "AB",
            roadId: "road",
            fromNodeId: "A",
            toNodeId: "B",
            distanceMeters: 1112,
            status: "OPEN",
          },
          {
            id: "BC",
            roadId: "road",
            fromNodeId: "B",
            toNodeId: "C",
            distanceMeters: 1112,
            status: "OPEN",
          },
        ],
      }),
  };
});
import { listEarthquakes } from "./earthquake.controller";
const impact: EarthquakeRoadImpact = {
  id: "debris",
  earthquakeEventId: null,
  roadId: "road",
  impactLevel: "HIGH",
  confirmedBlocked: true,
  verifiedAt: "2026-10-31T00:00:00Z",
};
async function read(fields: Partial<EarthquakeRoadImpact>) {
  state.impacts = [{ ...impact, ...fields }];
  const json = vi.fn();
  await listEarthquakes({} as Request, { json } as unknown as Response);
  return json.mock.calls[0][0].roadImpacts[0];
}
describe("earthquake public map geometry", () => {
  it("returns the clipped footprint rather than the full mapped road", async () => {
    const result = await read({
      edgeRanges: [{ edgeId: "AB", startFraction: 0.4, endFraction: 0.6 }],
    });
    expect(result.affectedSegments).toHaveLength(1);
    expect(result.affectedSegments[0][0].latitude).toBeCloseTo(14.304, 9);
    expect(result.affectedSegments[0][1].latitude).toBeCloseTo(14.306, 9);
  });
  it("preserves legacy whole-road records", async () => {
    expect((await read({})).affectedSegments).toHaveLength(2);
  });
  it("never expands an empty saved section into an entire road", async () => {
    expect((await read({ edgeRanges: [] })).affectedSegments).toEqual([]);
  });
  it("rejects stale road-network intervals instead of silently drawing other roads", async () => {
    await expect(
      read({
        edgeRanges: [
          { edgeId: "missing", startFraction: 0.4, endFraction: 0.6 },
        ],
      }),
    ).rejects.toThrow("road network");
  });
});
