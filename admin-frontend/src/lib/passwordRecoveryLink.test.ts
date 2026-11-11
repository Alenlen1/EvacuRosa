import { describe, expect, it, vi } from "vitest";
import {
  detectWorkspaceSessionInUrl,
  takePasswordRecoveryLink,
  verifyPasswordRecoveryLink,
} from "./passwordRecoveryLink";

const tokens = { access_token: "test-access", refresh_token: "test-refresh" };
function browser(path: string) {
  return {
    location: { href: `https://staff.example.test${path}` },
    history: { state: { next: true }, replaceState: vi.fn() },
  } as unknown as Pick<Window, "location" | "history">;
}
function fixture() {
  const user = { id: "recovered-staff", email: "staff@example.test" };
  return {
    setSession: vi.fn().mockResolvedValue({ data: { user, session: { user } }, error: null }),
    getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
  };
}
describe("password reset links", () => {
  it("leaves ordinary sign-in and email-confirmation callbacks with the workspace client", () => {
    const normal = browser("/admin/login");
    expect(takePasswordRecoveryLink(normal)).toBeNull();
    expect(normal.history.replaceState).not.toHaveBeenCalled();
    expect(detectWorkspaceSessionInUrl(new URL(normal.location.href), {})).toBe(false);
    for (const params of [{ access_token: "email-confirmation" }, { error_code: "otp_expired" }])
      expect(detectWorkspaceSessionInUrl(new URL(normal.location.href), params)).toBe(true);
  });
  it.each(["", "?recovery=1"])("isolates both old and new recovery links (%s) and strips bearer tokens", (query) => {
    const context = browser(`/admin/login${query}#type=recovery&token_type=bearer&access_token=test-access&refresh_token=test-refresh`);
    expect(detectWorkspaceSessionInUrl(new URL(context.location.href), { access_token: tokens.access_token })).toBe(false);
    expect(takePasswordRecoveryLink(context)).toEqual({ tokens });
    expect(context.history.replaceState).toHaveBeenCalledExactlyOnceWith(context.history.state, "", "/admin/login");
  });
  it.each([
    "#error=access_denied&error_code=otp_expired&error_description=private-details",
    "#type=recovery&token_type=bearer&access_token=missing-refresh",
    "#type=signup&token_type=bearer&access_token=test-access&refresh_token=test-refresh",
    "",
  ])("rejects expired, incomplete, or unrelated links without using a stored session (%s)", async (hash) => {
    const context = browser(`/admin/login?recovery=1${hash}`);
    expect(detectWorkspaceSessionInUrl(new URL(context.location.href), { error: "access_denied" })).toBe(false);
    const link = takePasswordRecoveryLink(context);
    expect(link).toEqual({ invalid: true });
    const auth = fixture();
    await expect(verifyPasswordRecoveryLink(auth, link!)).rejects.toMatchObject({ code: "invalid_recovery_link" });
    expect(auth.setSession).not.toHaveBeenCalled();
    expect(auth.getUser).not.toHaveBeenCalled();
    expect(context.history.replaceState).toHaveBeenCalledWith(context.history.state, "", "/admin/login");
  });
  it("verifies link credentials with Auth before accepting a recovery identity", async () => {
    const auth = fixture();
    expect(await verifyPasswordRecoveryLink(auth, { tokens })).toEqual({ userId: "recovered-staff", email: "staff@example.test" });
    expect(auth.setSession).toHaveBeenCalledExactlyOnceWith(tokens);
    expect(auth.getUser).toHaveBeenCalledOnce();
  });
  it("rejects invalid credentials, revoked sessions, and different identities", async () => {
    const auth = fixture();
    auth.setSession.mockResolvedValueOnce({ data: { session: null }, error: { code: "invalid_jwt" } });
    await expect(verifyPasswordRecoveryLink(auth, { tokens })).rejects.toMatchObject({ code: "invalid_jwt" });
    expect(auth.getUser).not.toHaveBeenCalled();
    auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: { code: "session_not_found" } });
    await expect(verifyPasswordRecoveryLink(auth, { tokens })).rejects.toMatchObject({ code: "session_not_found" });
    auth.getUser.mockResolvedValueOnce({ data: { user: { id: "other", email: "other@example.test" } }, error: null });
    await expect(verifyPasswordRecoveryLink(auth, { tokens })).rejects.toMatchObject({ code: "session_changed" });
  });
});
