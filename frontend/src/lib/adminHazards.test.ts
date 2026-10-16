import { describe, expect, it } from "vitest";
import {
  hazardCoordinates,
  roadCoordinates,
  removeHazardBatch,
} from "./adminHazards";

describe("admin hazard coordinates", () => {
  it("shows a representative point on the affected road", () => {
    expect(
      roadCoordinates([
        [],
        [
          { latitude: 14.3, longitude: 121.1 },
          { latitude: 14.302, longitude: 121.104 },
        ],
      ]),
    ).toBe("Lat: 14.301000, Lng: 121.102000");
  });
  it("does not substitute invented coordinates for missing road geometry", () => {
    expect(roadCoordinates([])).toBe("Coordinates unavailable");
    expect(hazardCoordinates({ latitude: NaN, longitude: 121 })).toBe(
      "Coordinates unavailable",
    );
  });
});

describe("bulk hazard removal", () => {
  it("continues after failures and bounds concurrency", async () => {
    let active = 0;
    let peak = 0;
    const called: number[] = [];
    const result = await removeHazardBatch(
      Array.from({ length: 12 }, (_, index) => async () => {
        active++;
        peak = Math.max(peak, active);
        called.push(index);
        await Promise.resolve();
        active--;
        if (index === 1 || index === 8) throw new Error("Denied");
      }),
    );
    expect(result).toEqual({ removed: 10, failed: 2 });
    expect(peak).toBeLessThanOrEqual(5);
    expect(called).toHaveLength(12);
  });
  it("handles an empty list and synchronous failures", async () => {
    expect(await removeHazardBatch([])).toEqual({ removed: 0, failed: 0 });
    expect(
      await removeHazardBatch([
        () => {
          throw new Error("Failed");
        },
      ]),
    ).toEqual({ removed: 0, failed: 1 });
  });
});
