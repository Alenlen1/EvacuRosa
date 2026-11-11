import { describe, expect, it, vi } from "vitest";
import {
  recoveryFailure,
  requestRecoveryCode,
  resetRecoveredPassword,
  validateRecoveryEmail,
  validateRecoveryPassword,
  verifyRecoveryCode,
} from "./passwordRecovery";

const email = "staff@example.test";
const password = "StrongNewPassword1!";
function fixture() {
  const user = { id: "assigned-staff", email };
  return {
    resetPasswordForEmail: vi.fn().mockResolvedValue({ data: {}, error: null }),
    verifyOtp: vi
      .fn()
      .mockResolvedValue({ data: { user, session: { user } }, error: null }),
    getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
    getSession: vi
      .fn()
      .mockResolvedValue({ data: { session: { user } }, error: null }),
    updateUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
  };
}
describe("email-code password recovery", () => {
  it("requests recovery only for syntactically valid email, without signing up", async () => {
    const auth = fixture();
    expect(validateRecoveryEmail("staff@example-test")).toBeTruthy();
    await expect(requestRecoveryCode(auth, "bad-email")).rejects.toMatchObject({
      code: "invalid_recovery_email",
    });
    expect(auth.resetPasswordForEmail).not.toHaveBeenCalled();
    await requestRecoveryCode(auth, " STAFF@EXAMPLE.TEST ");
    expect(auth.resetPasswordForEmail).toHaveBeenCalledExactlyOnceWith(email, undefined);
    expect(auth.verifyOtp).not.toHaveBeenCalled();
    expect(auth.updateUser).not.toHaveBeenCalled();
  });
  it("returns legacy reset emails to the password recovery form on this staff website", async () => {
    const auth = fixture();
    const redirectTo = "http://localhost:3001/admin/login?recovery=1";
    await requestRecoveryCode(auth, email, redirectTo);
    expect(auth.resetPasswordForEmail).toHaveBeenCalledExactlyOnceWith(email, { redirectTo });
  });
  it.each(["user_not_found", "email_not_confirmed", "user_banned"])(
    "does not reveal %s when requesting a code",
    async (code) => {
      const auth = fixture();
      auth.resetPasswordForEmail.mockResolvedValue({
        data: null,
        error: { code },
      } as never);
      await expect(requestRecoveryCode(auth, email)).resolves.toBeUndefined();
    },
  );
  it("keeps delivery and rate-limit failures visible without leaking raw details", async () => {
    const auth = fixture();
    auth.resetPasswordForEmail.mockResolvedValue({
      data: null,
      error: { status: 429, code: "over_email_send_rate_limit" },
    } as never);
    await expect(requestRecoveryCode(auth, email)).rejects.toMatchObject({
      status: 429,
    });
    expect(recoveryFailure({ status: 429 }, "email").message).toContain(
      "Too many",
    );
    expect(
      recoveryFailure({ message: "private SMTP configuration" }, "email")
        .message,
    ).not.toContain("private SMTP");
  });
  it("verifies a recovery code, never a generic sign-in OTP", async () => {
    const auth = fixture();
    await expect(
      verifyRecoveryCode(auth, email, "12345"),
    ).rejects.toMatchObject({ code: "invalid_recovery_code" });
    expect(auth.verifyOtp).not.toHaveBeenCalled();
    expect(
      await verifyRecoveryCode(auth, " STAFF@EXAMPLE.TEST ", "123456"),
    ).toBe("assigned-staff");
    expect(auth.verifyOtp).toHaveBeenCalledExactlyOnceWith({
      email,
      token: "123456",
      type: "recovery",
    });
    expect(auth.updateUser).not.toHaveBeenCalled();
  });
  it("rejects invalid or expired codes and mismatched recovery identities", async () => {
    const auth = fixture();
    auth.verifyOtp.mockResolvedValueOnce({
      data: { user: null, session: null },
      error: { code: "otp_expired" },
    } as never);
    await expect(
      verifyRecoveryCode(auth, email, "123456"),
    ).rejects.toMatchObject({ code: "otp_expired" });
    await expect(
      verifyRecoveryCode(auth, "other@example.test", "123456"),
    ).rejects.toMatchObject({ code: "session_changed" });
    auth.verifyOtp.mockResolvedValueOnce({
      data: { user: { id: "a", email }, session: { user: { id: "b", email } } },
      error: null,
    });
    await expect(
      verifyRecoveryCode(auth, email, "123456"),
    ).rejects.toMatchObject({ code: "session_changed" });
    expect(auth.updateUser).not.toHaveBeenCalled();
  });
  it("requires the same password policy and matching confirmation", () => {
    expect(validateRecoveryPassword("short", "different")).toEqual({
      next: expect.any(String),
      confirm: expect.any(String),
    });
    for (const value of [
      "onlylowercase1!",
      "ONLYUPPERCASE1!",
      "NoNumberHere!!",
      "NoSymbolHere123",
    ])
      expect(validateRecoveryPassword(value, value).next).toBeTruthy();
    expect(validateRecoveryPassword(password, password)).toEqual({});
  });
  it("updates only the password after verifying the recovered session identity", async () => {
    const auth = fixture();
    await resetRecoveredPassword(auth, "assigned-staff", password, password);
    expect(auth.getUser).toHaveBeenCalledOnce();
    expect(auth.updateUser).toHaveBeenCalledExactlyOnceWith({ password });
  });
  it.each(["", "other-account"])(
    "rejects an absent or changed recovery identity (%s)",
    async (id) => {
      const auth = fixture();
      await expect(
        resetRecoveredPassword(auth, id, password, password),
      ).rejects.toMatchObject({
        code: id ? "session_changed" : "session_missing",
      });
      expect(auth.updateUser).not.toHaveBeenCalled();
    },
  );
  it("rejects expired sessions and weak passwords without updating", async () => {
    const auth = fixture();
    await expect(
      resetRecoveredPassword(auth, "assigned-staff", "weak", "weak"),
    ).rejects.toMatchObject({ code: "weak_password" });
    auth.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    } as never);
    await expect(
      resetRecoveredPassword(auth, "assigned-staff", password, password),
    ).rejects.toMatchObject({ code: "session_changed" });
    expect(auth.updateUser).not.toHaveBeenCalled();
    expect(
      recoveryFailure({ code: "session_changed" }, "password").restart,
    ).toBe(true);
  });
});
