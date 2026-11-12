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
    "waterStatus",
    "foodStatus",
    "medicalStatus",
    "suppliesUpdatedAt",
    "water_status",
    "food_status",
    "medical_status",
    "supplies_updated_at",
  ])(
    "rejects retired supply field %s for both roles, including mixed updates",
    (key) => {
      for (const superAdmin of [false, true]) {
        expect(() => centerUpdates({ [key]: "low" }, superAdmin)).toThrow();
        expect(() =>
          centerUpdates(
            {
              [superAdmin ? "name" : "currentOccupancy"]: superAdmin
                ? "Center"
                : 5,
              [key]: "low",
            },
            superAdmin,
          ),
        ).toThrow();
      }
    },
  );
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

describe("selected-barangay center assignment", () => {
  const aplayaId = "11111111-1111-4111-8111-111111111111";
  const sinalhanId = "22222222-2222-4222-8222-222222222222";
  const entrance = {
    latitude: 14.321186738188034,
    longitude: 121.11866693614958,
  };
  const center = {
    id: "center-a",
    barangay_id: aplayaId,
    ...entrance,
    capacity: 100,
    current_occupancy: 10,
  };
  const details = {
    barangayId: aplayaId,
    name: "Verified shelter",
    address: "Entrance address",
    capacity: 100,
    ...entrance,
  };
  function client(
    barangayId: string | null = aplayaId,
    lookupError: unknown = null,
  ) {
    const read = {
      eq: vi.fn(),
      maybeSingle: vi.fn().mockResolvedValue({ data: center, error: null }),
    };
    read.eq.mockReturnValue(read);
    const write = {
      eq: vi.fn(),
      select: vi.fn(),
      single: vi.fn().mockResolvedValue({ data: center, error: null }),
    };
    write.eq.mockReturnValue(write);
    write.select.mockReturnValue(write);
    const records = {
      select: vi.fn(() => read),
      insert: vi.fn(() => write),
      update: vi.fn(() => write),
    };
    const barangays = {
      select: vi.fn(),
      eq: vi.fn(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: barangayId ? { id: barangayId } : null,
        error: lookupError,
      }),
    };
    barangays.select.mockReturnValue(barangays);
    barangays.eq.mockReturnValue(barangays);
    return {
      records,
      barangays,
      from: vi.fn((table) => (table === "barangays" ? barangays : records)),
    };
  }
  async function call(
    handler: typeof createCenter,
    body: unknown,
    db = client(),
    role = "SUPER_ADMIN",
  ) {
    const res = response();
    await handler(
      {
        profile: { ...profile, role },
        params: { id: center.id },
        body,
        userSupabase: db,
      } as unknown as RoleAwareRequest,
      res as unknown as Response,
    );
    return { res, db };
  }

  it("rejects creation without a selected barangay instead of assigning automatically", async () => {
    const { barangayId: _id, ...withoutAssignment } = details;
    const { res, db } = await call(createCenter, withoutAssignment);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(db.records.insert).not.toHaveBeenCalled();
    expect(db.barangays.eq).not.toHaveBeenCalled();
  });
  it("accepts a matching assignment", async () => {
    const { res } = await call(createCenter, {
      ...details,
      barangayId: aplayaId,
    });
    expect(res.status).toHaveBeenCalledWith(201);
  });
  it("rejects a forged Sinalhan assignment for an Aplaya entrance on creation", async () => {
    const { res, db } = await call(createCenter, {
      ...details,
      barangayId: sinalhanId,
    });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: expect.stringContaining("This entrance is in Aplaya"),
    });
    expect(db.records.insert).not.toHaveBeenCalled();
  });
  it("rejects moving to another barangay without selecting the new assignment", async () => {
    const { res, db } = await call(
      updateCenter,
      { latitude: 14.330227, longitude: 121.110327 },
      client(sinalhanId),
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(db.records.update).not.toHaveBeenCalled();
  });
  it("allows moving the entrance after selecting its matching new barangay", async () => {
    const { res, db } = await call(
      updateCenter,
      { barangayId: sinalhanId, latitude: 14.330227, longitude: 121.110327 },
      client(sinalhanId),
    );
    expect(res.json).toHaveBeenCalledWith({ center });
    expect(db.barangays.eq).toHaveBeenCalledWith("name", "Sinalhan");
    expect(db.records.update).toHaveBeenCalledWith(
      expect.objectContaining({ barangay_id: sinalhanId }),
    );
  });
  it("validates assignment-only edits against the existing entrance", async () => {
    const { res, db } = await call(updateCenter, { barangayId: sinalhanId });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(db.records.update).not.toHaveBeenCalled();
  });
  it("rejects mismatched assignments even when coordinates are included", async () => {
    const { res, db } = await call(updateCenter, {
      ...entrance,
      barangayId: sinalhanId,
    });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(db.records.update).not.toHaveBeenCalled();
  });
  it("checks partial coordinate updates using the unchanged coordinate", async () => {
    const { res, db } = await call(updateCenter, {
      latitude: entrance.latitude,
    });
    expect(res.json).toHaveBeenCalledWith({ center });
    expect(db.barangays.eq).toHaveBeenCalledWith("name", "Aplaya");
  });
  it.each([null, { message: "database unavailable" }])(
    "does not save if the geographic barangay lookup fails: %j",
    async (error) => {
      const { res, db } = await call(
        createCenter,
        details,
        client(null, error),
      );
      expect(res.status).toHaveBeenCalledWith(400);
      expect(db.records.insert).not.toHaveBeenCalled();
    },
  );
  it("rejects an outside-city entrance before querying barangays or saving", async () => {
    const { res, db } = await call(createCenter, {
      ...details,
      latitude: 0,
      longitude: 0,
    });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(db.barangays.eq).not.toHaveBeenCalled();
    expect(db.records.insert).not.toHaveBeenCalled();
  });
  it("keeps barangay occupancy updates scoped without changing assignment", async () => {
    const { db } = await call(
      updateCenter,
      { currentOccupancy: 12 },
      client(),
      "BARANGAY_ADMIN",
    );
    expect(db.barangays.eq).not.toHaveBeenCalled();
    expect(db.records.update).toHaveBeenCalledWith({
      current_occupancy: 12,
      updated_by: profile.id,
    });
  });
});
