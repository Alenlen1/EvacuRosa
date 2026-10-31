import type { RoadGraphData } from "./astar/graph";
import type { RoutingSnapshot } from "./routing";
import type { EvacuationCenter } from "../types/evacuation";

// Version 4 adds verified earthquake debris intervals. Older workers must not
// interpret snapshots without whole-road earthquake overrides as unrestricted.
export const OFFLINE_FORMAT = 4;
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
