import type { RoadGraphData } from "./astar/graph";
import type { RoutingSnapshot } from "./routing";
import type { EvacuationCenter } from "../types/evacuation";

// Version 3 adds precise flood intervals and routing graph subdivision.
// Older workers must not interpret these as unrestricted roads.
export const OFFLINE_FORMAT = 3;
export interface OfflineSnapshot extends RoutingSnapshot {
  formatVersion: number;
  graphVersion: string;
  updatedAt: string;
  hazardsAvailable: boolean;
  centers: EvacuationCenter[];
}
export interface OfflineGraph {
  version: string;
  data: RoadGraphData;
}
export interface OfflinePackage {
  graph: OfflineGraph;
  snapshot: OfflineSnapshot;
}
