import { describe, expect, it, vi } from "vitest";
import type { Response } from "express";
import type { RoleAwareRequest } from "../middleware/role.middleware";
import { updateAssistanceStatus } from "./assistance.controller";
const id = "ea956074-b82a-4df1-b9dc-b02ee7dbd542";
function client(
  data: unknown = { id, status: "ACKNOWLEDGED", version: 2 },
  error: unknown = null,
) {
  const q: any = {};
  for (const key of ["eq", "in", "select"]) q[key] = vi.fn(() => q);
  q.maybeSingle = vi.fn(async () => ({ data, error }));
  const update = vi.fn(() => q);
  return { from: vi.fn(() => ({ update })), update, query: q };
}
async function call(
  db: ReturnType<typeof client>,
  body: unknown,
  role = "SUPER_ADMIN",
  requestId = id,
) {
  const r = { status: vi.fn(), json: vi.fn(), setHeader: vi.fn() };
  r.status.mockReturnValue(r);
  await updateAssistanceStatus(
    {
      body,
      params: { id: requestId },
      profile: { role },
      userSupabase: db,
    } as unknown as RoleAwareRequest,
    r as unknown as Response,
  );
  return r;
}
describe("audited assistance status actions", () => {
  it("denies barangay admins", async () => {
    const db = client();
    expect(
      (await call(db, { status: "ACKNOWLEDGED", version: 1 }, "BARANGAY_ADMIN"))
        .status,
    ).toHaveBeenCalledWith(403);
    expect(db.from).not.toHaveBeenCalled();
  });
  it.each([
    {},
    null,
    { status: "NEW", version: 1 },
    { status: "DISPATCHED", version: 1 },
    { status: "COMPLETED", version: 1 },
    { status: "CANCELLED", version: 1 },
    { status: "ACKNOWLEDGED", version: 0 },
  ])("rejects invalid or unconfirmed action %j", async (body) => {
    const db = client();
    expect((await call(db, body)).status).toHaveBeenCalledWith(400);
    expect(db.from).not.toHaveBeenCalled();
  });
  it.each([
    ["ACKNOWLEDGED", ["PENDING"]],
    ["DISPATCHED", ["ACKNOWLEDGED"]],
    ["COMPLETED", ["DISPATCHED"]],
    ["CANCELLED", ["PENDING", "ACKNOWLEDGED", "DISPATCHED"]],
  ])(
    "applies %s with optimistic version and transition guards",
    async (status, previous) => {
      const db = client();
      const r = await call(db, {
        status,
        version: 3,
        confirmed: true,
        status_updated_by: "forged",
        latitude: 0,
      });
      expect(db.update).toHaveBeenCalledWith({ status });
      expect(db.query.eq).toHaveBeenCalledWith("id", id);
      expect(db.query.eq).toHaveBeenCalledWith("version", 3);
      expect(db.query.in).toHaveBeenCalledWith("status", previous);
      expect(r.json).toHaveBeenCalled();
    },
  );
  it("returns conflict on concurrent updates", async () => {
    expect(
      (await call(client(null), { status: "ACKNOWLEDGED", version: 1 })).status,
    ).toHaveBeenCalledWith(409);
  });
  it("does not disclose database errors", async () => {
    const r = await call(client(null, { message: "private SQL" }), {
      status: "ACKNOWLEDGED",
      version: 1,
    });
    expect(r.status).toHaveBeenCalledWith(503);
    expect(JSON.stringify(r.json.mock.calls)).not.toContain("private SQL");
  });
});
