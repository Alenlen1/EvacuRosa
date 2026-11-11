import { describe, expect, it, vi } from "vitest";
import {
  changeOwnPassword,
  passwordChangeFailure,
  validatePasswordChange,
} from "./changePassword";

const values = {
  current: "OldPrivatePassword!",
  next: "NewPrivatePassword!",
  confirm: "NewPrivatePassword!",
};

function fixture() {
  const user = { id: "barangay-a", email: "staff@example.test" };
  const auth = {
    getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
    getSession: vi
      .fn()
      .mockResolvedValue({ data: { session: { user } }, error: null }),
    updateUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
  };
  const verifier = {
    signInWithPassword: vi
      .fn()
      .mockResolvedValue({ data: { user }, error: null }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
    dispose: vi.fn().mockResolvedValue(undefined),
  };
  return { auth, verifier, createVerifier: vi.fn(() => verifier) };
}

describe("password change validation", () => {
  it("requires all fields and a minimum of 12 characters", () => {
    expect(
      Object.keys(
        validatePasswordChange({ current: "", next: "", confirm: "" }),
      ),
    ).toEqual(["current", "next", "confirm"]);
    expect(
      validatePasswordChange({ ...values, next: "short", confirm: "short" })
        .next,
    ).toContain("12 characters");
  });
  it("rejects mismatched confirmation and reuse of the current password", () => {
    expect(
      validatePasswordChange({ ...values, confirm: "different" }).confirm,
    ).toContain("do not match");
    expect(
      validatePasswordChange({
        ...values,
        next: values.current,
        confirm: values.current,
      }).next,
    ).toContain("different");
  });
  it("accepts long passphrases without trimming or silently changing passwords", () => {
    expect(
      validatePasswordChange({
        current: " x ",
        next: " a long passphrase ",
        confirm: " a long passphrase ",
      }),
    ).toEqual({});
    expect(
      validatePasswordChange({
        ...values,
        next: "123456789012",
        confirm: "123456789012",
      }),
    ).toEqual({});
  });
});

describe("change only the authenticated account password", () => {
  it("verifies the current credentials before updating Auth and revokes only the temporary session", async () => {
    const { auth, verifier, createVerifier } = fixture();
    await changeOwnPassword(auth, createVerifier, values);
    expect(verifier.signInWithPassword).toHaveBeenCalledWith({
      email: "staff@example.test",
      password: values.current,
    });
    expect(auth.updateUser).toHaveBeenCalledExactlyOnceWith({
      current_password: values.current,
      password: values.next,
    });
    expect(auth.updateUser.mock.invocationCallOrder[0]).toBeGreaterThan(
      verifier.signInWithPassword.mock.invocationCallOrder[0],
    );
    expect(verifier.signOut).toHaveBeenCalledExactlyOnceWith({
      scope: "local",
    });
  });
  it("never updates a password when the old password is wrong", async () => {
    const { auth, verifier, createVerifier } = fixture();
    verifier.signInWithPassword.mockResolvedValue({
      data: { user: null },
      error: { code: "invalid_credentials" },
    });
    await expect(
      changeOwnPassword(auth, createVerifier, values),
    ).rejects.toEqual({ code: "invalid_credentials" });
    expect(auth.updateUser).not.toHaveBeenCalled();
    expect(verifier.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(verifier.dispose).toHaveBeenCalledOnce();
  });
  it("does not create a verification session when validation or the workspace session fails", async () => {
    const { auth, createVerifier } = fixture();
    await expect(
      changeOwnPassword(auth, createVerifier, { ...values, confirm: "" }),
    ).rejects.toThrow();
    expect(auth.getUser).not.toHaveBeenCalled();
    auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(
      changeOwnPassword(auth, createVerifier, values),
    ).rejects.toEqual({ code: "session_missing" });
    expect(createVerifier).not.toHaveBeenCalled();
  });
  it.each(["verification", "workspace"])(
    "refuses a different %s identity",
    async (stage) => {
      const { auth, verifier, createVerifier } = fixture();
      if (stage === "verification")
        verifier.signInWithPassword.mockResolvedValue({
          data: { user: { id: "barangay-b" } },
          error: null,
        });
      else
        auth.getSession.mockResolvedValue({
          data: { session: { user: { id: "barangay-b" } } },
          error: null,
        });
      await expect(
        changeOwnPassword(auth, createVerifier, values),
      ).rejects.toEqual({ code: "session_changed" });
      expect(auth.updateUser).not.toHaveBeenCalled();
      expect(verifier.signOut).toHaveBeenCalled();
    },
  );
  it("preserves Supabase errors and cleans up after an update failure", async () => {
    const { auth, verifier, createVerifier } = fixture();
    auth.updateUser.mockResolvedValue({
      data: { user: null },
      error: { code: "weak_password" },
    });
    await expect(
      changeOwnPassword(auth, createVerifier, values),
    ).rejects.toEqual({ code: "weak_password" });
    expect(verifier.signOut).toHaveBeenCalled();
  });
  it("does not report a successful change as a failure when cleanup is offline", async () => {
    const { auth, verifier, createVerifier } = fixture();
    verifier.signOut.mockRejectedValue(new TypeError("Offline"));
    await expect(
      changeOwnPassword(auth, createVerifier, values),
    ).resolves.toBeUndefined();
    expect(verifier.dispose).toHaveBeenCalledOnce();
  });
});

describe("password change feedback", () => {
  it.each([
    ["invalid_credentials", "current", "incorrect"],
    ["same_password", "next", "different"],
    ["weak_password", "next", "stronger"],
    ["reauthentication_needed", undefined, "Sign out"],
    ["session_changed", undefined, "Sign in again"],
    ["over_request_rate_limit", undefined, "Wait"],
  ])("maps %s to useful feedback", (code, field, message) => {
    const result = passwordChangeFailure({ code });
    expect(result.field).toBe(field);
    expect(result.message).toContain(message);
  });
  it("handles network failures without leaking raw server messages", () => {
    expect(
      passwordChangeFailure(new TypeError("fetch failed")).message,
    ).toContain("connection");
    expect(
      passwordChangeFailure({ message: values.current }).message,
    ).not.toContain(values.current);
  });
});
