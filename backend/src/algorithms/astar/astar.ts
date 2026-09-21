import type { RoadGraph } from "./graph";
import type { GraphEdge, RoadStatus } from "./edge";
import { heuristic } from "./heuristic";

export interface AstarResult {
  found: boolean;
  nodeIds: string[];
  edges: GraphEdge[];
  /** Always the true physical distance of the path actually found, summed
   * from edge.distanceMeters — independent of whatever edgeCost function
   * was used to SELECT that path. A risk-weighted search can prefer a
   * longer path, but this field never lies about how long it actually is. */
  distanceMeters: number;
}

export interface FindPathOptions {
  /** Lets a hazard source (e.g. an active flood report) treat a road as
   * BLOCKED/FLOODED for this request without mutating the shared, cached
   * RoadGraph — keyed by roadId, checked in preference to the edge's own
   * baked-in status. */
  statusOverrides?: Map<string, RoadStatus>;
  /** Cost used for the actual pathfinding decision — g(n) accumulates this,
   * not necessarily raw distance. Defaults to plain distance (Phase 2/4
   * behavior) when omitted. Phase 6 passes a risk-weighted cost here so A*
   * can prefer a longer-but-safer road over a shorter-but-riskier one. */
  edgeCost?: (edge: GraphEdge) => number;
}

class MinHeap<T> {
  private heap: { key: number; value: T }[] = [];

  push(key: number, value: T) {
    this.heap.push({ key, value });
    this.bubbleUp(this.heap.length - 1);
  }

  pop(): T | undefined {
    if (this.heap.length === 0) return undefined;
    const top = this.heap[0];
    const last = this.heap.pop();
    if (this.heap.length > 0 && last) {
      this.heap[0] = last;
      this.bubbleDown(0);
    }
    return top.value;
  }

  get size() {
    return this.heap.length;
  }

  private bubbleUp(index: number) {
    while (index > 0) {
      const parent = (index - 1) >> 1;
      if (this.heap[parent].key <= this.heap[index].key) break;
      [this.heap[parent], this.heap[index]] = [this.heap[index], this.heap[parent]];
      index = parent;
    }
  }

  private bubbleDown(index: number) {
    const n = this.heap.length;
    while (true) {
      const left = index * 2 + 1;
      const right = index * 2 + 2;
      let smallest = index;
      if (left < n && this.heap[left].key < this.heap[smallest].key) smallest = left;
      if (right < n && this.heap[right].key < this.heap[smallest].key) smallest = right;
      if (smallest === index) break;
      [this.heap[smallest], this.heap[index]] = [this.heap[index], this.heap[smallest]];
      index = smallest;
    }
  }
}

/**
 * f(n) = g(n) + h(n). g(n) accumulates edgeCost (distance-only unless a
 * risk-weighted one is supplied — see FindPathOptions). BLOCKED edges are
 * excluded from traversal entirely: a hard constraint, never just a high
 * cost, regardless of what edgeCost would have charged for them.
 *
 * Note the heuristic stays pure straight-line distance even when edgeCost
 * is risk-weighted. That's required for A* to remain admissible: since
 * edgeCost >= distanceMeters always (risk only ever adds cost, never
 * subtracts it — see riskWeighting.service.ts), distance is still a valid
 * lower bound on the true remaining cost.
 */
export function findPath(
  graph: RoadGraph,
  startNodeId: string,
  goalNodeId: string,
  options?: FindPathOptions
): AstarResult {
  const statusOverrides = options?.statusOverrides;
  const edgeCost = options?.edgeCost ?? ((edge: GraphEdge) => edge.distanceMeters);

  if (startNodeId === goalNodeId) {
    return { found: true, nodeIds: [startNodeId], edges: [], distanceMeters: 0 };
  }

  const start = graph.getNode(startNodeId);
  const goal = graph.getNode(goalNodeId);
  if (!start || !goal) {
    return { found: false, nodeIds: [], edges: [], distanceMeters: 0 };
  }

  const effectiveStatus = (edge: GraphEdge): RoadStatus =>
    statusOverrides?.get(edge.roadId) ?? edge.status;

  const gScore = new Map<string, number>([[startNodeId, 0]]);
  const cameFrom = new Map<string, { nodeId: string; edge: GraphEdge }>();
  const visited = new Set<string>();

  const open = new MinHeap<string>();
  open.push(heuristic(start, goal), startNodeId);

  while (open.size > 0) {
    const currentId = open.pop();
    if (currentId === undefined) break;
    if (visited.has(currentId)) continue;
    visited.add(currentId);

    if (currentId === goalNodeId) {
      return buildResult(cameFrom, goalNodeId);
    }

    for (const edge of graph.neighbors(currentId)) {
      if (effectiveStatus(edge) === "BLOCKED") continue;
      if (visited.has(edge.toNodeId)) continue;

      const tentativeG = (gScore.get(currentId) ?? Infinity) + edgeCost(edge);
      if (tentativeG < (gScore.get(edge.toNodeId) ?? Infinity)) {
        gScore.set(edge.toNodeId, tentativeG);
        cameFrom.set(edge.toNodeId, { nodeId: currentId, edge });
        const toNode = graph.getNode(edge.toNodeId);
        const h = toNode ? heuristic(toNode, goal) : 0;
        open.push(tentativeG + h, edge.toNodeId);
      }
    }
  }

  return { found: false, nodeIds: [], edges: [], distanceMeters: 0 };
}

function buildResult(
  cameFrom: Map<string, { nodeId: string; edge: GraphEdge }>,
  goalNodeId: string
): AstarResult {
  const nodeIds: string[] = [goalNodeId];
  const edges: GraphEdge[] = [];
  let cursor = goalNodeId;

  while (cameFrom.has(cursor)) {
    const step = cameFrom.get(cursor);
    if (!step) break;
    edges.unshift(step.edge);
    nodeIds.unshift(step.nodeId);
    cursor = step.nodeId;
  }

  const distanceMeters = edges.reduce((sum, e) => sum + e.distanceMeters, 0);

  return { found: true, nodeIds, edges, distanceMeters };
}
