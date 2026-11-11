import { describe, expect, it, vi } from "vitest";
import {
  changeOwnEmail,
  emailChangeFailure,
  getOwnEmailChange,
  resendOwnEmailChange,
  validateEmailChange,
} from "./changeEmail";

const values = {
  email: " New.Staff@example.test ",
  password: "CurrentPrivate1!",
};
const redirect = "https://staff.example.test/admin/login";
function fixture() {
  const user = { id: "assigned-a", email: "old@example.test" };
  const auth = {
    getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
    getSession: vi
      .fn()
      .mockResolvedValue({ data: { session: { user } }, error: null }),
    updateUser: vi.fn().mockResolvedValue({
      data: { user: { ...user, new_email: "new.staff@example.test" } },
      error: null,
    }),
  };
  const verifier = {
    signInWithPassword: vi
      .fn()
      .mockResolvedValue({ data: { user }, error: null }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
    dispose: vi.fn().mockResolvedValue(undefined),
  };
  const createVerifier = vi.fn(() => verifier);
  return { user, auth, verifier, createVerifier };
}
describe("staff email changes", () => {
  it("validates email syntax, unchanged addresses and current password", () => {
    expect(
      validateEmailChange(
        { email: "old@example-test", password: "" },
        "old@example.test",
      ),
    ).toEqual({ email: expect.any(String), password: expect.any(String) });
    expect(
      validateEmailChange(
        { ...values, email: " OLD@EXAMPLE.TEST " },
        "old@example.test",
      ).email,
    ).toContain("different");
  });
  it("verifies the current password and updates only the email, preserving identity", async () => {
    const { auth, verifier, createVerifier } = fixture();
    expect(
      await changeOwnEmail(auth, createVerifier, values, redirect),
    ).toEqual({ confirmed: false });
    expect(verifier.signInWithPassword).toHaveBeenCalledExactlyOnceWith({
      email: "old@example.test",
      password: values.password,
    });
    expect(auth.updateUser).toHaveBeenCalledExactlyOnceWith(
      { email: "new.staff@example.test" },
      { emailRedirectTo: redirect },
    );
    expect(verifier.signOut).toHaveBeenCalledExactlyOnceWith({
      scope: "local",
    });
    expect(verifier.dispose).toHaveBeenCalledOnce();
  });
  it("reports immediate confirmation only if Auth actually returns the new email", async () => {
    const f = fixture();
    f.auth.updateUser.mockResolvedValue({
      data: {
        user: { ...f.user, email: "new.staff@example.test", new_email: "" },
      },
      error: null,
    });
    expect(
      await changeOwnEmail(f.auth, f.createVerifier, values, redirect),
    ).toEqual({ confirmed: true });
  });
  it("uses Auth's send time for the wait so a delayed response or reopened dialog does not restart it", async () => {
    const f = fixture();
    const sentAt = "2026-11-11T12:00:00Z";
    f.auth.updateUser.mockResolvedValue({
      data: {
        user: {
          ...f.user,
          new_email: "new.staff@example.test",
          email_change_sent_at: sentAt,
        },
      },
      error: null,
    } as never);
    expect(
      await changeOwnEmail(f.auth, f.createVerifier, values, redirect),
    ).toEqual({ confirmed: false, confirmationSentAt: Date.parse(sentAt) });
  });
  it("rejects a wrong password without updating email and cleans up the verifier", async () => {
    const f = fixture();
    f.verifier.signInWithPassword.mockResolvedValue({
      data: { user: null },
      error: { code: "invalid_credentials" },
    } as never);
    await expect(
      changeOwnEmail(f.auth, f.createVerifier, values, redirect),
    ).rejects.toMatchObject({ code: "invalid_credentials" });
    expect(f.auth.updateUser).not.toHaveBeenCalled();
    expect(f.verifier.dispose).toHaveBeenCalledOnce();
  });
  it.each(["verification", "workspace"])(
    "rejects account switching during %s",
    async (source) => {
      const f = fixture();
      if (source === "verification")
        f.verifier.signInWithPassword.mockResolvedValue({
          data: { user: { ...f.user, id: "other" } },
          error: null,
        });
      else
        f.auth.getSession.mockResolvedValue({
          data: { session: { user: { ...f.user, id: "other" } } },
          error: null,
        });
      await expect(
        changeOwnEmail(f.auth, f.createVerifier, values, redirect),
      ).rejects.toMatchObject({ code: "session_changed" });
      expect(f.auth.updateUser).not.toHaveBeenCalled();
      expect(f.verifier.signOut).toHaveBeenCalledExactlyOnceWith({
        scope: "local",
      });
    },
  );
  it("rejects unchanged email before creating another login", async () => {
    const f = fixture();
    await expect(
      changeOwnEmail(
        f.auth,
        f.createVerifier,
        { ...values, email: f.user.email },
        redirect,
      ),
    ).rejects.toMatchObject({ code: "invalid_email_change" });
    expect(f.createVerifier).not.toHaveBeenCalled();
  });
  it("maps service errors without showing raw Auth messages", () => {
    expect(emailChangeFailure({ code: "invalid_credentials" }).field).toBe(
      "password",
    );
    expect(emailChangeFailure({ status: 429 }).message).toContain("Too many");
    expect(
      emailChangeFailure({ message: "internal database details" }).message,
    ).not.toContain("internal database");
  });
});

describe("resending email change confirmation", () => {
  function resendFixture() {
    const f = fixture();
    return {
      ...f,
      auth: {
        ...f.auth,
        getUser: vi.fn().mockResolvedValue({
          data: { user: { ...f.user, new_email: "new.staff@example.test" } },
          error: null,
        }),
        refreshSession: vi.fn().mockResolvedValue({
          data: { user: { ...f.user, email: "new.staff@example.test" } },
          error: null,
        }),
        resend: vi
          .fn()
          .mockResolvedValue({
            data: { user: null, session: null },
            error: null,
          }),
      },
      expected: { userId: f.user.id, email: "new.staff@example.test" },
    };
  }
  it("looks up the existing account by its current email and requests email_change delivery", async () => {
    const f = resendFixture();
    const result = await resendOwnEmailChange(f.auth, f.expected, redirect);
    expect(result.confirmed).toBe(false);
    expect(result.account.pendingEmail).toBe(f.expected.email);
    expect(f.auth.resend).toHaveBeenCalledExactlyOnceWith({
      type: "email_change",
      email: f.user.email,
      options: { emailRedirectTo: redirect },
    });
    expect(f.auth.updateUser).not.toHaveBeenCalled();
    expect(f.createVerifier).not.toHaveBeenCalled();
  });
  it("does not send mail when only reading pending status", async () => {
    const f = resendFixture();
    await getOwnEmailChange(f.auth, f.user.id);
    expect(f.auth.resend).not.toHaveBeenCalled();
  });
  it.each(["account", "pending address", "no pending address"])(
    "does not resend when the %s has changed",
    async (source) => {
      const f = resendFixture();
      f.auth.getUser.mockResolvedValue({
        data: {
          user: {
            ...f.user,
            id: source === "account" ? "other" : f.user.id,
            new_email:
              source === "no pending address" ? "" : "different@example.test",
          },
        },
        error: null,
      });
      await expect(
        resendOwnEmailChange(f.auth, f.expected, redirect),
      ).rejects.toMatchObject({
        code:
          source === "account" ? "session_changed" : "email_change_not_pending",
      });
      expect(f.auth.resend).not.toHaveBeenCalled();
    },
  );
  it("recognizes a completed change without sending another confirmation", async () => {
    const f = resendFixture();
    f.auth.getUser.mockResolvedValue({
      data: { user: { ...f.user, email: f.expected.email, new_email: "" } },
      error: null,
    });
    expect(
      (await resendOwnEmailChange(f.auth, f.expected, redirect)).confirmed,
    ).toBe(true);
    expect(f.auth.resend).not.toHaveBeenCalled();
    expect(f.auth.refreshSession).toHaveBeenCalledOnce();
  });
  it.each([
    { status: 429, code: "over_email_send_rate_limit" },
    { status: 500, code: "unexpected_failure" },
  ])(
    "propagates an Auth send failure ($status) instead of claiming mail was requested",
    async (error) => {
      const f = resendFixture();
      f.auth.resend.mockResolvedValue({
        data: { user: null, session: null },
        error,
      } as never);
      await expect(
        resendOwnEmailChange(f.auth, f.expected, redirect),
      ).rejects.toEqual(error);
    },
  );
  it("restores the server send time so reopening the dialog retains the cooldown", async () => {
    const f = resendFixture();
    const sentAt = "2026-11-11T12:00:00Z";
    f.auth.getUser.mockResolvedValue({
      data: {
        user: {
          ...f.user,
          new_email: f.expected.email,
          email_change_sent_at: sentAt,
        },
      },
      error: null,
    });
    expect((await getOwnEmailChange(f.auth)).confirmationSentAt).toBe(
      Date.parse(sentAt),
    );
    expect(f.auth.resend).not.toHaveBeenCalled();
  });
});

describe("checking email change confirmation", () => {
  function pendingFixture() {
    const f = fixture();
    f.auth.getUser.mockResolvedValue({
      data: { user: { ...f.user, new_email: "new.staff@example.test" } },
      error: null,
    } as never);
    return {
      ...f,
      auth: {
        ...f.auth,
        refreshSession: vi.fn().mockResolvedValue({
          data: { user: { ...f.user, email: "new.staff@example.test" } },
          error: null,
        }),
      },
    };
  }
  it("restores a pending change from Auth without reporting the new address as current", async () => {
    const f = pendingFixture();
    expect(await getOwnEmailChange(f.auth)).toEqual({
      userId: f.user.id,
      currentEmail: f.user.email,
      pendingEmail: "new.staff@example.test",
    });
    expect(f.auth.refreshSession).not.toHaveBeenCalled();
    expect(f.auth.updateUser).not.toHaveBeenCalled();
    expect(f.createVerifier).not.toHaveBeenCalled();
  });
  it("recognizes confirmation in another browser and refreshes the same account's stale session", async () => {
    const f = pendingFixture();
    f.auth.getUser.mockResolvedValue({
      data: {
        user: { ...f.user, email: "new.staff@example.test", new_email: "" },
      },
      error: null,
    } as never);
    expect(await getOwnEmailChange(f.auth, f.user.id)).toEqual({
      userId: f.user.id,
      currentEmail: "new.staff@example.test",
      pendingEmail: null,
    });
    expect(f.auth.refreshSession).toHaveBeenCalledOnce();
    expect(f.auth.updateUser).not.toHaveBeenCalled();
  });
  it("does not rotate a session that already has the current email", async () => {
    const f = pendingFixture();
    const current = {
      ...f.user,
      email: "new.staff@example.test",
      new_email: "",
    };
    f.auth.getUser.mockResolvedValue({
      data: { user: current },
      error: null,
    } as never);
    f.auth.getSession.mockResolvedValue({
      data: { session: { user: current } },
      error: null,
    });
    expect((await getOwnEmailChange(f.auth)).pendingEmail).toBeNull();
    expect(f.auth.refreshSession).not.toHaveBeenCalled();
  });
  it.each(["previous account", "stored session", "refresh"])(
    "rejects account switching in the %s instead of claiming completion",
    async (source) => {
      const f = pendingFixture();
      f.auth.getUser.mockResolvedValue({
        data: { user: { ...f.user, email: "new.staff@example.test" } },
        error: null,
      });
      if (source === "stored session")
        f.auth.getSession.mockResolvedValue({
          data: { session: { user: { ...f.user, id: "other" } } },
          error: null,
        });
      if (source === "refresh")
        f.auth.refreshSession.mockResolvedValue({
          data: { user: { ...f.user, id: "other" } },
          error: null,
        });
      await expect(
        getOwnEmailChange(
          f.auth,
          source === "previous account" ? "other" : f.user.id,
        ),
      ).rejects.toMatchObject({ code: "session_changed" });
    },
  );
  it("keeps server and refresh failures from being treated as confirmation", async () => {
    const f = pendingFixture();
    f.auth.getUser.mockResolvedValueOnce({
      data: { user: null },
      error: { status: 503 },
    } as never);
    await expect(getOwnEmailChange(f.auth)).rejects.toMatchObject({
      status: 503,
    });
    f.auth.getUser.mockResolvedValue({
      data: { user: { ...f.user, email: "new.staff@example.test" } },
      error: null,
    });
    f.auth.refreshSession.mockResolvedValue({
      data: { user: null },
      error: { code: "session_missing" },
    } as never);
    await expect(getOwnEmailChange(f.auth)).rejects.toMatchObject({
      code: "session_missing",
    });
  });
});
