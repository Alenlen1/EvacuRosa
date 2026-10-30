import { describe, expect, it } from "vitest";
import {
  assistanceDisplayName,
  assistanceTime,
} from "./assistancePresentation";

describe("shared location presentation", () => {
  it("distinguishes unnamed requests by reference and retains supplied names", () => {
    expect(
      assistanceDisplayName({ id: "e6960c3c-example", display_name: " " }),
    ).toBe("Request #E6960C3C");
    expect(assistanceDisplayName({ id: "second-request" })).not.toBe(
      "Request #E6960C3C",
    );
    expect(
      assistanceDisplayName({
        id: "request",
        display_name: "  Maria Santos  ",
      }),
    ).toBe("Maria Santos");
  });
  it("shows Philippine time across midnight and handles missing timestamps", () => {
    expect(assistanceTime("2026-10-30T16:33:00Z")).toBe("Oct 31, 12:33 AM PHT");
    expect(assistanceTime("invalid")).toBe("Time unavailable");
    expect(assistanceTime(null)).toBe("Time unavailable");
  });
});
