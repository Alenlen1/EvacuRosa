import { describe, expect, it } from "vitest";
import { RoadGraph, type RoadGraphData } from "./astar/graph";
import { calculateRoute, type RoutingSnapshot } from "./routing";
import { haversineMeters } from "./astar/heuristic";
import { loadRoadGraph } from "../services/road.service";

const empty: RoutingSnapshot = {
  statusOverrides: [],
  floodReports: [],
  fireIncidents: [],
  earthquakeImpacts: [],
};
const start = { id: "A", latitude: 14.3, longitude: 121.1 };
const destination = { id: "B", latitude: 14.31, longitude: 121.1 };
const approach = { id: "C", latitude: 14.3095, longitude: 121.1 };
const end = { id: "D", latitude: 14.3101, longitude: 121.1 };
function data(): RoadGraphData {
  return {
    nodes: [start, destination, approach, end],
    edges: [
      {
        id: "AC",
        roadId: "main",
        fromNodeId: "A",
        toNodeId: "C",
        distanceMeters: 1060,
        status: "OPEN",
      },
      {
        id: "BD",
        roadId: "island",
        fromNodeId: "B",
        toNodeId: "D",
        distanceMeters: 11,
        status: "OPEN",
      },
    ],
  };
}

describe("endpoint matching beside disconnected OSM roads", () => {
  it("uses a nearby connected road in either direction, without inventing a connector", () => {
    const graph = new RoadGraph(data());
    const offRoad = { ...destination, longitude: 121.1001 };
    for (const [from, to, warning] of [
      [start, offRoad, "ends"],
      [offRoad, start, "starts"],
    ] as const) {
      const result = calculateRoute(graph, from, to, "walking", empty);
      expect(result.found).toBe(true);
      expect(result.path).toEqual(
        (from === start ? [start, approach] : [approach, start]).map(
          ({ latitude, longitude }) => ({ latitude, longitude }),
        ),
      );
      expect(result.distanceMeters).toBe(1060);
      expect(result.warnings[0]).toContain(
        warning === "starts"
          ? "starts approximately 57 m"
          : "approximately 57 m off the mapped road",
      );
      expect(result.warnings[0]).toContain("not mapped or verified");
    }
  });

  it("does not call a missing connection to a mapped road an off-road approach", () => {
    const result = calculateRoute(
      new RoadGraph(data()),
      start,
      destination,
      "walking",
      empty,
    );
    expect(result.found).toBe(false);
    expect(result.destinationApproach).toBeUndefined();
  });

  it("never expands endpoint matching beyond 250 m", () => {
    const source = data();
    source.nodes[2] = { ...approach, latitude: 14.307 };
    expect(
      calculateRoute(
        new RoadGraph(source),
        start,
        destination,
        "walking",
        empty,
      ).found,
    ).toBe(false);
  });

  it("still excludes a blocked road after selecting the connected approach", () => {
    const result = calculateRoute(
      new RoadGraph(data()),
      start,
      { ...destination, longitude: 121.1001 },
      "walking",
      {
        ...empty,
        statusOverrides: [["main", "BLOCKED"]],
      },
    );
    expect(result.found).toBe(false);
    expect(result.failureReason).toBe("HAZARD_BLOCKED");
    expect(result.path).toEqual([]);
  });

  it.each([
    "hazard",
    "static closure",
    "private",
    "one-way",
    "mode restriction",
  ] as const)(
    "does not move endpoints past a %s within a connected source network",
    (restriction) => {
      const source = data();
      source.edges.push({
        id: "CB",
        roadId: "restricted",
        fromNodeId: "C",
        toNodeId: "B",
        distanceMeters: 56,
        status: restriction === "static closure" ? "BLOCKED" : "OPEN",
        ...(restriction === "private"
          ? { osmTags: { highway: "residential", access: "private" } }
          : {}),
        ...(restriction === "one-way"
          ? { osmTags: { highway: "footway", "oneway:foot": "-1" } }
          : {}),
        ...(restriction === "mode restriction"
          ? { allowedModes: ["car" as const] }
          : {}),
      });
      const snapshot: RoutingSnapshot =
        restriction === "hazard"
          ? { ...empty, statusOverrides: [["restricted", "BLOCKED"]] }
          : empty;
      expect(
        calculateRoute(
          new RoadGraph(source),
          start,
          destination,
          "walking",
          snapshot,
        ).found,
      ).toBe(false);
    },
  );

  it("does not move a valid endpoint when its original route works", () => {
    const graph = new RoadGraph(data());
    const result = calculateRoute(graph, destination, end, "walking", empty);
    expect(result.found).toBe(true);
    expect(result.distanceMeters).toBe(11);
    expect(result.warnings).toEqual([]);
  });

  it("finds a walking route to the connected Santo Domingo sidewalk in the shipped network", () => {
    const graph = loadRoadGraph();
    const target = { latitude: 14.2280625, longitude: 121.0480781 };
    const result = calculateRoute(
      graph,
      { latitude: 14.3301858, longitude: 121.1116907 },
      target,
      "walking",
      empty,
    );
    expect(result.found).toBe(true);
    expect(result.path.length).toBeGreaterThan(2);
    expect(result.path.at(-1)).toEqual({
      latitude: 14.227598,
      longitude: 121.048589,
    });
    const last = result.path.at(-1)!;
    expect(
      haversineMeters(
        last.latitude,
        last.longitude,
        target.latitude,
        target.longitude,
      ),
    ).toBeLessThan(80);
    expect(result.warnings).toContainEqual(
      expect.stringContaining("approximately 75 m off the mapped road"),
    );
  });
});

