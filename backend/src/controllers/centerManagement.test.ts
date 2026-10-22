import { describe, expect, it, vi } from "vitest";
import type { Response } from "express";
import type { RoleAwareRequest } from "../middleware/role.middleware";
import {
  centerUpdates,
  updateCenter,
  listAdminCenters,
  createCenter,
  deleteCenter,
} from "./centerManagement.controller";
const response = () => {
  const res = {
    status: vi.fn(),
    json: vi.fn(),
    end: vi.fn(),
    setHeader: vi.fn(),
  };
  res.status.mockReturnValue(res);
  return res;
};
const profile = {
  id: "staff",
  role: "BARANGAY_ADMIN" as const,
  barangay_id: "barangay-a",
  full_name: null,
};
function listClient(
  centers: unknown[] = [],
  barangayResult: { data: { name: string } | null; error: unknown } = {
    data: { name: "Malusak" },
    error: null,
  },
  centerError: unknown = null,
) {
  const centerQuery = {
    select: vi.fn(),
    order: vi.fn(),
    eq: vi.fn(),
    then: (resolve: (value: unknown) => unknown) =>
      Promise.resolve({ data: centers, error: centerError }).then(resolve),
  };
  centerQuery.select.mockReturnValue(centerQuery);
  centerQuery.order.mockReturnValue(centerQuery);
  centerQuery.eq.mockReturnValue(centerQuery);
  const barangayQuery = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue(barangayResult),
  };
  barangayQuery.select.mockReturnValue(barangayQuery);
  barangayQuery.eq.mockReturnValue(barangayQuery);
  const from = vi.fn((table: string) => {
    if (table === "evacuation_centers") return centerQuery;
    if (table === "barangays") return barangayQuery;
    throw new Error(`Unexpected table: ${table}`);
  });
  return { from, centerQuery, barangayQuery };
}
describe("assigned center workspace identity", () => {
  it("includes the assigned barangay name even when no centers exist", async () => {
    const client = listClient();
    const res = response();
    await listAdminCenters(
      { profile, userSupabase: client } as unknown as RoleAwareRequest,
      res as unknown as Response,
    );
    expect(client.centerQuery.eq).toHaveBeenCalledExactlyOnceWith(
      "barangay_id",
      profile.barangay_id,
    );
    expect(client.barangayQuery.select).toHaveBeenCalledExactlyOnceWith("name");
    expect(client.barangayQuery.eq).toHaveBeenCalledExactlyOnceWith(
      "id",
      profile.barangay_id,
    );
    expect(res.json).toHaveBeenCalledWith({
      centers: [],
      profile: {
        role: "BARANGAY_ADMIN",
        barangay_id: profile.barangay_id,
        barangay_name: "Malusak",
      },
    });
    expect(res.setHeader).toHaveBeenCalledWith("Cache-Control", "no-store");
  });
  it("uses the assigned name and preserves derived center status", async () => {
    const center = {
      id: "center-a",
      barangay_id: profile.barangay_id,
      current_occupancy: 75,
      capacity: 100,
      status: "AVAILABLE",
      barangays: { name: "A stale center name" },
    };
    const client = listClient([center]);
    const res = response();
    await listAdminCenters(
      { profile, userSupabase: client } as unknown as RoleAwareRequest,
      res as unknown as Response,
    );
    expect(res.json).toHaveBeenCalledWith({
      centers: [{ ...center, status: "NEARLY_FULL" }],
      profile: {
        role: "BARANGAY_ADMIN",
        barangay_id: profile.barangay_id,
        barangay_name: "Malusak",
      },
    });
  });
  it.each([
    { data: null, error: null },
    { data: null, error: { message: "Lookup unavailable" } },
  ])(
    "keeps centers accessible when the assigned name is unavailable",
    async (result) => {
      const client = listClient([], result);
      const res = response();
      await listAdminCenters(
        { profile, userSupabase: client } as unknown as RoleAwareRequest,
        res as unknown as Response,
      );
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        centers: [],
        profile: {
          role: "BARANGAY_ADMIN",
          barangay_id: profile.barangay_id,
          barangay_name: null,
        },
      });
    },
  );
  it("preserves the citywide view for a super admin without an assignment", async () => {
    const client = listClient();
    const res = response();
    await listAdminCenters(
      {
        profile: { ...profile, role: "SUPER_ADMIN", barangay_id: null },
        userSupabase: client,
      } as unknown as RoleAwareRequest,
      res as unknown as Response,
    );
    expect(client.centerQuery.eq).not.toHaveBeenCalled();
    expect(client.from).toHaveBeenCalledExactlyOnceWith("evacuation_centers");
    expect(res.json).toHaveBeenCalledWith({
      centers: [],
      profile: {
        role: "SUPER_ADMIN",
        barangay_id: null,
        barangay_name: null,
      },
    });
  });
  it("preserves center load errors without exposing assignment metadata", async () => {
    const client = listClient([], undefined, { message: "Unavailable" });
    const res = response();
    await listAdminCenters(
      { profile, userSupabase: client } as unknown as RoleAwareRequest,
      res as unknown as Response,
    );
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({
      error: "Could not load assigned centers.",
    });
    expect(client.from).toHaveBeenCalledExactlyOnceWith("evacuation_centers");
  });
});
describe("center role boundaries", () => {
  it.each([
    "capacity",
    "name",
    "barangayId",
    "notes",
    "waterStatus",
    "updated_by",
    "latitude",
  ])("blocks barangay metadata edits to %s", (key) => {
    expect(() => centerUpdates({ [key]: "forged" }, false)).toThrow();
  });
  it.each([-1, 0.5, NaN, "10", Infinity])(
    "rejects invalid occupancy %j",
    (value) => {
      expect(() => centerUpdates({ currentOccupancy: value }, false)).toThrow();
    },
  );
  it("accepts only operational fields for a barangay", () => {
    expect(
      centerUpdates({ currentOccupancy: 25, status: "CLOSED" }, false),
    ).toEqual({ current_occupancy: 25, status: "CLOSED" });
    expect(() => centerUpdates({ status: "FULL" }, false)).toThrow();
    expect(() => centerUpdates({ capacity: 10 }, true)).not.toThrow();
  });
  it("does not allow unassigned barangay profiles to load centers", async () => {
    const from = vi.fn(),
      res = response();
    await listAdminCenters(
      {
        profile: { ...profile, barangay_id: null },
        userSupabase: { from },
      } as unknown as RoleAwareRequest,
      res as unknown as Response,
    );
    expect(res.status).toHaveBeenCalledWith(403);
    expect(from).not.toHaveBeenCalled();
  });
  it("scopes reads to the authenticated barangay and denies cross-barangay writes", async () => {
    const query = {
      eq: vi.fn(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    query.eq.mockReturnValue(query);
    const update = vi.fn(),
      from = vi.fn(() => ({ select: () => query, update })),
      res = response();
    await updateCenter(
      {
        profile,
        params: { id: "another-center" },
        body: { currentOccupancy: 1 },
        userSupabase: { from },
      } as unknown as RoleAwareRequest,
      res as unknown as Response,
    );
    expect(query.eq).toHaveBeenCalledWith("barangay_id", "barangay-a");
    expect(res.status).toHaveBeenCalledWith(404);
    expect(update).not.toHaveBeenCalled();
  });
  it.each([createCenter, deleteCenter])(
    "rejects barangay record creation/deletion before querying",
    async (handler) => {
      const from = vi.fn(),
        res = response();
      await handler(
        { profile, userSupabase: { from } } as unknown as RoleAwareRequest,
        res as unknown as Response,
      );
      expect(res.status).toHaveBeenCalledWith(403);
      expect(from).not.toHaveBeenCalled();
    },
  );
});
