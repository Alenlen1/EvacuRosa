import { describe, expect, it } from "vitest";
import { estimatedTravelTime, type TravelMode } from "./travelTime";

describe("estimatedTravelTime", () => {
  it("estimates walking time from meters and rounds up", () => {
    expect(estimatedTravelTime(1900, "walking")).toBe("29 min");
    expect(estimatedTravelTime(1000, "walking")).toBe("15 min");
  });

  it("formats zero, short routes, and routes of an hour or more", () => {
    expect(estimatedTravelTime(0, "walking")).toBe("Less than 1 min");
    expect(estimatedTravelTime(10, "walking")).toBe("1 min");
    expect(estimatedTravelTime(4000, "walking")).toBe("1 hr");
    expect(estimatedTravelTime(5000, "walking")).toBe("1 hr 15 min");
  });

  it("does not invent an estimate for invalid distances", () => {
    for (const distance of [-1, NaN, Infinity]) {
      for (const mode of ["walking", "biking", "motorcycle", "car"] as TravelMode[]) {
        expect(estimatedTravelTime(distance, mode)).toBeNull();
      }
    }
  });
  it("uses the selected transport assumption for the same distance", () => {
    expect(estimatedTravelTime(5000, "biking")).toBe("25 min");
    expect(estimatedTravelTime(5000, "motorcycle")).toBe("12 min");
    expect(estimatedTravelTime(5000, "car")).toBe("15 min");
  });
});
