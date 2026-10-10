import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { RoadGraph } from "../algorithms/astar/graph";
import type { GraphEdge } from "../algorithms/astar/edge";
import type { GraphNode } from "../algorithms/astar/node";
import { applyLocalRoadAccess } from "../data/localRoadAccess";

let cachedGraph: RoadGraph | null = null;
let warned = false;

const REAL_GRAPH_PATH = path.join(
  __dirname,
  "..",
  "data",
  "santaRosaRoadGraph.json",
);

export interface RawGraphFile {
  _meta?: { source?: string; fetchedAt?: string; accessRulesVersion?: number };
  nodes: GraphNode[];
  edges: GraphEdge[];
}

/**
 * Loads real OpenStreetMap data (santaRosaRoadGraph.json, produced by
 * scripts/fetch-santa-rosa-roads.ts). It is read at runtime, so replacing
 * the generated file only requires a backend restart.
 */
let cachedData: RawGraphFile | null = null;

export function loadRoadGraphData(): RawGraphFile {
  if (cachedData) return cachedData;

  if (!existsSync(REAL_GRAPH_PATH)) {
    throw new Error(
      "OpenStreetMap road data is missing. Run `npm run fetch:roads --workspace=backend`.",
    );
  }

  const data = JSON.parse(
    readFileSync(REAL_GRAPH_PATH, "utf-8"),
  ) as RawGraphFile;
  if (
    data._meta?.accessRulesVersion !== 1 ||
    data.edges.some((edge) => !edge.osmTags?.highway)
  ) {
    throw new Error(
      "Road access data is outdated. Run `npm run fetch:roads --workspace=backend` and restart the backend.",
    );
  }
  if (!warned) {
    const fetchedAt = data._meta?.fetchedAt ?? "unknown date";
    console.log(
      `[road-graph] Using OpenStreetMap road data (${data.nodes.length} nodes, ${data.edges.length} edges, fetched ${fetchedAt}).`,
    );
    warned = true;
  }

  cachedData = { ...data, edges: applyLocalRoadAccess(data.edges) };
  return cachedData;
}

export function loadRoadGraph(): RoadGraph {
  if (!cachedGraph) cachedGraph = new RoadGraph(loadRoadGraphData());
  return cachedGraph;
}
