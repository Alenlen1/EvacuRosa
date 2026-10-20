import { describe, expect, it } from "vitest";
import { RoadGraph } from "./astar/graph";
import { calculateRoute, type RoutingSnapshot } from "./routing";
import { TRAVEL_MODES } from "./astar/access";
import type { FloodReport } from "../types/flood";
import { floodStatusOverrides } from "../types/floodScope";

const start = { id: "A", latitude: 14.3, longitude: 121.1 };
const end = { id: "B", latitude: 14.301, longitude: 121.1 };
const detour = { id: "C", latitude: 14.3005, longitude: 121.1007 };
function graph(alternative = true) {
  return new RoadGraph({
    nodes: [start, end, detour],
    edges: [
      {
        id: "direct",
        roadId: "wet",
        fromNodeId: "A",
        toNodeId: "B",
        distanceMeters: 120,
        status: "OPEN",
      },
      ...(alternative
        ? [
            {
              id: "AC",
              roadId: "dry",
              fromNodeId: "A",
              toNodeId: "C",
              distanceMeters: 100,
              status: "OPEN" as const,
            },
            {
              id: "CB",
              roadId: "dry",
              fromNodeId: "C",
              toNodeId: "B",
              distanceMeters: 100,
              status: "OPEN" as const,
            },
          ]
        : []),
    ],
  });
}
function snapshot(
  severity: FloodReport["severity"],
  precise = false,
): RoutingSnapshot {
  const result: RoutingSnapshot = {
    floodReports: [
      {
        id: "flood",
        roadId: "wet",
        severity,
        // A stale flag must never make a HIGH/SEVERE flood passable.
        roadImpassable: false,
        status: "ACTIVE",
        reportedAt: "2026-10-20T00:00:00Z",
        updatedAt: "2026-10-20T00:00:00Z",
        ...(precise
          ? {
              edgeRanges: [
                { edgeId: "direct", startFraction: 0.3, endFraction: 0.7 },
              ],
            }
          : {}),
      },
    ],
    statusOverrides: [],
    fireIncidents: [],
    earthquakeImpacts: [],
  };
  result.statusOverrides = [...floodStatusOverrides(result.floodReports)];
  return result;
}
describe("A* and fuzzy flood safety together", () => {
  it.each(TRAVEL_MODES)(
    "excludes whole-road and partial HIGH/SEVERE floods in both directions for %s",
    (mode) => {
      for (const severity of ["HIGH", "SEVERE"] as const)
        for (const precise of [false, true])
          for (const [from, to] of [
            [start, end],
            [end, start],
          ]) {
            const result = calculateRoute(
              graph(),
              from,
              to,
              mode,
              snapshot(severity, precise),
            );
            expect(result.found).toBe(true);
            expect(result.path).toContainEqual({
              latitude: detour.latitude,
              longitude: detour.longitude,
            });
            expect(result.distanceMeters).toBe(200);
            const blocked = calculateRoute(
              graph(false),
              from,
              to,
              mode,
              snapshot(severity, precise),
            );
            expect(blocked.failureReason).toBe("HAZARD_BLOCKED");
            expect(blocked.path).toEqual([]);
          }
    },
  );
  it("lets fuzzy cost choose a longer dry route while keeping moderate floods traversable if necessary", () => {
    expect(
      calculateRoute(graph(), start, end, "walking", snapshot("NONE"))
        .distanceMeters,
    ).toBe(120);
    expect(
      calculateRoute(graph(), start, end, "walking", snapshot("MODERATE"))
        .distanceMeters,
    ).toBe(200);
    const onlyWet = calculateRoute(
      graph(false),
      start,
      end,
      "walking",
      snapshot("MODERATE"),
    );
    expect(onlyWet.found).toBe(true);
    expect(onlyWet.affectedRoads).toBe(1);
    expect(onlyWet.riskLevel).not.toBe("VERY_LOW");
  });
});
