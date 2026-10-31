import { describe, expect, it, vi } from "vitest";
import type { Response } from "express";
import type { RoleAwareRequest } from "../middleware/role.middleware";
import {
  createFloodReport,
  createFireIncident,
  createEarthquakeRoadImpact,
  updateFireIncident,
} from "./admin.controller";
import { getNearestRoads, getEarthquakeArea } from "./road.controller";

vi.mock("../services/road.service", async () => {
  const { RoadGraph } = await import("../algorithms/astar/graph.js");
  const graph = new RoadGraph({
    nodes: [
      { id: "A", latitude: 14.3, longitude: 121.1 },
      { id: "B", latitude: 14.301, longitude: 121.1 },
      { id: "C", latitude: 14.338, longitude: 121.085 },
      { id: "D", latitude: 14.3381, longitude: 121.085 },
    ],
    edges: [
      {
        id: "AB",
        roadId: "inside",
        fromNodeId: "A",
        toNodeId: "B",
        distanceMeters: 111,
        status: "OPEN",
      },
      {
        id: "CD",
        roadId: "outside",
        fromNodeId: "C",
        toNodeId: "D",
        distanceMeters: 11,
        status: "OPEN",
      },
      {
        id: "BC",
        roadId: "crossing",
        fromNodeId: "B",
        toNodeId: "C",
        distanceMeters: 4000,
        status: "OPEN",
      },
    ],
  });
  return { loadRoadGraph: () => graph };
});

