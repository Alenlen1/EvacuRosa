import { beforeEach, describe, expect, it, vi } from "vitest";
import { RoadGraph } from "../algorithms/astar/graph";
const mocks = vi.hoisted(() => ({ graph: vi.fn(), flood: vi.fn(), fire: vi.fn(), quake: vi.fn() }));
vi.mock("./road.service", () => ({ loadRoadGraph: mocks.graph }));
vi.mock("./flood.service", () => ({ buildRoadStatusOverrides: mocks.flood, getActiveFloodReports: async () => [] }));
vi.mock("./fire.service", () => ({ buildFireStatusOverrides: mocks.fire, getActiveFireIncidents: async () => [] }));
vi.mock("./earthquake.service", () => ({ buildEarthquakeStatusOverrides: mocks.quake, buildEarthquakeImpactByRoadId: async () => new Map() }));
import { computeRoute } from "./routing.service";
const start = { latitude: 14.3, longitude: 121.1 };
const end = { latitude: 14.31, longitude: 121.1 };
function graph(walkingOnly = false, alternative = false, oneway = false) {
  return new RoadGraph({ nodes: [{ id: "A", ...start }, { id: "B", ...end }], edges: [
    { id: "AB", roadId: "road", fromNodeId: "A", toNodeId: "B", distanceMeters: 1200, status: "OPEN", oneway,
      allowedModes: walkingOnly ? ["walking"] : ["walking", "biking", "motorcycle", "car"] },
    ...(alternative ? [{ id: "AB2", roadId: "other", fromNodeId: "A", toNodeId: "B", distanceMeters: 1500, status: "OPEN" as const }] : []),
  ] });
}
describe("hazard-specific routing failure", () => {
  beforeEach(() => {
    mocks.graph.mockReturnValue(graph());
    mocks.flood.mockResolvedValue(new Map()); mocks.fire.mockResolvedValue(new Map()); mocks.quake.mockResolvedValue(new Map());
  });
  it.each(["flood", "fire", "quake"] as const)("identifies blocked %s routes without returning the unsafe diagnostic path", async hazard => {
    mocks[hazard].mockResolvedValue(new Map([["road", "BLOCKED"]]));
    const result = await computeRoute(start, end);
    expect(result.found).toBe(false); expect(result.failureReason).toBe("HAZARD_BLOCKED"); expect(result.path).toEqual([]);
  });
  it("does not mistake one-way disconnection for a hazard block", async () => {
    mocks.graph.mockReturnValue(graph(false, false, true));
    mocks.flood.mockResolvedValue(new Map([["road", "BLOCKED"]]));
    expect((await computeRoute(end, start, "car")).failureReason).toBeUndefined();
  });
  it("does not mistake access restrictions for a hazard block", async () => {
    mocks.graph.mockReturnValue(graph(true));
    mocks.flood.mockResolvedValue(new Map([["road", "BLOCKED"]]));
    expect((await computeRoute(start, end, "car")).failureReason).toBeUndefined();
  });
  it("returns a permitted alternative instead of offering assistance", async () => {
    mocks.graph.mockReturnValue(graph(false, true));
    mocks.flood.mockResolvedValue(new Map([["road", "BLOCKED"]]));
    const result = await computeRoute(start, end);
    expect(result.found).toBe(true); expect(result.failureReason).toBeUndefined();
  });
  it("does not treat out-of-network points as hazard blocks", async () => {
    expect((await computeRoute({ latitude: 0, longitude: 0 }, end)).failureReason).toBeUndefined();
  });
});
