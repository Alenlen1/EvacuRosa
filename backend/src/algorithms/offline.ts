import type { RoadGraphData } from "./astar/graph";
import type { RoutingSnapshot } from "./routing";
import type { EvacuationCenter } from "../types/evacuation";

export const OFFLINE_FORMAT = 1;
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
