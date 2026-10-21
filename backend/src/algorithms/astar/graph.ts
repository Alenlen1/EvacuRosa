import type { GraphNode } from "./node";
import type { GraphEdge } from "./edge";
import { permittedModes, TRAVEL_MODES, type TravelMode } from "./access";
import { haversineMeters, distanceMetersToSegment } from "./heuristic";

export interface RoadGraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

/** Grid cell size for the nearest-node spatial index. ~0.005 degrees is
 * roughly 550m at this latitude — small enough that a typical cell holds a
 * manageable handful of nodes, large enough that the index doesn't become
 * mostly-empty overhead. */
const GRID_CELL_DEGREES = 0.005;
const modeBit = (mode: TravelMode) => 1 << TRAVEL_MODES.indexOf(mode);

const genericRoadNames = new Set([
  "residential",
  "service",
  "unclassified",
  "tertiary",
  "secondary",
  "primary",
  "trunk",
  "motorway",
  "living street",
  "footway",
  "path",
  "track",
  "pedestrian",
  "cycleway",
  "steps",
  "road",
  "unknown",
  "unnamed",
]);
function streetName(edge: GraphEdge): string | null {
  if (!edge.osmTags?.name && edge.roadName === edge.osmTags?.highway)
    return null;
  const name = (edge.osmTags?.name ?? edge.roadName ?? "")
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, " ");
  return name && !genericRoadNames.has(name) ? name : null;
}

/** Both geometrical directions are retained, with separate mode permissions. */
export class RoadGraph {
  private nodes = new Map<string, GraphNode>();
  private adjacency = new Map<string, GraphEdge[]>();
  /** Spatial index: grid cell key -> nodes in that cell. Built once at
   * construction so nearestNode doesn't scan every node in the graph —
   * with real OSM data that's tens of thousands of nodes, and evacuation
   * routing calls nearestNode repeatedly in a loop over candidate centers. */
  private grid = new Map<string, GraphNode[]>();
  /** roadId -> its forward-direction edges, so looking up a road's geometry
   * (for a flood/fire report) doesn't scan the whole adjacency structure. */
  private edgesByRoad = new Map<string, GraphEdge[]>();
  private forwardEdges = new Map<string, GraphEdge>();
  private edgesByStreetName = new Map<string, GraphEdge[]>();
  private nodeAccess = new Map<string, number>();
  // Access arrays are immutable within the graph. Thousands of segments share
  // the same few combinations, so retain one array per combination.
  private modeCombinations = new Map<number, TravelMode[]>();

  private shareModes(modes: TravelMode[] | undefined) {
    if (!modes) return undefined;
    const mask = modes.reduce((bits, mode) => bits | modeBit(mode), 0);
    const shared = this.modeCombinations.get(mask);
    if (shared) return shared;
    this.modeCombinations.set(mask, modes);
    return modes;
  }

  getForwardEdge(id: string): GraphEdge | undefined {
    return this.forwardEdges.get(id);
  }

  /** A named street can span several OSM way IDs. Connectivity is checked
   * by the section path search, so identical names never bridge gaps. */
  edgesForStreet(roadId: string): GraphEdge[] {
    const original = this.edgesByRoadId(roadId);
    const name = original.length ? streetName(original[0]) : null;
    return name ? (this.edgesByStreetName.get(name) ?? original) : original;
  }

  /** Forward-edge snapshot for immutable request-specific graph partitioning. */
  getData(): RoadGraphData {
    return {
      nodes: [...this.nodes.values()],
      edges: [...this.edgesByRoad.values()].flat(),
    };
  }

