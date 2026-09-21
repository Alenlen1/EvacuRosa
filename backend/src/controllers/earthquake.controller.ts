import type { Request, Response } from "express";
import { getRecentEarthquakes, getVerifiedRoadImpacts } from "../services/earthquake.service";

export async function listEarthquakes(_req: Request, res: Response) {
  const [events, roadImpacts] = await Promise.all([
    getRecentEarthquakes(),
    getVerifiedRoadImpacts(),
  ]);
  res.json({ events, roadImpacts, updatedAt: new Date().toISOString() });
}
