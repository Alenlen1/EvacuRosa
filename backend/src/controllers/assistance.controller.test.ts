import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import type { RoleAwareRequest } from "../middleware/role.middleware";
const mocks = vi.hoisted(() => ({ db: vi.fn(), insert: vi.fn(), route: vi.fn(), evacuation: vi.fn() }));
vi.mock("../database/supabase", () => ({ getSupabase: mocks.db }));
vi.mock("../services/routing.service", () => ({ computeRoute: mocks.route }));
vi.mock("../services/evacuationRouting.service", () => ({ computeEvacuationRoute: mocks.evacuation }));
import { allowSubmission, listAssistance, postAssistance, validSubmission } from "./assistance.controller";
import { requireRole } from "../middleware/role.middleware";
const now = Date.now();
function data() { return {
  id: "ea956074-b82a-4df1-b9dc-b02ee7dbd542", consent: true,
  start: { latitude: 14.3, longitude: 121.1 }, destination: { latitude: 14.31, longitude: 121.1 },
  accuracy: 20, recordedAt: new Date(now).toISOString(), travelMode: "walking", kind: "route",
}; }
function response() {
  const r = { status: vi.fn(), json: vi.fn(), setHeader: vi.fn() };
  r.status.mockReturnValue(r); return r;
}
let ip = 0;
async function post(body: unknown) {
  const r = response();
  await postAssistance({ body, ip: `test-${ip++}` } as Request, r as unknown as Response);
  return r;
}
describe("private assistance intake", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.db.mockReturnValue({ from: () => ({ insert: mocks.insert }) });
    mocks.insert.mockResolvedValue({ error: null });
    mocks.route.mockResolvedValue({ found: false, failureReason: "HAZARD_BLOCKED" });
    mocks.evacuation.mockResolvedValue({ found: false, failureReason: "HAZARD_BLOCKED" });
  });
  it("requires explicit consent, finite coordinates, freshness and bounded fields", () => {
    expect(validSubmission(data(), now)).toBe(true);
    for (const bad of [null, {}, { ...data(), consent: false }, { ...data(), start: { latitude: Infinity, longitude: 121 } },
      { ...data(), accuracy: -1 }, { ...data(), recordedAt: "invalid" }, { ...data(), recordedAt: new Date(now - 121000).toISOString() },
      { ...data(), recordedAt: new Date(now + 40000).toISOString() }, { ...data(), name: "a".repeat(101) },
      { ...data(), contact: "<script>" }, { ...data(), travelMode: "aircraft" }, { ...data(), kind: "evacuation" }]) {
      expect(validSubmission(bad, now)).toBe(false);
    }
  });
  it("does not insert or calculate routes without consent", async () => {
    expect((await post({ ...data(), consent: false })).status).toHaveBeenCalledWith(400);
    expect(mocks.insert).not.toHaveBeenCalled(); expect(mocks.route).not.toHaveBeenCalled();
  });
  it("rechecks hazards and stores only approved fields", async () => {
    const r = await post({ ...data(), name: " Alex ", role: "SUPER_ADMIN" });
    expect(r.status).toHaveBeenCalledWith(201);
    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({ display_name: "Alex", consent_version: "location-sharing-v1" }));
    expect(mocks.insert.mock.calls[0][0]).not.toHaveProperty("role");
    expect(r.setHeader).toHaveBeenCalledWith("Cache-Control", "no-store");
  });
  it("rechecks evacuation failures too", async () => {
    const { destination, ...body } = data();
    await post({ ...body, kind: "evacuation" });
    expect(mocks.evacuation).toHaveBeenCalledWith(body.start, body.travelMode);
    expect(mocks.route).not.toHaveBeenCalled();
  });
  it.each([{ found: true }, { found: false }])("rejects unconfirmed blockage %j", async result => {
    mocks.route.mockResolvedValue(result);
    expect((await post(data())).status).toHaveBeenCalledWith(409);
    expect(mocks.insert).not.toHaveBeenCalled();
  });
  it("handles duplicate retries without overwriting a snapshot", async () => {
    mocks.insert.mockResolvedValue({ error: { code: "23505" } });
    expect((await post(data())).status).toHaveBeenCalledWith(201);
  });
  it("reports database failure without leaking database details", async () => {
    mocks.insert.mockResolvedValue({ error: { code: "42P01", message: "private SQL" } });
    const r = await post(data());
    expect(r.status).toHaveBeenCalledWith(503);
    expect(JSON.stringify(r.json.mock.calls)).not.toContain("private SQL");
  });
  it("rate limits repeated submissions", () => {
    for (let n = 0; n < 5; n++) expect(allowSubmission("limited", now)).toBe(true);
    expect(allowSubmission("limited", now)).toBe(false);
    expect(allowSubmission("limited", now + 15 * 60000)).toBe(true);
  });
  it("denies anonymous and barangay readers before touching the database", async () => {
    for (const req of [{}, { profile: { role: "BARANGAY_ADMIN" }, userSupabase: {} }]) {
      const r = response();
      await listAssistance(req as RoleAwareRequest, r as unknown as Response);
      expect(r.status).toHaveBeenCalledWith(403);
    }
    expect(mocks.db).not.toHaveBeenCalled();
  });
  it("uses the authenticated CDRRMO client for dashboard reads", async () => {
    const limit = vi.fn().mockResolvedValue({ data: [{ id: "test" }], error: null });
    const from = vi.fn(() => ({ select: () => ({ order: () => ({ limit }) }) }));
    const r = response();
    await listAssistance({ profile: { role: "SUPER_ADMIN" }, userSupabase: { from } } as unknown as RoleAwareRequest, r as unknown as Response);
    expect(from).toHaveBeenCalledWith("assistance_requests"); expect(limit).toHaveBeenCalledWith(100);
    expect(mocks.db).not.toHaveBeenCalled();
  });
  it("admin role middleware excludes barangay admins", () => {
    const r = response(); const next = vi.fn();
    requireRole("SUPER_ADMIN")({ profile: { role: "BARANGAY_ADMIN" } } as RoleAwareRequest, r as unknown as Response, next);
    expect(r.status).toHaveBeenCalledWith(403); expect(next).not.toHaveBeenCalled();
  });
});
