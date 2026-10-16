import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import { listFloodReports } from "./flood.controller";
import type { FloodEdgeRange } from "../types/flood";

const state = vi.hoisted(() => ({
  ids: null as string[] | null | undefined,
  ranges: null as FloodEdgeRange[] | null,
}));
vi.mock("../services/flood.service", () => ({
  getActiveFloodReports: async () => [
    {
      id: "report",
      roadId: "W1",
      affectedEdgeIds: state.ids,
      edgeRanges: state.ranges,
    },
  ],
}));
vi.mock("../services/road.service", async () => {
  const { RoadGraph } = await import("../algorithms/astar/graph.js");
  return {
    loadRoadGraph: () =>
      new RoadGraph({
        nodes: [
          { id: "A", latitude: 14.3, longitude: 121.1 },
          { id: "B", latitude: 14.301, longitude: 121.1 },
          { id: "C", latitude: 14.302, longitude: 121.1 },
        ],
        edges: [
          {
            id: "AB",
            roadId: "W1",
            fromNodeId: "A",
            toNodeId: "B",
            distanceMeters: 111,
            status: "OPEN",
          },
          {
            id: "BC",
            roadId: "W2",
            fromNodeId: "B",
            toNodeId: "C",
            distanceMeters: 111,
            status: "OPEN",
          },
        ],
      }),
  };
});

describe("public flood map coverage", () => {
  beforeEach(() => {
    state.ids = null;
    state.ranges = null;
  });
  async function geometry() {
    const json = vi.fn();
    await listFloodReports({} as Request, { json } as unknown as Response);
    return json.mock.calls[0][0].reports[0].affectedSegments;
  }
  it("shows only the saved affected graph segments", async () => {
    state.ids = ["BC"];
    expect(await geometry()).toEqual([
      [
        { latitude: 14.301, longitude: 121.1 },
        { latitude: 14.302, longitude: 121.1 },
      ],
    ]);
  });
  it("clips the public flood line to the exact saved interval", async () => {
    state.ids = ["BC"];
    state.ranges = [{ edgeId: "BC", startFraction: 0.2, endFraction: 0.8 }];
    const segments = await geometry();
    expect(segments).toHaveLength(1);
    expect(segments[0][0].latitude).toBeCloseTo(14.3012, 10);
    expect(segments[0][1].latitude).toBeCloseTo(14.3018, 10);
  });
  it("includes selected portions from other way IDs belonging to the street", async () => {
    state.ids = ["AB", "BC"];
    state.ranges = [
      { edgeId: "AB", startFraction: 0.5, endFraction: 1 },
      { edgeId: "BC", startFraction: 0, endFraction: 0.5 },
    ];
    const segments = await geometry();
    expect(segments).toHaveLength(2);
    expect(segments[1][1].latitude).toBeCloseTo(14.3015, 10);
  });
  it("keeps legacy whole-road geometry", async () => {
    for (const value of [null, undefined]) {
      state.ids = value;
      expect(await geometry()).toHaveLength(1);
    }
  });
  it("never turns an unmatched section into a whole-road report", async () => {
    state.ids = ["missing"];
    expect(await geometry()).toEqual([]);
  });
});
