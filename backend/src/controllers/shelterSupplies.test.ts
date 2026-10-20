import { describe, expect, it, vi } from "vitest";
import type { Response } from "express";
import type { RoleAwareRequest } from "../middleware/role.middleware";
import { updateEvacuationCenter } from "./admin.controller";

async function call(body: unknown) {
  const query = {
    eq: vi.fn(),
    select: vi.fn(),
    single: vi.fn().mockResolvedValue({ data: { id: "center" }, error: null }),
    maybeSingle: vi
      .fn()
      .mockResolvedValue({
        data: {
          id: "center",
          latitude: 14.3146,
          longitude: 121.1137,
          capacity: 100,
          current_occupancy: 0,
        },
        error: null,
      }),
  };
  query.eq.mockReturnValue(query);
  query.select.mockReturnValue(query);
  const update = vi.fn(() => query);
  const from = vi.fn(() => ({ update, select: () => query }));
  const res = { status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  await updateEvacuationCenter(
    {
      body,
      params: { id: "center" },
      profile: { id: "staff", role: "SUPER_ADMIN", barangay_id: null },
      userSupabase: { from },
    } as unknown as RoleAwareRequest,
    res as unknown as Response,
  );
  return { update, from, res, query };
}
describe("shelter supplies", () => {
  it.each(["plentiful", null, 1, ["low"]])(
    "rejects invalid supply levels %j",
    async (value) => {
      const { res, from } = await call({ foodStatus: value });
      expect(res.status).toHaveBeenCalledWith(400);
      expect(from).not.toHaveBeenCalled();
    },
  );
  it("writes only supplied fields under the caller's identity", async () => {
    const { update, query } = await call({
      waterStatus: "low",
      medicalStatus: "unknown",
    });
    expect(update).toHaveBeenCalledWith({
      water_status: "low",
      medical_status: "unknown",
      updated_by: "staff",
    });
    expect(query.eq).toHaveBeenCalledWith("id", "center");
  });
});
