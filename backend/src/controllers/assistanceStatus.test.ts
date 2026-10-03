import { describe, expect, it, vi } from "vitest";
import type { Response } from "express";
import type { RoleAwareRequest } from "../middleware/role.middleware";
import { updateAssistanceStatus } from "./assistance.controller";

const id = "ea956074-b82a-4df1-b9dc-b02ee7dbd542";
function client(data: unknown = { id, status: "ACKNOWLEDGED" }, error: unknown = null) {
  const query = { eq: vi.fn(), select: vi.fn(), maybeSingle: vi.fn().mockResolvedValue({ data, error }) };
  query.eq.mockReturnValue(query); query.select.mockReturnValue(query);
  const update = vi.fn(() => query);
  return { from: vi.fn(() => ({ update })), update, query };
}
async function call(db: ReturnType<typeof client>, body: unknown, role = "SUPER_ADMIN", requestId = id) {
  const res = { status: vi.fn(), json: vi.fn(), setHeader: vi.fn() };
  res.status.mockReturnValue(res);
  await updateAssistanceStatus({ body, params: { id: requestId }, profile: { role }, userSupabase: db } as unknown as RoleAwareRequest, res as unknown as Response);
  return res;
}
describe("assistance status updates", () => {
  it("denies barangay access before querying private requests", async () => {
    const db = client(); expect((await call(db, { status: "ACKNOWLEDGED" }, "BARANGAY_ADMIN")).status).toHaveBeenCalledWith(403);
    expect(db.from).not.toHaveBeenCalled();
  });
  it.each([null, {}, { status: "NEW" }, { status: "dispatched" }, { status: ["RESOLVED"] }])("rejects invalid status %j", async body => {
    const db = client(); expect((await call(db, body)).status).toHaveBeenCalledWith(400); expect(db.from).not.toHaveBeenCalled();
  });
  it("rejects invalid identifiers", async () => {
    const db = client(); expect((await call(db, { status: "RESOLVED" }, "SUPER_ADMIN", "bad")).status).toHaveBeenCalledWith(400);
    expect(db.from).not.toHaveBeenCalled();
  });
  it.each([["ACKNOWLEDGED", "NEW"], ["RESOLVED", "ACKNOWLEDGED"]])("requires the previous status for %s and ignores extra fields", async (status, previous) => {
    const db = client(); const res = await call(db, { status, latitude: 0, status_updated_by: "forged" });
    expect(db.update).toHaveBeenCalledWith({ status });
    expect(db.query.eq).toHaveBeenCalledWith("id", id); expect(db.query.eq).toHaveBeenCalledWith("status", previous);
    expect(res.json).toHaveBeenCalledWith({ request: { id, status: "ACKNOWLEDGED" } });
    expect(res.setHeader).toHaveBeenCalledWith("Cache-Control", "no-store");
  });
  it("reports a conflict instead of claiming a stale or missing record changed", async () => {
    expect((await call(client(null), { status: "RESOLVED" })).status).toHaveBeenCalledWith(409);
  });
  it("does not expose private database errors", async () => {
    const res = await call(client(null, { message: "private details" }), { status: "ACKNOWLEDGED" });
    expect(res.status).toHaveBeenCalledWith(503); expect(JSON.stringify(res.json.mock.calls)).not.toContain("private details");
  });
});
