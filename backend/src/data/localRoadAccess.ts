import type { GraphEdge } from "../algorithms/astar/edge";

/** Local corrections reported by the project owner. Kept outside generated
 * OSM data so refreshes retain them. Recheck if OSM splits/replaces these ways. */
export const LOCAL_ROAD_ACCESS = {
  W319098748: {
    description: "School / Wet & Dry Market service lane between approximately 14.3167,121.1116 and 14.3152,121.1117",
    source: "Project owner supplied two map pins and reported walking-only access",
    tags: {
      foot: "yes",
      vehicle: "no",
      bicycle: "no",
      motor_vehicle: "no",
      motorcycle: "no",
      motorcar: "no",
    },
  },
} as const;

export function applyLocalRoadAccess(edges: GraphEdge[]): GraphEdge[] {
  return edges.map(edge => {
    const correction = LOCAL_ROAD_ACCESS[edge.roadId as keyof typeof LOCAL_ROAD_ACCESS];
    if (!correction) return edge;
    return { ...edge, osmTags: { ...edge.osmTags, ...correction.tags } };
  });
}
