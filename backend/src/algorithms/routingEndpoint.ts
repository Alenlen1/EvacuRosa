import type { RoadGraph } from "./astar/graph";
import type { GraphEdge } from "./astar/edge";
import type { GraphNode } from "./astar/node";
import type { TravelMode } from "./astar/access";
import { haversineMeters, toLocalMeters } from "./astar/heuristic";

/** Query-only destination on a mapped segment. No road graph is copied or
 * mutated, and both directional access rules and closure IDs are preserved. */
export function destinationOnRoad(
  graph: RoadGraph,
  nearest: GraphNode,
  point: { latitude: number; longitude: number },
  mode: TravelMode,
  component?: number,
) {
  let selected:
    { edge: GraphEdge; reverse?: GraphEdge; fraction: number } | undefined;
  let distance = haversineMeters(
    point.latitude,
    point.longitude,
    nearest.latitude,
    nearest.longitude,
  );
  const seen = new Set<string>();
  for (const candidate of graph.nearbyAccessibleNodes(
    point.latitude,
    point.longitude,
    mode,
  )) {
    if (
      component !== undefined &&
      graph.componentId(candidate.node.id) !== component
    )
      continue;
    for (const edge of graph.neighbors(candidate.node.id)) {
      const key = edge.id.endsWith("-r") ? edge.id.slice(0, -2) : edge.id;
      if (seen.has(key)) continue;
      seen.add(key);
      const from = graph.getNode(edge.fromNodeId)!;
      const other = graph.getNode(edge.toNodeId);
      if (!other) continue;
      const reverse = graph
        .neighbors(other.id)
        .find(
          (candidate) =>
            candidate.toNodeId === from.id &&
            candidate.roadId === edge.roadId &&
            (candidate.id === `${edge.id}-r` ||
              edge.id === `${candidate.id}-r`),
        );
      if (
        edge.allowedModes &&
        !edge.allowedModes.includes(mode) &&
        (!reverse ||
          (reverse.allowedModes && !reverse.allowedModes.includes(mode)))
      )
        continue;
      const a = toLocalMeters(
        from.latitude,
        from.longitude,
        point.latitude,
        point.longitude,
      );
      const b = toLocalMeters(
        other.latitude,
        other.longitude,
        point.latitude,
        point.longitude,
      );
      const dx = b.x - a.x,
        dy = b.y - a.y,
        length = dx * dx + dy * dy;
      const fraction = length
        ? Math.max(0, Math.min(1, -(a.x * dx + a.y * dy) / length))
        : 0;
      const gap = Math.hypot(a.x + dx * fraction, a.y + dy * fraction);
      if (gap < distance - 0.001) {
        distance = gap;
        selected = { edge, reverse, fraction };
      }
    }
  }
  const originalEdges = new Map<GraphEdge, GraphEdge>();
  const originalEdge = (edge: GraphEdge) => originalEdges.get(edge) ?? edge;
  if (!selected) return { graph, goal: nearest, anchor: nearest, originalEdge };
  const { edge, reverse, fraction } = selected;
  const from = graph.getNode(edge.fromNodeId)!;
  const other = graph.getNode(edge.toNodeId)!;
  if (fraction <= 1e-10)
    return { graph, goal: from, anchor: from, originalEdge };
  if (fraction >= 1 - 1e-10)
    return { graph, goal: other, anchor: other, originalEdge };
  const goal: GraphNode = {
    id: "route-query:destination",
    latitude: from.latitude + (other.latitude - from.latitude) * fraction,
    longitude: from.longitude + (other.longitude - from.longitude) * fraction,
  };
  const partial = (source: GraphEdge, ratio: number) => {
    const result = {
      ...source,
      toNodeId: goal.id,
      distanceMeters: source.distanceMeters * ratio,
    };
    originalEdges.set(result, source);
    return result;
  };
  const forward = partial(edge, fraction);
  const backward = reverse ? partial(reverse, 1 - fraction) : undefined;
  return {
    goal,
    anchor: from,
    originalEdge,
    graph: {
      getNode: (id: string) => (id === goal.id ? goal : graph.getNode(id)),
      neighbors: (id: string) => {
        const original = graph.neighbors(id);
        if (id === forward.fromNodeId) return [...original, forward];
        if (backward && id === backward.fromNodeId)
          return [...original, backward];
        return original;
      },
    },
  };
}