async function call(
  handler: (req: RoleAwareRequest, res: Response) => unknown,
  body: unknown,
  query = {},
) {
  const db = {
    insert: vi.fn(),
    update: vi.fn(),
    eq: vi.fn(),
    select: vi.fn(),
    single: vi.fn().mockResolvedValue({ data: { id: "new" }, error: null }),
    then: (
      resolve: (result: { data: { id: string }[]; error: null }) => unknown,
    ) => resolve({ data: [{ id: "new" }], error: null }),
  };
  for (const fn of [db.insert, db.update, db.eq, db.select])
    fn.mockReturnValue(db);
  const from = vi.fn(() => db);
  const res = { status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  await handler(
    {
      body,
      query,
      params: { id: "fire" },
      userSupabase: { from },
    } as unknown as RoleAwareRequest,
    res as unknown as Response,
  );
  return { db, from, res };
}

describe("CDRRMO hazard city enforcement", () => {
  for (const [name, handler, fields] of [
    ["flood", createFloodReport, { severity: "MODERATE" }],
    ["earthquake impact", createEarthquakeRoadImpact, { impactLevel: "LOW" }],
  ] as const) {
    it.each(["outside", "crossing", "missing"])(
      `rejects ${name} on %s roads before writing`,
      async (roadId) => {
        const { from, res } = await call(handler, { ...fields, roadId });
        expect(res.status).toHaveBeenCalledWith(400);
        expect(from).not.toHaveBeenCalled();
      },
    );
    it(`accepts ${name} on a city road`, async () => {
      const { db, res } = await call(handler, { ...fields, roadId: "inside" });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(db.insert).toHaveBeenCalledWith(
        expect.objectContaining({ road_id: "inside" }),
      );
    });
  }
  it("saves a blocked earthquake road without creating or selecting an event", async () => {
    const { db, from, res } = await call(createEarthquakeRoadImpact, {
      roadId: "inside",
      impactLevel: "HIGH",
      confirmedBlocked: true,
      notes: "Debris blocks the road",
    });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(from).toHaveBeenCalledExactlyOnceWith("earthquake_road_impacts");
    expect(db.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        earthquake_event_id: null,
        road_id: "inside",
        impact_level: "HIGH",
        confirmed_blocked: true,
        notes: "Debris blocks the road",
      }),
    );
  });
  it("continues accepting an existing event link", async () => {
    const { db, res } = await call(createEarthquakeRoadImpact, {
      earthquakeEventId: "legacy-event",
      roadId: "inside",
      impactLevel: "MODERATE",
      confirmedBlocked: false,
    });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(db.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        earthquake_event_id: "legacy-event",
        confirmed_blocked: false,
      }),
    );
  });
  it("saves only selected intersecting sections and ignores forged client geometry", async () => {
    const { db, res } = await call(createEarthquakeRoadImpact, {
      impactArea: { latitude: 14.3005, longitude: 121.1, radiusMeters: 10 },
      selectedRoadIds: ["inside"],
      impactLevel: "HIGH",
      confirmedBlocked: true,
      edgeRanges: [{ edgeId: "CD", startFraction: 0, endFraction: 1 }],
    });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(db.insert).toHaveBeenCalledExactlyOnceWith([
      expect.objectContaining({
        road_id: "inside",
        affected_edge_ids: ["AB"],
        edge_ranges: [
          expect.objectContaining({
            edgeId: "AB",
            startFraction: expect.any(Number),
            endFraction: expect.any(Number),
          }),
        ],
      }),
    ]);
    const saved = db.insert.mock.calls[0][0][0].edge_ranges[0];
    expect(saved.startFraction).toBeGreaterThan(0.4);
    expect(saved.endFraction).toBeLessThan(0.6);
  });
  it.each([
    { selectedRoadIds: [] },
    { selectedRoadIds: ["outside"] },
    { selectedRoadIds: ["inside", "outside"] },
    { selectedRoadIds: ["inside", "inside"] },
    { selectedRoadIds: ["missing"] },
    { selectedRoadIds: [12] },
    { impactArea: { latitude: 14.338, longitude: 121.085, radiusMeters: 25 } },
    { impactArea: { latitude: 14.3005, longitude: 121.1, radiusMeters: 0 } },
    { impactArea: { latitude: 14.3005, longitude: 121.1, radiusMeters: 251 } },
    { impactArea: { latitude: "14.3005", longitude: 121.1, radiusMeters: 25 } },
  ])(
    "rejects invalid area/road selections without any partial writes: %j",
    async (fields) => {
      const { from, res } = await call(createEarthquakeRoadImpact, {
        impactArea: { latitude: 14.3005, longitude: 121.1, radiusMeters: 10 },
        selectedRoadIds: ["inside"],
        impactLevel: "HIGH",
        confirmedBlocked: true,
        ...fields,
      });
      expect(res.status).toHaveBeenCalledWith(400);
      expect(from).not.toHaveBeenCalled();
    },
  );
  it("previews clipped road geometry without writing a report", async () => {
    const { from, res } = await call(
      getEarthquakeArea,
      {},
      { lat: "14.3005", lng: "121.1", radius: "10" },
    );
    expect(from).not.toHaveBeenCalled();
    const roads = res.json.mock.calls[0][0].roads;
    expect(roads).toHaveLength(1);
    expect(roads[0].distanceMeters).toBe(20);
    expect(roads[0].edgeRanges[0].edgeId).toBe("AB");
  });
  it.each([
    { impactLevel: "SEVERE" },
    { impactLevel: "HIGH", confirmedBlocked: "false" },
    { impactLevel: "HIGH", earthquakeEventId: "" },
    { impactLevel: "HIGH", earthquakeEventId: 42 },
  ])(
    "rejects invalid road-impact fields before writing: %j",
    async (fields) => {
      const { from, res } = await call(createEarthquakeRoadImpact, {
        roadId: "inside",
        ...fields,
      });
      expect(res.status).toHaveBeenCalledWith(400);
      expect(from).not.toHaveBeenCalled();
    },
  );
  it.each([
    [14.338, 121.085],
    [14.275, 121.125],
    [NaN, 121.1],
    [14.3, Infinity],
  ])("rejects outside/invalid fires (%s, %s)", async (latitude, longitude) => {
    const { from, res } = await call(createFireIncident, {
      latitude,
      longitude,
      severity: "MODERATE",
      radiusMeters: 200,
    });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(from).not.toHaveBeenCalled();
  });
  it("accepts a fire located inside Santa Rosa", async () => {
    const { res } = await call(createFireIncident, {
      latitude: 14.3,
      longitude: 121.1,
      severity: "MODERATE",
      radiusMeters: 200,
    });
    expect(res.status).toHaveBeenCalledWith(201);
  });
  it("rejects fire road-block overrides outside Santa Rosa", async () => {
    const { from, res } = await call(updateFireIncident, {
      confirmedBlockedRoadIds: ["outside"],
    });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(from).not.toHaveBeenCalled();
  });
  it("limits hazard road suggestions while preserving normal road lookup", async () => {
    const scoped = await call(
      getNearestRoads,
      {},
      { lat: "14.3", lng: "121.1", scope: "santa-rosa" },
    );
    expect(scoped.res.json).toHaveBeenCalledWith({
      roads: [expect.objectContaining({ roadId: "inside" })],
    });
    const rejected = await call(
      getNearestRoads,
      {},
      { lat: "14.338", lng: "121.085", scope: "santa-rosa" },
    );
    expect(rejected.res.status).toHaveBeenCalledWith(400);
    const normal = await call(
      getNearestRoads,
      {},
      { lat: "14.338", lng: "121.085" },
    );
    expect(normal.res.json).toHaveBeenCalledWith({
      roads: expect.arrayContaining([
        expect.objectContaining({ roadId: "outside" }),
      ]),
    });
  });
});
