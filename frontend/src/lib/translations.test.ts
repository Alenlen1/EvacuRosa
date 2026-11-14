import { describe, expect, it } from "vitest";
import { translate } from "./translations";
describe("public language selection", () => {
  it("translates the new planning and sheet controls", () => {
    for (const text of [
      "Where do you need to go?",
      "Use as destination",
      "Full details",
      "Show less",
      "How this time is estimated",
      "This center is not accepting arrivals. Choose another center.",
      "Centers",
      "Hazards",
      "Back to map",
      "Back to centers",
      "Clear destination",
      "Browse centers",
      "Search evacuation centers",
      "Accepting IDPs",
      "Accepting internally displaced persons (IDPs)",
      "Reset filters",
      "No centers match your search or filters.",
      "Contact details",
      "Route information",
      "Capacity unavailable",
      "Offline ready",
      "Preparing offline data",
      "Offline not ready",
      "Checking location",
      "Start with approximate location?",
      "Start anyway",
      "Waiting for better location accuracy.",
      "Route progress, automatic rerouting and arrival detection paused.",
      "Offline information",
      "Close status details",
      "Your location is available for route planning.",
      "Loading map…",
      "Loading evacuation centers…",
      "Loading hazard information…",
    ]) {
      expect(translate(text, "fil")).not.toBe(text);
    }
  });
  it("translates directory counts and remaining spaces with their values", () => {
    expect(
      translate("Approximate location · ±{accuracy} m", "fil", {
        accuracy: 292,
      }),
    ).toBe("Tinatayang lokasyon · ±292 m");
    expect(
      translate("Showing {count} of {total} centers", "fil", {
        count: 2,
        total: 18,
      }),
    ).toBe("Ipinapakita ang 2 sa 18 center");
    expect(translate("{count} spaces remaining", "fil", { count: 100 })).toBe(
      "100 bakanteng puwesto",
    );
  });
  it("translates controls while leaving recorded names unchanged", () => {
    expect(translate("Find safer route", "fil")).toBe(
      "Maghanap ng mas ligtas na ruta",
    );
    expect(translate("Santa Rosa Multipurpose Complex", "fil")).toBe(
      "Santa Rosa Multipurpose Complex",
    );
    expect(translate("Find safer route", "en")).toBe("Find safer route");
  });
  it("includes explicit consent and the non-dispatch notice in Filipino", () => {
    const consent =
      "By selecting “Share my location”, you agree to send your current coordinates, location accuracy and time, destination, travel mode, and any details below to authorized CDRRMO staff. No live tracking. Submission does not guarantee assistance or dispatch.";
    expect(translate(consent, "fil")).toContain("pumapayag");
    expect(translate(consent, "fil")).toContain("Hindi garantiya");
  });
});
