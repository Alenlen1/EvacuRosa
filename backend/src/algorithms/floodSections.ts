import type { RoadGraph } from "./astar/graph";
import type { GraphEdge } from "./astar/edge";
import { haversineMeters, toLocalMeters } from "./astar/heuristic";
import type { FloodEdgeRange } from "../types/flood";

export interface SectionPoint {
  latitude: number;
  longitude: number;
}

export function pointOnEdge(
  graph: RoadGraph,
  edge: GraphEdge,
  fraction: number,
): SectionPoint {
  const a = graph.getNode(edge.fromNodeId)!,
    b = graph.getNode(edge.toNodeId)!;
  return {
    latitude: a.latitude + (b.latitude - a.latitude) * fraction,
    longitude: a.longitude + (b.longitude - a.longitude) * fraction,
  };
}

/** Snap to the road line, retaining the exact position within each graph edge. */
export function selectFloodSection(
  graph: RoadGraph,
  roadId: string,
  start: SectionPoint,
  end: SectionPoint,
  roadAllowed: (roadId: string) => boolean = () => true,
) {
  const edges = graph
    .edgesForStreet(roadId)
    .filter((edge) => roadAllowed(edge.roadId));
  const nearest = (point: SectionPoint, candidates = edges) => {
    let best: { edge: GraphEdge; fraction: number } | undefined;
    let distance = 250;
    for (const edge of candidates) {
      const a = graph.getNode(edge.fromNodeId),
        b = graph.getNode(edge.toNodeId);
      if (!a || !b) continue;
      const localA = toLocalMeters(
        a.latitude,
        a.longitude,
        point.latitude,
        point.longitude,
      );
      const localB = toLocalMeters(
        b.latitude,
        b.longitude,
        point.latitude,
        point.longitude,
      );
      const dx = localB.x - localA.x,
        dy = localB.y - localA.y;
      const lengthSq = dx * dx + dy * dy;
      const fraction =
        Math.round(
          Math.max(
            0,
            Math.min(
              1,
              lengthSq ? -(localA.x * dx + localA.y * dy) / lengthSq : 0,
            ),
          ) * 1e12,
        ) / 1e12;
      const d = Math.hypot(localA.x + fraction * dx, localA.y + fraction * dy);
      if (d < distance) {
        best = { edge, fraction };
        distance = d;
      }
    }
    if (!best)
      throw new Error(
        "Select both endpoints within 250 m of the selected street. The end must follow the same named street.",
      );
    return best;
  };
  const first = nearest(
      start,
      edges.filter((edge) => edge.roadId === roadId),
    ),
    last = nearest(end);
  const snappedStart = pointOnEdge(graph, first.edge, first.fraction);
  const snappedEnd = pointOnEdge(graph, last.edge, last.fraction);
  if (
    haversineMeters(
      snappedStart.latitude,
      snappedStart.longitude,
      snappedEnd.latitude,
      snappedEnd.longitude,
    ) < 1
  )
    throw new Error(
      "Select start and end points at least 1 metre apart on the road.",
    );
  const pieces: { edge: GraphEdge; from: number; to: number }[] = [];
  if (first.edge.id === last.edge.id) {
    pieces.push({ edge: first.edge, from: first.fraction, to: last.fraction });
  } else {
    const adjacency = new Map<string, { next: string; edge: GraphEdge }[]>();
    for (const edge of edges) {
      if (edge.id === first.edge.id || edge.id === last.edge.id) continue;
      for (const [from, next] of [
        [edge.fromNodeId, edge.toNodeId],
        [edge.toNodeId, edge.fromNodeId],
      ]) {
        const items = adjacency.get(from) ?? [];
        items.push({ next, edge });
        adjacency.set(from, items);
      }
    }
    const distances = new Map([
      [first.edge.fromNodeId, first.fraction * first.edge.distanceMeters],
      [first.edge.toNodeId, (1 - first.fraction) * first.edge.distanceMeters],
    ]);
    const queue = [...distances.keys()];
    const previous = new Map<string, { node: string; edge: GraphEdge }>();
    const visited = new Set<string>();
    let goal: string | undefined;
    let bestCost = Infinity;
    while (queue.length) {
      queue.sort((a, b) => distances.get(b)! - distances.get(a)!);
      const node = queue.pop()!;
      if (visited.has(node)) continue;
      visited.add(node);
      const tail =
        node === last.edge.fromNodeId
          ? last.fraction
          : node === last.edge.toNodeId
            ? 1 - last.fraction
            : null;
      if (
        tail !== null &&
        distances.get(node)! + tail * last.edge.distanceMeters < bestCost
      ) {
        goal = node;
        bestCost = distances.get(node)! + tail * last.edge.distanceMeters;
      }
      for (const { next, edge } of adjacency.get(node) ?? []) {
        const cost = distances.get(node)! + edge.distanceMeters;
        if (cost < (distances.get(next) ?? Infinity)) {
          distances.set(next, cost);
          previous.set(next, { node, edge });
          queue.push(next);
        }
      }
    }
    if (goal === undefined)
      throw new Error(
        "These endpoints are on disconnected street sections. Select a connected section of the same street.",
      );
    const middle: { edge: GraphEdge; from: number; to: number }[] = [];
    let cursor: string = goal;
    while (previous.has(cursor)) {
      const step = previous.get(cursor)!;
      middle.push({
        edge: step.edge,
        from: step.edge.fromNodeId === step.node ? 0 : 1,
        to: step.edge.toNodeId === cursor ? 1 : 0,
      });
      cursor = step.node;
    }
    pieces.push(
      {
        edge: first.edge,
        from: first.fraction,
        to: cursor === first.edge.fromNodeId ? 0 : 1,
      },
      ...middle.reverse(),
      {
        edge: last.edge,
        from: goal === last.edge.fromNodeId ? 0 : 1,
        to: last.fraction,
      },
    );
  }
  const nonempty = pieces.filter(
    (piece) => Math.abs(piece.to - piece.from) > 1e-10,
  );
  const edgeRanges: FloodEdgeRange[] = nonempty.map(({ edge, from, to }) => ({
    edgeId: edge.id,
    startFraction: Math.min(from, to),
    endFraction: Math.max(from, to),
  }));
  return {
    snappedStart,
    snappedEnd,
    edgeRanges,
    edgeIds: edgeRanges.map((range) => range.edgeId),
    distanceMeters: Math.round(
      nonempty.reduce(
        (total, piece) =>
          total + piece.edge.distanceMeters * Math.abs(piece.to - piece.from),
        0,
      ),
    ),
    affectedSegments: nonempty.map(({ edge, from, to }) => [
      pointOnEdge(graph, edge, from),
      pointOnEdge(graph, edge, to),
    ]),
  };
}
