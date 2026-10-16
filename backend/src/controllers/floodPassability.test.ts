import { describe, expect, it, vi } from "vitest";
import type { Response } from "express";
import type { RoleAwareRequest } from "../middleware/role.middleware";
import { createFloodReport, updateFloodReport } from "./admin.controller";

vi.mock("../services/road.service", async () => {
  const { RoadGraph } = await import("../algorithms/astar/graph.js");
  return {
    loadRoadGraph: () =>
      new RoadGraph({
        nodes: [
          { id: "A", latitude: 14.3, longitude: 121.1 },
          { id: "B", latitude: 14.301, longitude: 121.1 },
        ],
        edges: [
          {
            id: "AB",
            roadId: "road",
            fromNodeId: "A",
            toNodeId: "B",
            distanceMeters: 111,
            status: "OPEN",
          },
        ],
      }),
  };
});

async function call(
  body: unknown,
  create: boolean,
  error: { code: string; message: string } | null = null,
) {
  const query = {
    eq: vi.fn(),
    select: vi.fn(),
    single: vi.fn().mockResolvedValue({ data: { id: "report" }, error }),
  };
  query.eq.mockReturnValue(query);
  query.select.mockReturnValue(query);
  const write = vi.fn((_data: unknown) => query);
  const from = vi.fn(() => ({ insert: write, update: write }));
  const res = { status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  await (create ? createFloodReport : updateFloodReport)(
    {
      body,
      params: { id: "report" },
      userSupabase: { from },
    } as unknown as RoleAwareRequest,
    res as unknown as Response,
  );
  return { write, from, res };
}

describe("flood passability writes", () => {
  it("identifies a missing section migration rather than blaming account permissions", async () => {
    const { res } = await call({ roadId: "road", severity: "LOW" }, true, {
      code: "PGRST204",
      message: "Could not find the 'edge_ranges' column",
    });
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({
      error: expect.stringContaining("0015 and 0016"),
    });
  });
  it("resolves section geometry on the server instead of trusting supplied edge IDs", async () => {
    const { write, res } = await call(
      {
        roadId: "road",
        severity: "HIGH",
        coverage: "section",
        sectionStart: { latitude: 14.3001, longitude: 121.1 },
        sectionEnd: { latitude: 14.3009, longitude: 121.1 },
        affectedEdgeIds: ["forged"],
      },
      true,
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(write).toHaveBeenCalledWith(
      expect.objectContaining({ affected_edge_ids: ["AB"] }),
    );
    const inserted = write.mock.calls[0][0] as unknown as {
      edge_ranges: { startFraction: number; endFraction: number }[];
    };
    expect(inserted.edge_ranges[0].startFraction).toBeCloseTo(0.1, 8);
    expect(inserted.edge_ranges[0].endFraction).toBeCloseTo(0.9, 8);
  });
  it.each([
    { coverage: "section" },
    {
      coverage: "section",
      sectionStart: { latitude: 14.3, longitude: 121.1 },
      sectionEnd: { latitude: 14.5, longitude: 121.1 },
    },
    {
      coverage: "section",
      sectionStart: { latitude: 14.3, longitude: 121.1 },
      sectionEnd: { latitude: 14.32, longitude: 121.1 },
    },
    {
      coverage: "entire-road",
      sectionStart: { latitude: 14.3, longitude: 121.1 },
    },
    { coverage: "invalid" },
  ])(
    "rejects invalid section selections before any database write: %j",
    async (fields) => {
      const { write, res } = await call(
        { roadId: "road", severity: "LOW", ...fields },
        true,
      );
      expect(write).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
    },
  );
  it("preserves whole-road coverage for explicit and legacy submissions", async () => {
    for (const coverage of [undefined, "entire-road"]) {
      const { write } = await call(
        { roadId: "road", severity: "LOW", coverage },
        true,
      );
      expect(write).toHaveBeenCalledWith(
        expect.objectContaining({ affected_edge_ids: null }),
      );
    }
  });
  for (const create of [true, false]) {
    it.each(["NONE", "LOW", "MODERATE", "HIGH", "SEVERE"])(
      `${create ? "create" : "update"} derives passability for %s`,
      async (severity) => {
        const blocked = severity === "HIGH" || severity === "SEVERE";
        const { write } = await call(
          { roadId: "road", severity, roadImpassable: !blocked },
          create,
        );
        expect(write).toHaveBeenCalledWith(
          expect.objectContaining({ severity, road_impassable: blocked }),
        );
      },
    );
    it(`rejects invalid severity on ${create ? "create" : "update"}`, async () => {
      const { from, res } = await call(
        { roadId: "road", severity: "INVALID" },
        create,
      );
      expect(res.status).toHaveBeenCalledWith(400);
      expect(from).not.toHaveBeenCalled();
    });
  }
  it("does not allow the legacy flag to override severity", async () => {
    const { write, res } = await call({ roadImpassable: true }, false);
    expect(write).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
  });
  it("leaves passability unchanged when updating unrelated fields", async () => {
    const { write } = await call(
      { notes: "Updated note", roadImpassable: true },
      false,
    );
    expect(write).toHaveBeenCalledWith({ notes: "Updated note" });
  });
});
