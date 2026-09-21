import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import devFixture from "../data/santaRosaRoadGraph.dev.json";
import { RoadGraph } from "../algorithms/astar/graph";
import type { GraphEdge } from "../algorithms/astar/edge";
import type { GraphNode } from "../algorithms/astar/node";

let cachedGraph: RoadGraph | null = null;
let warned = false;

const REAL_GRAPH_PATH = path.join(__dirname, "..", "data", "santaRosaRoadGraph.json");

interface RawGraphFile {
  _meta?: { source?: string; fetchedAt?: string };
  _disclaimer?: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

/**
 * Prefers real OpenStreetMap data (santaRosaRoadGraph.json, produced by
 * scripts/fetch-santa-rosa-roads.ts) and falls back to the hand-built dev
 * fixture only when that file doesn't exist yet. Read at runtime rather
 * than imported statically so dropping the real file in and restarting is
 * all that's needed — no code change.
 */
export function loadRoadGraph(): RoadGraph {
  if (cachedGraph) return cachedGraph;

  let data: RawGraphFile;

  if (existsSync(REAL_GRAPH_PATH)) {
    data = JSON.parse(readFileSync(REAL_GRAPH_PATH, "utf-8")) as RawGraphFile;
    if (!warned) {
      const fetchedAt = data._meta?.fetchedAt ?? "unknown date";
      console.log(
        `[road-graph] Using real OpenStreetMap road data (${data.nodes.length} nodes, ${data.edges.length} edges, fetched ${fetchedAt}).`
      );
      warned = true;
    }
  } else {
    data = devFixture as unknown as RawGraphFile;
    if (!warned && data._disclaimer) {
      console.warn(`[road-graph] ${data._disclaimer}`);
      console.warn(
        "[road-graph] Run `npm run fetch:roads` to replace this with real OpenStreetMap data."
      );
      warned = true;
    }
  }

  cachedGraph = new RoadGraph({ nodes: data.nodes, edges: data.edges });
  return cachedGraph;
}
