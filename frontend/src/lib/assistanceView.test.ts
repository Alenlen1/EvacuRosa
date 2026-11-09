import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import {
  ASSISTANCE_VIEW_KEY,
  clearAssistanceView,
  readAssistanceView,
  restoreAssistanceView,
  writeAssistanceView,
} from "./assistanceView";
import type { AssistanceCredentials } from "./assistance";

beforeEach(() => {
  const values = new Map<string, string>();
  vi.stubGlobal("sessionStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  });
});

describe("assistance dialog startup", () => {
  const draft: AssistanceCredentials = {
    id: "request-a",
    submissionKey: "a".repeat(64),
  };
  const submitted: AssistanceCredentials = {
    ...draft,
    trackingToken: "T".repeat(43),
  };

  it("keeps an unfinished submission closed on a new app launch", () => {
    expect(restoreAssistanceView(draft)).toEqual({
      open: false,
      view: "overview",
    });
    expect(draft.submissionKey).toBe("a".repeat(64));
  });

  it("does not reopen an unfinished form that was open before refresh", () => {
    writeAssistanceView(draft.id, true, "overview");
    expect(restoreAssistanceView(draft).open).toBe(false);
  });

  it("restores the open history view of a submitted request", () => {
    writeAssistanceView(submitted.id, true, "history");
    expect(restoreAssistanceView(submitted)).toEqual({
      open: true,
      view: "history",
    });
  });

  it("keeps a submitted request closed when its dialog was closed", () => {
    writeAssistanceView(submitted.id, false, "location");
    expect(restoreAssistanceView(submitted).open).toBe(false);
  });

  it("does not force a submitted request open in a new session", () => {
    expect(restoreAssistanceView(submitted).open).toBe(false);
  });

  it("does not reopen a new form from a saved cancelled request", () => {
    writeAssistanceView(submitted.id, true, "overview");
    expect(
      restoreAssistanceView({
        ...submitted,
        cached: {
          request: {
            id: submitted.id,
            status: "CANCELLED",
            version: 2,
            latitude: 14.33,
            longitude: 121.11,
            accuracy_meters: 30,
            location_recorded_at: "2026-11-09T01:00:00Z",
            created_at: "2026-11-09T01:00:00Z",
            status_updated_at: "2026-11-09T01:01:00Z",
          },
          history: [],
        },
      }),
    ).toEqual({ open: false, view: "overview" });
  });

  it("stays closed when presentation storage is unavailable", () => {
    vi.stubGlobal("sessionStorage", {
      getItem: () => {
        throw Error("blocked");
      },
    });
    expect(restoreAssistanceView(submitted).open).toBe(false);
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
