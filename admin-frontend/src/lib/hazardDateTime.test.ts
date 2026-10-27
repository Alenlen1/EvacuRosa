import { describe, expect, it } from "vitest";
import { formatHazardDateTime } from "./hazardDateTime";

describe("hazard date and time", () => {
  it("shows saved UTC timestamps in Philippine time", () => {
    expect(formatHazardDateTime("2026-10-27T14:17:42Z")).toBe(
      "Oct 27, 2026, 10:17:42 PM PHT",
    );
  });
  it("moves to the next calendar date when the Philippine offset crosses midnight", () => {
    expect(formatHazardDateTime("2026-10-27T17:05:00Z")).toBe(
      "Oct 28, 2026, 1:05:00 AM PHT",
    );
  });
  it.each([undefined, null, "", "invalid"])(
    "does not invent a time for %s",
    (value) => {
      expect(formatHazardDateTime(value)).toBeNull();
    },
  );
});
