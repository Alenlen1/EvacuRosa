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
    ]) {
      expect(translate(text, "fil")).not.toBe(text);
    }
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
