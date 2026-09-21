import type { Request, Response } from "express";
import { loadRoadGraph } from "../services/road.service";

export function getNearestRoads(req: Request, res: Response) {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  const limit = req.query.limit ? Number(req.query.limit) : 5;

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    res.status(400).json({
      error: "Query params lat and lng are required and must be numbers.",
    });
    return;
  }

  const graph = loadRoadGraph();
  const roads = graph.nearestRoads(lat, lng, Number.isFinite(limit) ? limit : 5);
  res.json({ roads });
}
