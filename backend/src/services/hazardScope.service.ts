import type { RoadGraph } from "../algorithms/astar/graph";
import { isSantaRosaSegment } from "../geography/santaRosa";

const scopeCache = new WeakMap<RoadGraph, Map<string, boolean>>();

/** Reports affect a whole roadId, so a road crossing the border is excluded. */
export function isSantaRosaRoad(graph: RoadGraph, roadId: string): boolean {
  let cache = scopeCache.get(graph);
  if (!cache) {
    cache = new Map();
    scopeCache.set(graph, cache);
  }
  const cached = cache.get(roadId);
  if (cached !== undefined) return cached;
  const edges = graph.edgesByRoadId(roadId);
  const allowed =
    edges.length > 0 &&
    edges.every((edge) => {
      const from = graph.getNode(edge.fromNodeId),
        to = graph.getNode(edge.toNodeId);
      return !!from && !!to && isSantaRosaSegment(from, to);
    });
  cache.set(roadId, allowed);
  return allowed;
}
