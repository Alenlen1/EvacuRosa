export type RoadStatus = "OPEN" | "FLOODED" | "DAMAGED" | "BLOCKED";
export type RoadCondition = "GOOD" | "FAIR" | "POOR";

export interface GraphEdge {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  roadId: string;
  roadName?: string;
  distanceMeters: number;
  status: RoadStatus;
  /** Physical pavement condition — deliberately separate from `status`.
   * A road can be OPEN and POOR at the same time. Defaults to GOOD where
   * unknown (never fabricate a worse condition than is actually reported). */
  condition?: RoadCondition;
  riskCost?: number;
}
