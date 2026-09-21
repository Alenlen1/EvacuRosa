import { describe, expect, it } from "vitest";
import { edgeRisk, RISK_WEIGHT } from "./riskWeighting.service";
import { RoadGraph } from "../algorithms/astar/graph";
import type { GraphEdge } from "../algorithms/astar/edge";
import type { FloodReport } from "../types/flood";
import type { FireIncident } from "../types/fire";

function makeEdge(overrides: Partial<GraphEdge> = {}): GraphEdge {
  return {
    id: "E1",
    fromNodeId: "A",
    toNodeId: "B",
    roadId: "R1",
    distanceMeters: 1000,
    status: "OPEN",
    condition: "GOOD",
    ...overrides,
  };
}

function makeGraph(edge: GraphEdge) {
  return new RoadGraph({
    nodes: [
      { id: edge.fromNodeId, latitude: 14.3, longitude: 121.1 },
      { id: edge.toNodeId, latitude: 14.301, longitude: 121.1 },
    ],
    edges: [edge],
  });
}

function makeFloodReport(overrides: Partial<FloodReport> = {}): FloodReport {
  return {
    id: "f1",
    roadId: "R1",
    severity: "SEVERE",
    roadImpassable: false,
    status: "ACTIVE",
    reportedAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeFireIncident(overrides: Partial<FireIncident> = {}): FireIncident {
  return {
    id: "fire1",
    latitude: 14.3,
    longitude: 121.1,
    severity: "HIGH",
    radiusMeters: 200,
    status: "ACTIVE",
    confirmedBlockedRoadIds: [],
    reportedAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("edgeRisk", () => {
  it("charges no extra cost for a clean, GOOD-condition road with no hazards nearby", () => {
    const edge = makeEdge();
    const { cost, risk } = edgeRisk(edge, makeGraph(edge), new Map(), []);
    expect(risk.riskLevel).toBe("VERY_LOW");
    expect(cost).toBeCloseTo(1000);
  });

  it("charges meaningfully more for a severely flooded (but passable) road", () => {
    const edge = makeEdge();
    const floodByRoadId = new Map([["R1", makeFloodReport()]]);
    const { cost, risk } = edgeRisk(edge, makeGraph(edge), floodByRoadId, []);
    expect(risk.riskLevel).toBe("VERY_HIGH");
    expect(cost).toBeCloseTo(1000 * (1 + RISK_WEIGHT));
  });

  it("never charges less than the road's real physical distance", () => {
    const edge = makeEdge();
    const { cost } = edgeRisk(edge, makeGraph(edge), new Map(), []);
    expect(cost).toBeGreaterThanOrEqual(1000);
  });

  it("charges more for POOR condition even with no flood report or fire at all", () => {
    const goodEdge = makeEdge({ condition: "GOOD" });
    const poorEdge = makeEdge({ condition: "POOR" });
    const clean = edgeRisk(goodEdge, makeGraph(goodEdge), new Map(), []);
    const poor = edgeRisk(poorEdge, makeGraph(poorEdge), new Map(), []);
    expect(poor.cost).toBeGreaterThan(clean.cost);
  });

  it("raises risk for a road whose midpoint sits inside an active fire's radius", () => {
    const edge = makeEdge(); // midpoint is essentially at the node coordinates, ~0m from (14.3, 121.1)
    const fireIncidents = [makeFireIncident()]; // centered right on this edge
    const { cost, risk } = edgeRisk(edge, makeGraph(edge), new Map(), fireIncidents);
    expect(risk.riskLevel).not.toBe("VERY_LOW");
    expect(cost).toBeGreaterThan(1000);
  });

  it("does not raise risk for a road far outside any fire's influence radius", () => {
    const edge = makeEdge();
    const farFire = makeFireIncident({ latitude: 15.0, longitude: 122.0, radiusMeters: 200 });
    const { risk } = edgeRisk(edge, makeGraph(edge), new Map(), [farFire]);
    expect(risk.riskLevel).toBe("VERY_LOW");
  });

  it("takes the worst of two overlapping fires, not their sum", () => {
    const edge = makeEdge();
    const graph = makeGraph(edge);
    const oneModerate = edgeRisk(edge, graph, new Map(), [
      makeFireIncident({ severity: "MODERATE" }),
    ]);
    const twoModerate = edgeRisk(edge, graph, new Map(), [
      makeFireIncident({ id: "fireA", severity: "MODERATE" }),
      makeFireIncident({ id: "fireB", severity: "MODERATE" }),
    ]);
    expect(twoModerate.risk.riskScore).toBeCloseTo(oneModerate.risk.riskScore);
  });

  it("detects a fire near one endpoint of a LONG edge, not just near its midpoint", () => {
    // Regression test: proximity used to be sampled at the edge's midpoint
    // only, which missed a fire sitting right on one endpoint of a long
    // edge. The graph nodes here are ~1.3km apart (a realistic road
    // segment length) with the fire essentially on top of node B.
    const longEdge = makeEdge({ distanceMeters: 1300 });
    const graph = new RoadGraph({
      nodes: [
        { id: "A", latitude: 14.3005, longitude: 121.112 },
        { id: "B", latitude: 14.298, longitude: 121.105 },
      ],
      edges: [longEdge],
    });
    const fireAtEndpointB = makeFireIncident({
      latitude: 14.298,
      longitude: 121.105,
      radiusMeters: 250,
    });
    const { risk } = edgeRisk(longEdge, graph, new Map(), [fireAtEndpointB]);
    expect(risk.riskLevel).not.toBe("VERY_LOW");
  });

  it("ignores earthquake magnitude/proximity entirely with no verified impact record", () => {
    // Section 31's strictest rule: unlike fire, there is no automatic
    // geometric computation for earthquakes at all. An empty impact map
    // (the correct state for an unreviewed or no-impact-found event) must
    // produce zero earthquake-driven risk, however severe the event was.
    const edge = makeEdge();
    const { risk } = edgeRisk(edge, makeGraph(edge), new Map(), [], new Map());
    expect(risk.riskLevel).toBe("VERY_LOW");
  });

  it("raises risk once a verified earthquake impact exists for that road", () => {
    const edge = makeEdge({ roadId: "R-DJ-1" });
    const verified = new Map([["R-DJ-1", 3]]); // HIGH verified impact
    const { risk } = edgeRisk(edge, makeGraph(edge), new Map(), [], verified);
    expect(risk.riskLevel).not.toBe("VERY_LOW");
  });
});
