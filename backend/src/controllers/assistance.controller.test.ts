import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import type { RoleAwareRequest } from "../middleware/role.middleware";
const mocks = vi.hoisted(() => ({ db: vi.fn(), rpc: vi.fn(), from: vi.fn() }));
vi.mock("../database/supabase", () => ({ getSupabase: mocks.db }));
vi.mock("../services/assistanceLocation.service", () => ({
  createAssistanceLocationLookup: () => () => null,
}));
import {
  postAssistance,
  validSubmission,
  allowSubmission,
  listAssistance,
  deleteAssistance,
  getTrackedAssistance,
  cancelTrackedAssistance,
  recoverTrackedAssistance,
} from "./assistance.controller";
import {
  issueTrackingToken,
  trackingHash,
} from "../services/assistanceTracking.service";
const id = "ea956074-b82a-4df1-b9dc-b02ee7dbd542";
const row = {
  id,
  status: "PENDING",
  version: 1,
  latitude: 14.3,
  longitude: 121.1,
  tracking_expires_at: new Date(Date.now() + 86400000).toISOString(),
};
function data() {
  return {
    id,
    submissionKey: "a".repeat(64),
    consent: true,
    start: { latitude: 14.3, longitude: 121.1 },
    accuracy: 20,
    recordedAt: new Date().toISOString(),
    travelMode: "walking",
    kind: "emergency",
  };
}
function response() {
  const r = {
    status: vi.fn(),
    json: vi.fn(),
    setHeader: vi.fn(),
    end: vi.fn(),
  };
  r.status.mockReturnValue(r);
  return r;
}
function query(
  result: { data: unknown; error: unknown } = { data: row, error: null },
) {
  const q: any = {};
  for (const key of [
    "select",
    "eq",
    "neq",
    "in",
    "order",
    "limit",
    "delete",
    "update",
    "lte",
  ])
    q[key] = vi.fn(() => q);
  q.maybeSingle = vi.fn(async () => result);
  q.then = (resolve: any, reject: any) =>
    Promise.resolve(result).then(resolve, reject);
  return q;
}
let ip = 0;
async function post(body: unknown) {
  const r = response();
  await postAssistance(
    { body, ip: `test-${ip++}` } as Request,
    r as unknown as Response,
  );
  return r;
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("ASSISTANCE_TRACKING_SECRET", "isolated-test-secret-".repeat(3));
  mocks.db.mockReturnValue({ rpc: mocks.rpc, from: mocks.from });
  mocks.rpc.mockResolvedValue({ data: row, error: null });
  mocks.from.mockReturnValue(query({ data: [], error: null }));
});
describe("private tracked assistance intake", () => {
  it("validates consent, cryptographic retry key, freshness and bounded location fields", () => {
    expect(validSubmission(data())).toBe(true);
    for (const invalid of [
      null,
      {},
      { ...data(), submissionKey: "short" },
      { ...data(), consent: false },
      { ...data(), start: { latitude: Infinity, longitude: 121 } },
      { ...data(), accuracy: -1 },
      { ...data(), recordedAt: "invalid" },
      { ...data(), recordedAt: new Date(Date.now() - 121000).toISOString() },
      { ...data(), name: "x".repeat(101) },
      { ...data(), contact: "<script>" },
      { ...data(), travelMode: "aircraft" },
    ])
      expect(validSubmission(invalid)).toBe(false);
  });
  it("never saves without explicit consent", async () => {
    expect(
      (await post({ ...data(), consent: false })).status,
    ).toHaveBeenCalledWith(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("accepts direct emergency requests without requiring a blocked route and sends only approved fields", async () => {
    const r = await post({ ...data(), name: " Alex ", role: "SUPER_ADMIN" });
    expect(r.status).toHaveBeenCalledWith(201);
    const args = mocks.rpc.mock.calls[0][1];
    expect(args.p_request.display_name).toBe("Alex");
    expect(args.p_request.reason).toBe("EMERGENCY");
    expect(args.p_request).not.toHaveProperty("role");
    expect(args.p_token_hash).toMatch(/^[a-f0-9]{64}$/);
    const saved = r.json.mock.calls[0][0];
    expect(saved.trackingToken).toHaveLength(43);
    expect(args.p_token_hash).toBe(trackingHash(saved.trackingToken));
    expect(JSON.stringify(args)).not.toContain(saved.trackingToken);
    expect(r.setHeader).toHaveBeenCalledWith(
      "Cache-Control",
      "private, no-store",
    );
  });
  it("derives the same tracking capability on retry but different ones for other owners", () => {
    const one = issueTrackingToken(id, "a".repeat(64));
    expect(issueTrackingToken(id, "a".repeat(64))).toBe(one);
    expect(issueTrackingToken(id, "b".repeat(64))).not.toBe(one);
  });
  it("fails closed when the server tracking secret is missing", async () => {
    vi.stubEnv("ASSISTANCE_TRACKING_SECRET", "");
    expect((await post(data())).status).toHaveBeenCalledWith(503);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("never treats duplicate conflicts or database failures as proof of saved ownership", async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { code: "23505", message: "private database error" },
    });
    const r = await post(data());
    expect(r.status).toHaveBeenCalledWith(503);
    expect(JSON.stringify(r.json.mock.calls)).not.toContain(
      "private database error",
    );
  });
  it("returns the same saved request when the atomic RPC confirms a retry", async () => {
    const a = await post(data()),
      b = await post(data());
    expect(a.json.mock.calls[0][0].trackingToken).toBe(
      b.json.mock.calls[0][0].trackingToken,
    );
    expect(mocks.rpc.mock.calls[0][1].p_request.id).toBe(
      mocks.rpc.mock.calls[1][1].p_request.id,
    );
  });
  it("rate limits excessive submissions and releases the cooldown", () => {
    for (let i = 0; i < 5; i++)
      expect(allowSubmission("rate-case", 100)).toBe(true);
    expect(allowSubmission("rate-case", 100)).toBe(false);
    expect(allowSubmission("rate-case", 100 + 15 * 60_000)).toBe(true);
  });
});
describe("request-specific tracking", () => {
  it.each(["", "Bearer guessed", "Bearer " + "a".repeat(42)])(
    "rejects absent or malformed capabilities before reading personal data",
    async (authorization) => {
      const r = response();
      await getTrackedAssistance(
        { headers: { authorization }, params: { id } } as unknown as Request,
        r as unknown as Response,
      );
      expect(r.status).toHaveBeenCalledWith(404);
      expect(mocks.from).not.toHaveBeenCalled();
    },
  );
  it("queries both the request ID and token hash, never a public ID alone", async () => {
    const q = query();
    mocks.from.mockImplementation((table) =>
      table === "assistance_requests" ? q : query({ data: [], error: null }),
    );
    const r = response();
    const token = "a".repeat(43);
    await getTrackedAssistance(
      {
        headers: { authorization: `Bearer ${token}` },
        params: { id },
      } as unknown as Request,
      r as unknown as Response,
    );
    expect(q.eq).toHaveBeenCalledWith("id", id);
    expect(q.eq).toHaveBeenCalledWith(
      "tracking_token_hash",
      trackingHash(token),
    );
    expect(r.json.mock.calls[0][0].request.id).toBe(id);
  });
  it("denies expired tracking", async () => {
    mocks.from.mockReturnValue(
      query({
        data: { ...row, tracking_expires_at: "2000-01-01" },
        error: null,
      }),
    );
    const r = response();
    await getTrackedAssistance(
      {
        headers: { authorization: "Bearer " + "a".repeat(43) },
        params: { id },
      } as unknown as Request,
      r as unknown as Response,
    );
    expect(r.status).toHaveBeenCalledWith(404);
  });
  it("rejects cancellation without a capability", async () => {
    const r = response();
    await cancelTrackedAssistance(
      { headers: {}, params: { id } } as unknown as Request,
      r as unknown as Response,
    );
    expect(r.status).toHaveBeenCalledWith(404);
  });
  it("rejects malformed recovery keys", async () => {
    const r = response();
    await recoverTrackedAssistance(
      {
        headers: {},
        params: { id },
        body: { submissionKey: "guess" },
      } as unknown as Request,
      r as unknown as Response,
    );
    expect(r.status).toHaveBeenCalledWith(400);
  });
});
describe("CDRRMO assistance access", () => {
  it.each(["BARANGAY_ADMIN", undefined])(
    "denies role %s before accessing private records",
    async (role) => {
      for (const action of [listAssistance, deleteAssistance]) {
        const r = response();
        await action(
          {
            params: { id },
            query: {},
            profile: role ? { role } : undefined,
            userSupabase: { from: mocks.from },
          } as unknown as RoleAwareRequest,
          r as unknown as Response,
        );
        expect(r.status).toHaveBeenCalledWith(403);
      }
      expect(mocks.from).not.toHaveBeenCalled();
    },
  );
  it("uses the staff JWT client and returns no tracking hashes", async () => {
    const q = query({ data: [], error: null }),
      from = vi.fn(() => q);
    const r = response();
    await listAssistance(
      {
        query: {},
        profile: { role: "SUPER_ADMIN" },
        userSupabase: { from },
      } as unknown as RoleAwareRequest,
      r as unknown as Response,
    );
    expect(from).toHaveBeenCalledWith("assistance_requests");
    expect(q.select.mock.calls[0][0]).not.toContain("tracking_token_hash");
    expect(q.neq).toHaveBeenCalledWith("status", "CANCELLED");
    expect(q.neq.mock.invocationCallOrder[0]).toBeLessThan(
      q.limit.mock.invocationCallOrder[0],
    );
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("excludes cancellations without removing other staff status filters", async () => {
    const q = query({ data: [], error: null }),
      r = response();
    await listAssistance(
      {
        query: { status: "PENDING" },
        profile: { role: "SUPER_ADMIN" },
        userSupabase: { from: () => q },
      } as unknown as RoleAwareRequest,
      r as unknown as Response,
    );
    expect(q.neq).toHaveBeenCalledWith("status", "CANCELLED");
    expect(q.eq).toHaveBeenCalledWith("status", "PENDING");
    expect(q.delete).not.toHaveBeenCalled();
  });
  it("deletes only closed records", async () => {
    const q = query({ data: [{ id }], error: null }),
      r = response();
    await deleteAssistance(
      {
        params: { id },
        profile: { role: "SUPER_ADMIN" },
        userSupabase: { from: () => q },
      } as unknown as RoleAwareRequest,
      r as unknown as Response,
    );
    expect(q.eq).toHaveBeenCalledWith("id", id);
    expect(q.in).toHaveBeenCalledWith("status", ["COMPLETED", "CANCELLED"]);
    expect(r.status).toHaveBeenCalledWith(204);
  });
});
