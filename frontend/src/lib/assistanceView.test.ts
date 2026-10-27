import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import {
  ASSISTANCE_VIEW_KEY,
  clearAssistanceView,
  readAssistanceView,
  writeAssistanceView,
} from "./assistanceView";

beforeEach(() => {
  const values = new Map<string, string>();
  vi.stubGlobal("sessionStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  });
});
afterEach(() => vi.unstubAllGlobals());

describe("restoring assistance views", () => {
  it("restores the location view and open dialog after refresh", () => {
    writeAssistanceView("request-a", true, "location");
    expect(readAssistanceView("request-a")).toEqual({
      open: true,
      view: "location",
    });
  });
  it("keeps the dialog closed when the user closed it before refreshing", () => {
    writeAssistanceView("request-a", false, "overview");
    expect(readAssistanceView("request-a")?.open).toBe(false);
  });
  it("does not restore a different request's view", () => {
    writeAssistanceView("request-a", true, "history");
    expect(readAssistanceView("request-b")).toBeNull();
  });
  it.each([
    "{",
    JSON.stringify({ requestId: "request-a", open: true, view: "invalid" }),
    JSON.stringify({ requestId: "request-a", open: "true", view: "location" }),
  ])("ignores invalid saved state", (raw) => {
    sessionStorage.setItem(ASSISTANCE_VIEW_KEY, raw);
    expect(readAssistanceView("request-a")).toBeNull();
  });
  it("clears the old view for a new request", () => {
    writeAssistanceView("request-a", true, "history");
    clearAssistanceView();
    expect(readAssistanceView("request-a")).toBeNull();
  });
  it("does not prevent tracking when session storage is blocked", () => {
    vi.stubGlobal("sessionStorage", {
      getItem: () => {
        throw Error("blocked");
      },
      setItem: () => {
        throw Error("blocked");
      },
      removeItem: () => {
        throw Error("blocked");
      },
    });
    expect(() =>
      writeAssistanceView("request-a", true, "location"),
    ).not.toThrow();
    expect(() => clearAssistanceView()).not.toThrow();
    expect(readAssistanceView("request-a")).toBeNull();
  });
});
