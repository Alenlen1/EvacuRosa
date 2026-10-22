import { describe, expect, it } from "vitest";
import { signInFailure, validateLogin } from "./loginFeedback";

describe("login input feedback", () => {
  it("identifies both missing fields before authentication", () => {
    expect(validateLogin("  ", "")).toEqual({
      email: "Enter your email address.",
      password: "Enter your password.",
    });
  });
  it.each(["name", "name@", "@example.com", "name @example.com"])(
    "flags malformed email %s without blaming a populated password",
    (email) => {
      expect(validateLogin(email, "existing-password")).toEqual({
        email: expect.stringContaining("valid email"),
      });
    },
  );
  it("accepts surrounding email whitespace and does not impose signup password rules", () => {
    expect(validateLogin(" staff@example.com ", "a")).toEqual({});
    expect(validateLogin("staff@example.com", " ")).toEqual({});
  });
  it("identifies a missing password independently", () => {
    expect(validateLogin("staff@example.com", "")).toEqual({
      password: "Enter your password.",
    });
  });
});

describe("sign-in failure feedback", () => {
  it("marks the credential pair without claiming which value is wrong", () => {
    const failure = signInFailure({ code: "invalid_credentials", status: 400 });
    expect(failure.invalidFields).toEqual(["email", "password"]);
    expect(failure.message).toContain("Email or password");
    expect(failure.focus).toBe("password");
  });
  it.each(["email_not_confirmed", "email_address_invalid"])(
    "directs %s feedback to email only",
    (code) => {
      expect(signInFailure({ code }).invalidFields).toEqual(["email"]);
      expect(signInFailure({ code }).focus).toBe("email");
    },
  );
  it.each([{ status: 429 }, { code: "over_request_rate_limit" }])(
    "asks rate-limited users to wait without marking credentials",
    (error) => {
      const failure = signInFailure(error);
      expect(failure.message).toContain("Wait a few minutes");
      expect(failure.invalidFields).toEqual([]);
      expect(failure.focus).toBe("form");
    },
  );
  it.each([
    { name: "AuthRetryableFetchError", status: 0 },
    new TypeError("Failed to fetch"),
  ])("gives connection guidance without marking fields", (error) => {
    const failure = signInFailure(error);
    expect(failure.message).toContain("internet connection");
    expect(failure.invalidFields).toEqual([]);
  });
  it("separates an unavailable service from an incorrect password", () => {
    const failure = signInFailure({ status: 503 });
    expect(failure.message).toContain("temporarily unavailable");
    expect(failure.invalidFields).toEqual([]);
  });
  it("offers account-access and timeout guidance", () => {
    expect(signInFailure({ code: "user_banned" }).message).toContain(
      "administrator",
    );
    expect(signInFailure({ code: "request_timeout" }).message).toContain(
      "took too long",
    );
  });
  it.each([
    null,
    new Error("Internal service address and private details"),
    { code: "unrecognized", message: "Internal service address" },
  ])("does not expose unknown service messages", (error) => {
    const failure = signInFailure(error);
    expect(failure.invalidFields).toEqual([]);
    expect(failure.message).toContain("try again");
    expect(failure.message).not.toContain("Internal service");
  });
});
