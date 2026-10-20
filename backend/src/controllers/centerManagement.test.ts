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
