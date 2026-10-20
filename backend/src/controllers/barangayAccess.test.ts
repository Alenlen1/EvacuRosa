import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
const mocks = vi.hoisted(() => ({ service: vi.fn(), signIn: vi.fn() }));
vi.mock("../database/supabase", () => ({ getSupabase: mocks.service }));
vi.mock("../config/environment", () => ({
  env: { supabaseUrl: "https://test.invalid", supabaseAnonKey: "public-test" },
}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ auth: { signInWithPassword: mocks.signIn } }),
}));
import {
  allowBarangayLogin,
  signInBarangay,
} from "./barangayAccess.controller";
const id = "10000000-0000-4000-8000-000000000001";
const res = () => {
  const r = { status: vi.fn(), json: vi.fn(), setHeader: vi.fn() };
  r.status.mockReturnValue(r);
  return r;
};
function service(barangay = id, role = "BARANGAY_ADMIN") {
  const query = (data: unknown) => {
    const q = {
      select: vi.fn(),
      eq: vi.fn(),
      single: async () => ({ data }),
      maybeSingle: async () => ({ data }),
    };
    q.select.mockReturnValue(q);
    q.eq.mockReturnValue(q);
    return q;
  };
  return {
    from: (table: string) =>
      query(
        table === "profiles"
          ? { role, barangay_id: barangay }
          : { user_id: "user" },
      ),
    auth: {
      admin: {
        getUserById: async () => ({
          data: { user: { email: "private@test.invalid" } },
        }),
      },
    },
  };
}
describe("barangay access-code authentication", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.service.mockReturnValue(service());
  });
  it("rate limits attempts and allows them after the cooldown", () => {
    for (let i = 0; i < 10; i++)
      expect(allowBarangayLogin("rate-test", 100)).toBe(true);
    expect(allowBarangayLogin("rate-test", 100)).toBe(false);
    expect(allowBarangayLogin("rate-test", 100 + 15 * 60_000)).toBe(true);
  });
  it.each(["wrong-barangay", "SUPER_ADMIN"])(
    "does not exchange a code for an account with %s identity",
    async (mismatch) => {
      mocks.service.mockReturnValue(
        mismatch === "SUPER_ADMIN" ? service(id, mismatch) : service(mismatch),
      );
      const r = res();
      await signInBarangay(
        {
          body: { barangayId: id, code: "123456" },
          ip: mismatch,
        } as Request,
        r as unknown as Response,
      );
      expect(r.status).toHaveBeenCalledWith(401);
      expect(mocks.signIn).not.toHaveBeenCalled();
    },
  );
  it.each(["000123", "654321", "abcdef", "ABCDEF", "Ab12Cd"])(
    "issues only session tokens after Supabase verifies code %s",
    async (code) => {
      mocks.signIn.mockResolvedValue({
        data: {
          user: { id: "user" },
          session: { access_token: "access", refresh_token: "refresh" },
        },
        error: null,
      });
      const r = res();
      await signInBarangay(
        {
          body: { barangayId: id, code },
          ip: "success",
        } as Request,
        r as unknown as Response,
      );
      expect(mocks.signIn).toHaveBeenCalledWith({
        email: "private@test.invalid",
        password: code,
      });
      expect(r.json).toHaveBeenCalledWith({
        access_token: "access",
        refresh_token: "refresh",
      });
    },
  );
  it.each([
    "",
    "12345",
    "1234567",
    "Ab12C!",
    "Ab 123",
    " Ab123",
    "private-code-123",
    "x".repeat(129),
    123456,
    null,
  ])(
    "rejects invalid code input before checking credentials (%s)",
    async (code) => {
      const r = res();
      await signInBarangay(
        {
          body: { barangayId: id, code },
          ip: `invalid-${String(code)}`,
        } as Request,
        r as unknown as Response,
      );
      expect(r.status).toHaveBeenCalledWith(401);
      expect(mocks.service).not.toHaveBeenCalled();
      expect(mocks.signIn).not.toHaveBeenCalled();
    },
  );
  it("rejects incorrect codes without issuing a session", async () => {
    mocks.signIn.mockResolvedValue({
      data: { session: null },
      error: { message: "Wrong password" },
    });
    const r = res();
    await signInBarangay(
      {
        body: { barangayId: id, code: "999999" },
        ip: "failure",
      } as Request,
      r as unknown as Response,
    );
    expect(r.status).toHaveBeenCalledWith(401);
    expect(mocks.signIn).toHaveBeenCalled();
  });
});
