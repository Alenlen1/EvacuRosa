import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ASSISTANCE_CONTACT_KEY,
  readAssistanceContact,
  validateAssistanceContact,
  writeAssistanceContact,
} from "./assistanceContact";
import { ASSISTANCE_STORAGE_KEY } from "./assistance";

beforeEach(() => {
  const values = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  });
});
afterEach(() => vi.unstubAllGlobals());

describe("saved assistance contact details", () => {
  it("asks on a first visit, but remembers a skipped prompt", () => {
    expect(readAssistanceContact()).toBeNull();
    writeAssistanceContact({ name: "", contact: "" });
    expect(readAssistanceContact()).toEqual({ name: "", contact: "" });
  });
  it("restores trimmed saved details and replaces them on edit", () => {
    writeAssistanceContact({
      name: "  Test Resident  ",
      contact: "  09123456789 ",
    });
    expect(readAssistanceContact()).toEqual({
      name: "Test Resident",
      contact: "09123456789",
    });
    writeAssistanceContact({
      name: "Another Resident",
      contact: "09123456789",
    });
    expect(readAssistanceContact()).toEqual({
      name: "Another Resident",
      contact: "09123456789",
    });
  });
  it("keeps contact details when a cancelled request is cleared", () => {
    writeAssistanceContact({ name: "Test Resident", contact: "09123456789" });
    localStorage.setItem(ASSISTANCE_STORAGE_KEY, "request credentials");
    localStorage.removeItem(ASSISTANCE_STORAGE_KEY);
    expect(readAssistanceContact()?.name).toBe("Test Resident");
  });
  it.each([
    "0912345678",
    "091234567890",
    "+639123456789",
    "0912 3456789",
    "0912345678a",
    "0912345678-",
    "21312313213",
    "08123456789",
  ])(
    "requires 11 digits starting with 09 when a mobile number is provided: %s",
    (contact) => {
      expect(validateAssistanceContact({ name: "Test", contact }).contact).toBe(
        "Enter an 11-digit mobile number starting with 09.",
      );
      expect(() => writeAssistanceContact({ name: "Test", contact })).toThrow();
    },
  );
  it("allows removing saved personal information without repeating onboarding", () => {
    writeAssistanceContact({ name: "Test Resident", contact: "09123456789" });
    writeAssistanceContact({ name: "", contact: "" });
    expect(readAssistanceContact()).toEqual({ name: "", contact: "" });
    expect(localStorage.getItem(ASSISTANCE_CONTACT_KEY)).not.toContain(
      "Test Resident",
    );
  });
  it.each([
    "{",
    "null",
    '{"version":1,"name":5,"contact":""}',
    '{"version":2,"name":"","contact":""}',
    '{"version":1,"name":"Test","contact":"invalid"}',
  ])("handles invalid browser data without blocking startup: %s", (raw) => {
    localStorage.setItem(ASSISTANCE_CONTACT_KEY, raw);
    expect(readAssistanceContact()).toBeNull();
  });
  it("rejects invalid edits without overwriting previously saved details", () => {
    writeAssistanceContact({ name: "Test Resident", contact: "09123456789" });
    expect(() =>
      writeAssistanceContact({ name: "a".repeat(101), contact: "" }),
    ).toThrow();
    expect(() =>
      writeAssistanceContact({ name: "Test Resident", contact: "+++" }),
    ).toThrow();
    expect(readAssistanceContact()?.contact).toBe("09123456789");
    expect(validateAssistanceContact({ name: "", contact: "" })).toEqual({
      name: undefined,
      contact: undefined,
    });
  });
  it("handles blocked storage while leaving the prompt dismissible", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw Error("blocked");
      },
      setItem: () => {
        throw Error("blocked");
      },
    });
    expect(readAssistanceContact()).toBeNull();
    expect(() => writeAssistanceContact({ name: "Test", contact: "" })).toThrow(
      "blocked",
    );
  });
});
