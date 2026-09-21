import { describe, expect, it } from "vitest";
import { getActiveFireIncidents, buildFireStatusOverrides } from "./fire.service";

// No SUPABASE_URL/keys in the test environment, so this exercises the
// dev-fixture fallback path.

describe("fire incident fallback", () => {
  it("loads the dev fixture when Supabase isn't configured", async () => {
    const incidents = await getActiveFireIncidents();
    expect(incidents.length).toBeGreaterThan(0);
    expect(incidents[0].status).toBe("ACTIVE");
  });
});

describe("buildFireStatusOverrides", () => {
  it("does not block any road when no fire has an explicit confirmation", async () => {
    // The dev fixture's fire incident has an empty confirmedBlockedRoadIds
    // on purpose — proximity alone should never produce a BLOCKED override.
    const overrides = await buildFireStatusOverrides();
    expect(overrides.size).toBe(0);
  });
});
