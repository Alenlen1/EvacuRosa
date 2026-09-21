import { describe, expect, it } from "vitest";
import { buildRoadStatusOverrides } from "./flood.service";

// No SUPABASE_URL/keys in the test environment, so this exercises the
// dev-fixture fallback path — which includes one impassable (SEVERE) and
// one passable (MODERATE) active flood report by design.

describe("buildRoadStatusOverrides", () => {
  it("marks a confirmed-impassable flood report's road as BLOCKED", async () => {
    const overrides = await buildRoadStatusOverrides();
    expect(overrides.get("R-SIN-1")).toBe("BLOCKED");
  });

  it("marks a passable-but-flooded road as FLOODED, not BLOCKED", async () => {
    const overrides = await buildRoadStatusOverrides();
    expect(overrides.get("R-CAI-1")).toBe("FLOODED");
  });

  it("never overrides an unrelated road", async () => {
    const overrides = await buildRoadStatusOverrides();
    expect(overrides.has("R-NH-1")).toBe(false);
  });
});
