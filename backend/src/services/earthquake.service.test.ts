import { describe, expect, it } from "vitest";
import {
  getRecentEarthquakes,
  getVerifiedRoadImpacts,
  buildEarthquakeStatusOverrides,
  buildEarthquakeImpactByRoadId,
} from "./earthquake.service";

// No SUPABASE_URL/keys in the test environment, so this exercises the
// dev-fixture fallback path — which deliberately includes one UNREVIEWED
// event (must have zero routing effect) and one REVIEWED event with a
// verified, non-blocking road impact.

describe("earthquake fallback", () => {
  it("loads the dev fixture events when Supabase isn't configured", async () => {
    const events = await getRecentEarthquakes();
    expect(events.length).toBeGreaterThan(0);
  });

  it("loads verified road impacts separately from raw events", async () => {
    const impacts = await getVerifiedRoadImpacts();
    expect(impacts.length).toBeGreaterThan(0);
    expect(impacts[0].roadId).toBe("R-DJ-1");
  });
});

describe("buildEarthquakeStatusOverrides", () => {
  it("does not block a road with only a non-blocking verified impact", async () => {
    const overrides = await buildEarthquakeStatusOverrides();
    expect(overrides.has("R-DJ-1")).toBe(false);
  });
});

describe("buildEarthquakeImpactByRoadId", () => {
  it("only has entries for roads with an actual verified impact record", async () => {
    const impactMap = await buildEarthquakeImpactByRoadId();
    expect(impactMap.get("R-DJ-1")).toBeGreaterThan(0);
    // The UNREVIEWED event's location has no verified impact at all —
    // no road tied to it should appear here regardless of magnitude.
    expect(impactMap.size).toBe(1);
  });
});