  constructor(data: RoadGraphData) {
    for (const node of data.nodes) {
      this.nodes.set(node.id, node);
      this.adjacency.set(node.id, []);
      const key = this.cellKey(node.latitude, node.longitude);
      const cell = this.grid.get(key);
      if (cell) cell.push(node);
      else this.grid.set(key, [node]);
    }
    for (const edge of data.edges) {
      this.addDirectedEdge({
        ...edge,
        allowedModes: this.shareModes(
          edge.osmTags
            ? permittedModes(edge.osmTags, false)
            : edge.allowedModes,
        ),
      });
      this.addDirectedEdge({
        ...edge,
        id: `${edge.id}-r`,
        fromNodeId: edge.toNodeId,
        toNodeId: edge.fromNodeId,
        allowedModes: this.shareModes(
          edge.osmTags
            ? permittedModes(edge.osmTags, true)
            : edge.oneway
              ? ["walking"]
              : edge.allowedModes,
        ),
      });
      const existing = this.edgesByRoad.get(edge.roadId);
      if (existing) existing.push(edge);
      else this.edgesByRoad.set(edge.roadId, [edge]);
      this.forwardEdges.set(edge.id, edge);
      const name = streetName(edge);
      if (name) {
        const streetEdges = this.edgesByStreetName.get(name) ?? [];
        streetEdges.push(edge);
        this.edgesByStreetName.set(name, streetEdges);
      }
    }
  }

  private cellKey(latitude: number, longitude: number): string {
    const row = Math.floor(latitude / GRID_CELL_DEGREES);
    const col = Math.floor(longitude / GRID_CELL_DEGREES);
    return `${row}:${col}`;
  }

  private addDirectedEdge(edge: GraphEdge) {
    const list = this.adjacency.get(edge.fromNodeId);
    if (!list) {
      throw new Error(
        `Edge ${edge.id} references unknown node ${edge.fromNodeId}`,
      );
    }
    list.push(edge);
    if (edge.status !== "BLOCKED") {
      let mask = 0;
      for (const mode of edge.allowedModes ?? TRAVEL_MODES)
        mask |= modeBit(mode);
      for (const id of [edge.fromNodeId, edge.toNodeId])
        this.nodeAccess.set(id, (this.nodeAccess.get(id) ?? 0) | mask);
    }
  }

  getNode(id: string): GraphNode | undefined {
    return this.nodes.get(id);
  }

  neighbors(nodeId: string): GraphEdge[] {
    return this.adjacency.get(nodeId) ?? [];
  }

  allNodes(): GraphNode[] {
    return [...this.nodes.values()];
  }

  /** Snap to the nearest endpoint on an accessible segment, including sinks.
   * Skipping a one-way sink would move the start upstream and bypass the rule. */
  nearestAccessibleNode(
    latitude: number,
    longitude: number,
    mode: TravelMode,
  ): GraphNode | null {
    let best: GraphNode | null = null;
    let bestDistance = 250; // Never silently snap across town to bypass access rules.
    // Conservative bounds around the 250 m search circle. Include incoming
    // endpoints via nodeAccess so one-way sinks remain valid destinations.
    const latDelta = 250 / 110_000;
    const cosLat = Math.cos(
      (Math.min(90, Math.abs(latitude) + latDelta) * Math.PI) / 180,
    );
    const lonDelta = latDelta / Math.max(cosLat, 0.000001);
    const mask = modeBit(mode);
    const candidates =
      lonDelta > 0.05 ||
      longitude - lonDelta < -180 ||
      longitude + lonDelta > 180
        ? this.nodes.values()
        : this.nodesInBounds(
            latitude - latDelta,
            latitude + latDelta,
            longitude - lonDelta,
            longitude + lonDelta,
          );
    for (const node of candidates) {
      if (!((this.nodeAccess.get(node.id) ?? 0) & mask)) continue;
      const distance = haversineMeters(
        latitude,
        longitude,
        node.latitude,
        node.longitude,
      );
      if (distance < bestDistance) {
        best = node;
        bestDistance = distance;
      }
    }
    return best;
  }

  private *nodesInBounds(
    minLat: number,
    maxLat: number,
    minLon: number,
    maxLon: number,
  ) {
    for (
      let row = Math.floor(minLat / GRID_CELL_DEGREES);
      row <= Math.floor(maxLat / GRID_CELL_DEGREES);
      row++
    )
      for (
        let col = Math.floor(minLon / GRID_CELL_DEGREES);
        col <= Math.floor(maxLon / GRID_CELL_DEGREES);
        col++
      )
        yield* this.grid.get(`${row}:${col}`) ?? [];
  }

  /** All (forward-direction) edges sharing a roadId — used to look up the
   * geometry of a road a flood/fire/etc. report refers to. */
  edgesByRoadId(roadId: string): GraphEdge[] {
    return this.edgesByRoad.get(roadId) ?? [];
  }

