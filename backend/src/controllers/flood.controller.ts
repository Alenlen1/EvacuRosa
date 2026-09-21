import type { Request, Response } from "express";
import { getActiveFloodReports } from "../services/flood.service";
import { loadRoadGraph } from "../services/road.service";

export async function listFloodReports(_req: Request, res: Response) {
  const reports = await getActiveFloodReports();
  const graph = loadRoadGraph();

  const enriched = reports.map((report) => {
    const edges = graph.edgesByRoadId(report.roadId);
    const affectedSegments = edges
      .map((edge) => {
        const from = graph.getNode(edge.fromNodeId);
        const to = graph.getNode(edge.toNodeId);
        if (!from || !to) return null;
        return [
          { latitude: from.latitude, longitude: from.longitude },
          { latitude: to.latitude, longitude: to.longitude },
        ];
      })
      .filter((s): s is NonNullable<typeof s> => s !== null);

    return { ...report, affectedSegments };
  });

  res.json({ reports: enriched, updatedAt: new Date().toISOString() });
}
