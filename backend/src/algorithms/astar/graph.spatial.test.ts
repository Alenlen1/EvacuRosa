import { describe, expect, it } from "vitest";
import { RoadGraph } from "./graph";
import { TRAVEL_MODES, type TravelMode } from "./access";
import { haversineMeters } from "./heuristic";

function exhaustiveNearest(
  graph: RoadGraph,
  lat: number,
  lon: number,
  mode: TravelMode,
) {
  const eligible = new Set<string>();
  for (const node of graph.allNodes())
    for (const edge of graph.neighbors(node.id)) {
      if (
        edge.status === "BLOCKED" ||
        (edge.allowedModes && !edge.allowedModes.includes(mode))
      )
        continue;
      eligible.add(edge.fromNodeId);
      eligible.add(edge.toNodeId);
    }
  let best: string | null = null,
    distance = 250;
  for (const id of eligible) {
    const node = graph.getNode(id)!;
    const next = haversineMeters(lat, lon, node.latitude, node.longitude);
    if (next < distance) {
      best = id;
      distance = next;
    }
  }
  return best;
}

describe("indexed accessible road snapping", () => {
  it("matches exhaustive search across grid boundaries, modes and blocked edges", () => {
    const nodes = Array.from({ length: 120 }, (_, i) => ({
      id: `N${i}`,
      latitude: 14.29 + (i % 12) * 0.00113,
      longitude: 121.09 + Math.floor(i / 12) * 0.00107,
    }));
    const graph = new RoadGraph({
      nodes,
      edges: nodes.slice(1).map((node, i) => ({
        id: `E${i}`,
        roadId: `R${i}`,
        fromNodeId: nodes[i].id,
        toNodeId: node.id,
        distanceMeters: 150,
        status: i % 9 === 0 ? "BLOCKED" : "OPEN",
        oneway: i % 3 === 0,
        allowedModes: i % 4 === 0 ? ["walking"] : [...TRAVEL_MODES],
      })),
    });
    for (let i = 0; i < 60; i++) {
      const lat = 14.288 + (i % 13) * 0.00119;
      const lon = 121.088 + (i % 11) * 0.00117;
      for (const mode of TRAVEL_MODES)
        expect(graph.nearestAccessibleNode(lat, lon, mode)?.id ?? null).toBe(
          exhaustiveNearest(graph, lat, lon, mode),
        );
    }
    expect(graph.nearestAccessibleNode(0, 0, "car")).toBeNull();
  });
  it("handles the dateline and polar coordinates without an unbounded grid scan", () => {
    for (const [lat, lon, queryLon] of [
      [0, -179.9999, 179.9999],
      [89.9999, 15, 16],
    ]) {
      const graph = new RoadGraph({
        nodes: [
          { id: "A", latitude: lat, longitude: lon },
          { id: "B", latitude: lat, longitude: lon + 0.00001 },
        ],
        edges: [
          {
            id: "AB",
            roadId: "R",
            fromNodeId: "A",
            toNodeId: "B",
            distanceMeters: 1,
            status: "OPEN",
          },
        ],
      });
      expect(graph.nearestAccessibleNode(lat, queryLon, "car")?.id).toBe(
        exhaustiveNearest(graph, lat, queryLon, "car"),
      );
    }
  });
});
