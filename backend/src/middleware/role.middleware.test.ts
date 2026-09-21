import { describe, expect, it, vi } from "vitest";
import { attachProfile, requireRole, type RoleAwareRequest } from "./role.middleware";

function makeRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

function makeSupabaseReturning(result: { data: unknown; error: unknown }) {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          single: async () => result,
        }),
      }),
    }),
  };
}

describe("attachProfile", () => {
  it("rejects when there's no authenticated user on the request at all", async () => {
    const req = {} as RoleAwareRequest;
    const res = makeRes();
    const next = vi.fn();

    await attachProfile(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects when the authenticated user has no matching profiles row", async () => {
    const req = {
      supabaseUser: { id: "user-1" },
      userSupabase: makeSupabaseReturning({ data: null, error: { message: "not found" } }),
    } as unknown as RoleAwareRequest;
    const res = makeRes();
    const next = vi.fn();

    await attachProfile(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("attaches the profile and continues when one exists", async () => {
    const profile = { id: "user-1", role: "SUPER_ADMIN", barangay_id: null, full_name: "Test" };
    const req = {
      supabaseUser: { id: "user-1" },
      userSupabase: makeSupabaseReturning({ data: profile, error: null }),
    } as unknown as RoleAwareRequest;
    const res = makeRes();
    const next = vi.fn();

    await attachProfile(req, res, next);

    expect(req.profile).toEqual(profile);
    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });
});

describe("requireRole", () => {
  it("rejects a BARANGAY_ADMIN from a SUPER_ADMIN-only action", () => {
    const req = {
      profile: { id: "u1", role: "BARANGAY_ADMIN", barangay_id: "b1", full_name: null },
    } as RoleAwareRequest;
    const res = makeRes();
    const next = vi.fn();

    requireRole("SUPER_ADMIN")(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("allows a SUPER_ADMIN through a SUPER_ADMIN-only action", () => {
    const req = {
      profile: { id: "u1", role: "SUPER_ADMIN", barangay_id: null, full_name: null },
    } as RoleAwareRequest;
    const res = makeRes();
    const next = vi.fn();

    requireRole("SUPER_ADMIN")(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("rejects when there's no profile on the request at all", () => {
    const req = {} as RoleAwareRequest;
    const res = makeRes();
    const next = vi.fn();

    requireRole("SUPER_ADMIN")(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});