  /**
   * Snaps an arbitrary lat/lng (a GPS fix or a map click) onto the nearest
   * graph node, using the grid index. Searches an expanding ring of cells
   * and only stops once the ring's guaranteed minimum distance exceeds the
   * best match found so far — so it returns the true nearest node, not
   * merely a nearby one in the first non-empty cell.
   */
  nearestNode(latitude: number, longitude: number): GraphNode | null {
    if (this.nodes.size === 0) return null;

    const centerRow = Math.floor(latitude / GRID_CELL_DEGREES);
    const centerCol = Math.floor(longitude / GRID_CELL_DEGREES);

    let best: GraphNode | null = null;
    let bestDist = Infinity;

    // Cap the expansion so a point far outside the graph's coverage still
    // terminates rather than scanning outward forever.
    const maxRing = 200;

    for (let ring = 0; ring <= maxRing; ring++) {
      // Any node outside this ring is at least (ring) cells away, so once
      // that lower bound beats our best hit, no farther ring can improve it.
      if (best) {
        const minPossibleDegrees = (ring - 1) * GRID_CELL_DEGREES;
        const minPossibleMeters = minPossibleDegrees * 111_000;
        if (minPossibleMeters > bestDist) break;
      }

      let ringHadCells = false;
      for (let dRow = -ring; dRow <= ring; dRow++) {
        for (let dCol = -ring; dCol <= ring; dCol++) {
          // Only the outer shell of this ring — inner cells were covered
          // by previous iterations.
          if (ring > 0 && Math.abs(dRow) !== ring && Math.abs(dCol) !== ring) {
            continue;
          }
          const cell = this.grid.get(`${centerRow + dRow}:${centerCol + dCol}`);
          if (!cell) continue;
          ringHadCells = true;
          for (const node of cell) {
            const d = haversineMeters(
              latitude,
              longitude,
              node.latitude,
              node.longitude,
            );
            if (d < bestDist) {
              bestDist = d;
              best = node;
            }
          }
        }
      }

      // Nothing anywhere near: bail out to a full scan rather than crawling
      // outward one ring at a time (only happens for points well outside
      // the graph's coverage area).
      if (ring > 20 && !best && !ringHadCells) {
        return this.nearestNodeLinear(latitude, longitude);
      }
    }

    return best ?? this.nearestNodeLinear(latitude, longitude);
  }

  private nearestNodeLinear(
    latitude: number,
    longitude: number,
  ): GraphNode | null {
    let best: GraphNode | null = null;
    let bestDist = Infinity;
    for (const node of this.nodes.values()) {
      const d = haversineMeters(
        latitude,
        longitude,
        node.latitude,
        node.longitude,
      );
      if (d < bestDist) {
        bestDist = d;
        best = node;
      }
    }
    return best;
  }

  /**
   * Finds the roads closest to an arbitrary point — used by the admin map
   * tool so a click near a road can be turned into "you're reporting on
   * <road name>" rather than requiring someone to type a raw roadId. A
   * full scan over roads (not nodes) is fine here: this runs once per
   * admin click, not per A* edge expansion, so it doesn't need the grid
   * index nearestNode relies on for routing's hot path.
   */
  nearestRoads(
    latitude: number,
    longitude: number,
    limit = 5,
    includeRoad?: (roadId: string) => boolean,
  ): { roadId: string; roadName?: string; distanceMeters: number }[] {
    const results: {
      roadId: string;
      roadName?: string;
      distanceMeters: number;
    }[] = [];

    for (const [roadId, edges] of this.edgesByRoad) {
      if (includeRoad && !includeRoad(roadId)) continue;
      let minDist = Infinity;
      let roadName: string | undefined;
      for (const edge of edges) {
        const from = this.nodes.get(edge.fromNodeId);
        const to = this.nodes.get(edge.toNodeId);
        if (!from || !to) continue;
        const d = distanceMetersToSegment({ latitude, longitude }, from, to);
        if (d < minDist) minDist = d;
        if (edge.roadName) roadName = edge.roadName;
      }
      if (minDist < Infinity) {
        results.push({ roadId, roadName, distanceMeters: Math.round(minDist) });
      }
    }

    results.sort((a, b) => a.distanceMeters - b.distanceMeters);
    return results.slice(0, limit);
  }
}
