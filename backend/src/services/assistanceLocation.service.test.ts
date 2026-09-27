import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ graph: vi.fn(), nearest: vi.fn() }));
vi.mock("./road.service", () => ({ loadRoadGraph: mocks.graph }));
import { createAssistanceLocationLookup } from "./assistanceLocation.service";

describe("private nearby-road labels", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.graph.mockReturnValue({ nearestRoads: mocks.nearest });
    mocks.nearest.mockReturnValue([{ roadName: "Sinalhan Road", distanceMeters: 18 }]);
  });
  it("returns an approximate road reference from the local graph", () => {
    expect(createAssistanceLocationLookup()(14.33, 121.11)).toEqual({ roadName: "Sinalhan Road", distanceMeters: 18 });
    expect(mocks.nearest).toHaveBeenCalledWith(14.33, 121.11, 1);
  });
  it.each([
    { roads: [] }, { roads: [{ distanceMeters: 8 }] },
    { roads: [{ roadName: "  ", distanceMeters: 8 }] },
    { roads: [{ roadName: "Far road", distanceMeters: 151 }] },
  ])("falls back when no nearby street name is available: %j", ({ roads }) => {
    mocks.nearest.mockReturnValue(roads);
    expect(createAssistanceLocationLookup()(14.33, 121.11)).toBeNull();
  });
  it("does not block shared records when the road file is missing", () => {
    mocks.graph.mockImplementation(() => { throw new Error("Missing graph"); });
    expect(createAssistanceLocationLookup()(14.33, 121.11)).toBeNull();
  });
  it("rejects absent and invalid coordinates without loading the graph", () => {
    const lookup = createAssistanceLocationLookup();
    expect(lookup(null, null)).toBeNull(); expect(lookup(NaN, 121)).toBeNull();
    expect(mocks.graph).not.toHaveBeenCalled();
  });
  it("deduplicates only within the current request, with no persistent private-location cache", () => {
    const lookup = createAssistanceLocationLookup();
    lookup(14.33, 121.11); lookup(14.33, 121.11);
    expect(mocks.nearest).toHaveBeenCalledTimes(1);
    createAssistanceLocationLookup()(14.33, 121.11);
    expect(mocks.nearest).toHaveBeenCalledTimes(2);
  });
});