describe("destinations between road vertices", () => {
  const a = { id: "A", latitude: 14.3, longitude: 121.1 };
  const b = { id: "B", latitude: 14.301, longitude: 121.1 };
  const middle = { latitude: 14.3004, longitude: 121.1 };
  const graph = (oneway = false) =>
    new RoadGraph({
      nodes: [a, b],
      edges: [
        {
          id: "AB",
          roadId: "road",
          fromNodeId: "A",
          toNodeId: "B",
          distanceMeters: 111,
          status: "OPEN",
          osmTags: {
            highway: "residential",
            ...(oneway ? { oneway: "yes" } : {}),
          },
        },
      ],
    });
  it("ends on the road at the pin, with no unmapped approach or overshoot", () => {
    const result = calculateRoute(graph(), a, middle, "walking", empty);
    expect(result.found).toBe(true);
    expect(result.path.at(-1)?.latitude).toBeCloseTo(middle.latitude, 10);
    expect(result.path.at(-1)?.longitude).toBe(middle.longitude);
    expect(result.path).toHaveLength(2);
    expect(result.distanceMeters).toBe(44);
    expect(result.destinationApproach).toBeUndefined();
    expect(result.warnings).toEqual([]);
  });
  it("reports only the perpendicular off-road gap and excludes it from route distance", () => {
    const target = { ...middle, longitude: 121.1002 };
    const result = calculateRoute(graph(), a, target, "walking", empty);
    expect(result.path.at(-1)?.longitude).toBe(121.1);
    expect(result.path.at(-1)?.latitude).toBeCloseTo(middle.latitude, 10);
    expect(result.destinationApproach?.from).toEqual(result.path.at(-1));
    expect(result.destinationApproach?.to).toEqual(target);
    expect(result.destinationApproach?.distanceMeters).toBe(22);
    expect(result.distanceMeters).toBe(44);
  });
  it("selects the road under the pin even when a nearby side-road node is closer", () => {
    const source = graph().getData();
    source.nodes.push(
      { id: "C", latitude: 14.30045, longitude: 121.1001 },
      { id: "D", latitude: 14.30046, longitude: 121.1002 },
    );
    source.edges.push(
      {
        id: "CD",
        roadId: "side",
        fromNodeId: "C",
        toNodeId: "D",
        distanceMeters: 11,
        status: "OPEN",
      },
      {
        id: "CB",
        roadId: "bridge",
        fromNodeId: "C",
        toNodeId: "B",
        distanceMeters: 70,
        status: "OPEN",
      },
    );
    const result = calculateRoute(
      new RoadGraph(source),
      a,
      middle,
      "walking",
      empty,
    );
    expect(result.found).toBe(true);
    expect(result.path.at(-1)?.latitude).toBeCloseTo(middle.latitude, 10);
    expect(result.path.at(-1)?.longitude).toBe(middle.longitude);
    expect(result.distanceMeters).toBe(44);
    expect(result.destinationApproach).toBeUndefined();
  });
  it("keeps one-way restrictions when the destination is inside an edge", () => {
    expect(calculateRoute(graph(true), b, middle, "car", empty).found).toBe(
      false,
    );
    expect(calculateRoute(graph(true), a, middle, "car", empty).found).toBe(
      true,
    );
    expect(calculateRoute(graph(true), b, middle, "walking", empty).found).toBe(
      true,
    );
  });
  it("does not stop before a blocked section and call the rest an unmapped approach", () => {
    const result = calculateRoute(
      graph(),
      a,
      { latitude: 14.30045, longitude: 121.1 },
      "walking",
      {
        ...empty,
        floodReports: [
          {
            id: "flood",
            roadId: "road",
            severity: "HIGH",
            roadImpassable: true,
            status: "ACTIVE",
            reportedAt: "2026-10-31T00:00:00Z",
            updatedAt: "2026-10-31T00:00:00Z",
            edgeRanges: [
              { edgeId: "AB", startFraction: 0.3, endFraction: 0.6 },
            ],
          },
        ],
      },
    );
    expect(result.found).toBe(false);
    expect(result.failureReason).toBe("HAZARD_BLOCKED");
    expect(result.destinationApproach).toBeUndefined();
  });
});
