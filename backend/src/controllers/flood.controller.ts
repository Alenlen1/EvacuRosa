import type { Request, Response } from "express";
import { getActiveFloodReports } from "../services/flood.service";
import { loadRoadGraph } from "../services/road.service";
import { pointOnEdge } from "../algorithms/floodSections";

export async function listFloodReports(_req: Request, res: Response) {
  const reports = await getActiveFloodReports();
  const graph = loadRoadGraph();

  const enriched = reports.map((report) => {
    const edges =
      report.affectedEdgeIds == null
        ? graph.edgesByRoadId(report.roadId)
        : report.affectedEdgeIds.flatMap((id) => {
            const edge = graph.getForwardEdge(id);
            return edge ? [edge] : [];
          });
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

    if (report.edgeRanges != null) {
      const byId = new Map(edges.map((edge) => [edge.id, edge]));
      return {
        ...report,
        affectedSegments: report.edgeRanges.flatMap((range) => {
          const edge = byId.get(range.edgeId);
          return edge
            ? [
                [
                  pointOnEdge(graph, edge, range.startFraction),
                  pointOnEdge(graph, edge, range.endFraction),
                ],
              ]
            : [];
        }),
      };
    }

    return { ...report, affectedSegments };
  });

  res.json({ reports: enriched, updatedAt: new Date().toISOString() });
}
