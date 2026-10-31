import type { Request, Response } from "express";
import { loadRoadGraph } from "../services/road.service";
import { pointOnEdge } from "../algorithms/floodSections";
import {
  getRecentEarthquakes,
  getVerifiedRoadImpacts,
} from "../services/earthquake.service";

export async function listEarthquakes(_req: Request, res: Response) {
  const [events, roadImpacts] = await Promise.all([
    getRecentEarthquakes(),
    getVerifiedRoadImpacts(),
  ]);
  const graph = loadRoadGraph();
  const enriched = roadImpacts.map((impact) => ({
    ...impact,
    affectedSegments:
      impact.edgeRanges != null
        ? impact.edgeRanges.map((range) => {
            const edge = graph.getForwardEdge(range.edgeId);
            if (!edge || edge.roadId !== impact.roadId)
              throw new Error(
                "Saved earthquake section does not match the road network.",
              );
            return [
              pointOnEdge(graph, edge, range.startFraction),
              pointOnEdge(graph, edge, range.endFraction),
            ];
          })
        : graph
            .edgesByRoadId(impact.roadId)
            .filter(
              (edge) =>
                impact.affectedEdgeIds == null ||
                impact.affectedEdgeIds.includes(edge.id),
            )
            .flatMap((edge) => {
              const from = graph.getNode(edge.fromNodeId);
              const to = graph.getNode(edge.toNodeId);
              return from && to
                ? [
                    [
                      { latitude: from.latitude, longitude: from.longitude },
                      { latitude: to.latitude, longitude: to.longitude },
                    ],
                  ]
                : [];
            }),
  }));
  res.json({
    events,
    roadImpacts: enriched,
    updatedAt: new Date().toISOString(),
  });
}
