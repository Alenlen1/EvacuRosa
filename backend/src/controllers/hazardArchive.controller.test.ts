import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Response } from "express";
import type { RoleAwareRequest } from "../middleware/role.middleware";
import {
  archiveHazard,
  listHazardArchives,
  restoreHazard,
  deleteHazardArchive,
  deleteActiveHazard,
} from "./hazardArchive.controller";
import {
  deleteFloodReport,
  deleteFireIncident,
  deleteEarthquakeRoadImpact,
  deleteEarthquakeEvent,
} from "./admin.controller";
vi.mock("../services/road.service", () => ({
  loadRoadGraph: () => ({ edgesByRoadId: () => [{ roadName: "Test road" }] }),
}));
const id = "11111111-1111-4111-8111-111111111111";
const rpc = vi.fn(),
  from = vi.fn();
function response() {
  const res = {
    status: vi.fn(),
    json: vi.fn(),
    send: vi.fn(),
    setHeader: vi.fn(),
  };
  res.status.mockReturnValue(res);
  return res;
}
function request(overrides = {}) {
  return {
    profile: { role: "SUPER_ADMIN" },
    userSupabase: { rpc, from },
    params: { id },
    body: { confirmed: true },
    query: {},
    ...overrides,
  } as unknown as RoleAwareRequest;
}
beforeEach(() => {
  vi.clearAllMocks();
  rpc.mockResolvedValue({ data: true, error: null });
});
describe("private hazard archives", () => {
  it.each([undefined, "BARANGAY_ADMIN"])(
    "denies archive list, mutations and restore to %s",
    async (role) => {
      for (const handler of [
        listHazardArchives,
        restoreHazard,
        deleteHazardArchive,
        deleteActiveHazard,
        (req: RoleAwareRequest, res: Response) =>
          archiveHazard(req, res, "flood"),
      ]) {
        const res = response();
        await handler(
          request({ profile: role ? { role } : undefined }),
          res as unknown as Response,
        );
        expect(res.status).toHaveBeenCalledWith(403);
      }
      expect(rpc).not.toHaveBeenCalled();
      expect(from).not.toHaveBeenCalled();
    },
  );
  it.each([
    [deleteFloodReport, "flood"],
    [deleteFireIncident, "fire"],
    [deleteEarthquakeRoadImpact, "impact"],
    [deleteEarthquakeEvent, "event"],
  ] as const)(
    "archives through the staff RPC for each removal handler",
    async (handler, kind) => {
      const res = response();
      await handler(request(), res as unknown as Response);
      expect(rpc).toHaveBeenCalledWith("archive_hazard", {
        p_kind: kind,
        p_id: id,
      });
      expect(from).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(204);
    },
  );
  it("fails safely when the archive migration is missing, without falling back to deletion", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "PGRST202" } });
    const res = response();
    await archiveHazard(request(), res as unknown as Response, "flood");
    expect(res.status).toHaveBeenCalledWith(503);
    expect(from).not.toHaveBeenCalled();
  });
  it("requires explicit restoration confirmation and a valid archive ID", async () => {
    for (const overrides of [
      { body: { confirmed: false } },
      { params: { id: "bad" } },
    ]) {
      const res = response();
      await restoreHazard(request(overrides), res as unknown as Response);
      expect(res.status).toHaveBeenCalledWith(400);
    }
    expect(rpc).not.toHaveBeenCalled();
  });
  it.each(["23505", "23503"])(
    "keeps the archive and reports a conflict for %s",
    async (code) => {
      rpc.mockResolvedValue({ data: null, error: { code } });
      const res = response();
      await restoreHazard(request(), res as unknown as Response);
      expect(res.status).toHaveBeenCalledWith(409);
      expect(rpc).toHaveBeenCalledWith("restore_hazard", { p_archive_id: id });
      expect(from).not.toHaveBeenCalled();
    },
  );
  it("reports concurrent/already restored records as missing", async () => {
    rpc.mockResolvedValue({ data: false, error: null });
    const res = response();
    await restoreHazard(request(), res as unknown as Response);
    expect(res.status).toHaveBeenCalledWith(404);
  });
  it("returns a private bounded archive page, including whether older records exist", async () => {
    const rows = Array.from({ length: 51 }, (_, n) => ({
      id: String(n),
      snapshot: { road_id: "test" },
    }));
    const q: any = {
      then: (resolve: (r: unknown) => unknown) =>
        resolve({ data: rows, error: null }),
    };
    for (const key of ["select", "order", "range"]) q[key] = vi.fn(() => q);
    from.mockReturnValue(q);
    const res = response();
    await listHazardArchives(
      request({ query: { offset: "50" } }),
      res as unknown as Response,
    );
    expect(q.range).toHaveBeenCalledWith(50, 100);
    expect(res.json.mock.calls[0][0].archives).toHaveLength(50);
    expect(res.json.mock.calls[0][0].hasMore).toBe(true);
    expect(res.setHeader).toHaveBeenCalledWith(
      "Cache-Control",
      "private, no-store",
    );
  });
  it("permanently deletes only the selected archive through the staff RPC", async () => {
    const res = response();
    await deleteHazardArchive(request(), res as unknown as Response);
    expect(rpc).toHaveBeenCalledWith("delete_hazard_archive", {
      p_archive_id: id,
      p_confirmed: true,
    });
    expect(from).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(204);
  });
  it.each([
    { body: {} },
    { body: { confirmed: false } },
    { params: { id: "invalid" } },
  ])(
    "rejects archive deletion without a valid ID and confirmation",
    async (overrides) => {
      const res = response();
      await deleteHazardArchive(request(overrides), res as unknown as Response);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(rpc).not.toHaveBeenCalled();
    },
  );
  it("does not report deletion success when the RPC fails", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "PGRST202" } });
    const res = response();
    await deleteHazardArchive(request(), res as unknown as Response);
    expect(res.status).toHaveBeenCalledWith(503);
    expect(from).not.toHaveBeenCalled();
  });
  it("returns 404 when an archive was already deleted or restored", async () => {
    rpc.mockResolvedValue({ data: false, error: null });
    const res = response();
    await deleteHazardArchive(request(), res as unknown as Response);
    expect(res.status).toHaveBeenCalledWith(404);
  });
  it.each(["flood", "fire", "impact"])(
    "permanently deletes active %s through a separate confirmed RPC",
    async (kind) => {
      const res = response();
      await deleteActiveHazard(
        request({ params: { id, kind } }),
        res as unknown as Response,
      );
      expect(rpc).toHaveBeenCalledWith("delete_active_hazard", {
        p_kind: kind,
        p_id: id,
        p_confirmed: true,
      });
      expect(from).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(204);
    },
  );
  it.each([
    { params: { id, kind: "event" } },
    { params: { id: "bad", kind: "flood" } },
    { params: { id, kind: "flood" }, body: {} },
  ])(
    "rejects unconfirmed or invalid active hazard deletion",
    async (overrides) => {
      const res = response();
      await deleteActiveHazard(request(overrides), res as unknown as Response);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(rpc).not.toHaveBeenCalled();
    },
  );
  it.each([
    { data: false, error: null, status: 404 },
    { data: null, error: { code: "PGRST202" }, status: 503 },
  ])("does not claim active hazard deletion on failure", async (result) => {
    rpc.mockResolvedValue(result);
    const res = response();
    await deleteActiveHazard(
      request({ params: { id, kind: "flood" } }),
      res as unknown as Response,
    );
    expect(res.status).toHaveBeenCalledWith(result.status);
    expect(from).not.toHaveBeenCalled();
  });
});
