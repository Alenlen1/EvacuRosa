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
    for (const [from, to, warning] of [
      [start, destination, "ends"],
      [destination, start, "starts"],
    ] as const) {
      const result = calculateRoute(graph, from, to, "walking", empty);
      expect(result.found).toBe(true);
      expect(result.path).toEqual(
        (from === start ? [start, approach] : [approach, start]).map(
          ({ latitude, longitude }) => ({ latitude, longitude }),
        ),
      );
      expect(result.distanceMeters).toBe(1060);
      expect(result.warnings[0]).toContain(`${warning} approximately 56 m`);
      expect(result.warnings[0]).toContain("not mapped or verified");
    }
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
      destination,
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
      expect.stringContaining("ends approximately 75 m"),
    );
  });
});
