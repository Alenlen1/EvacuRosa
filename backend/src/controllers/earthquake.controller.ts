import type { Request, Response } from "express";
import { loadRoadGraph } from "../services/road.service";
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
    affectedSegments: graph.edgesByRoadId(impact.roadId).flatMap((edge) => {
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
