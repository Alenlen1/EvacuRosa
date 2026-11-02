import { describe, expect, it } from "vitest";
import {
  assistanceConnection,
  formatAssistanceTime,
} from "./assistancePresentation";

describe("assistance freshness presentation", () => {
  const connected = {
    online: true,
    confirmed: true,
    terminal: false,
    connection: "Connected",
    unavailable: false,
  };
  it("uses green only after a response has verified a connected session", () => {
    expect(assistanceConnection(connected)).toEqual({
      state: "connected",
      label: "Connected",
    });
    expect(assistanceConnection({ ...connected, confirmed: false })).toEqual({
      state: "waiting",
      label: "Checking status",
    });
  });
  it("keeps reconnection amber even when the last polling response succeeded", () => {
    expect(
      assistanceConnection({ ...connected, connection: "Reconnecting" }),
    ).toEqual({ state: "waiting", label: "Reconnecting" });
  });
  it("prioritizes offline and unavailable states over old connection labels", () => {
    expect(assistanceConnection({ ...connected, online: false }).state).toBe(
      "offline",
    );
    expect(
      assistanceConnection({ ...connected, unavailable: true }).label,
    ).toBe("Status unavailable");
    expect(
      assistanceConnection({
        ...connected,
        connection: "Status May Be Outdated",
      }).state,
    ).toBe("waiting");
  });
  it("reports confirmed final status without implying an active stream", () => {
    expect(
      assistanceConnection({
        ...connected,
        terminal: true,
        connection: "Reconnecting",
      }).label,
    ).toBe("Status confirmed");
  });
  it("uses Philippine time independently of the browser timezone, including date rollover", () => {
    const formatted = formatAssistanceTime("2026-11-01T17:23:45Z");
    expect(formatted).toContain("Nov 2, 2026");
    expect(formatted).toContain("1:23:45");
    expect(formatted).toMatch(/am PHT$/i);
    expect(formatAssistanceTime("2026-11-01T17:23:45Z", false)).not.toContain(
      "2026",
    );
  });
  it("does not invent a time for a missing or invalid timestamp", () => {
    expect(formatAssistanceTime("invalid")).toBe("Time unavailable");
  });
});
