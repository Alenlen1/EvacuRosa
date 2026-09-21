import type { Request, Response } from "express";
import { getActiveFireIncidents } from "../services/fire.service";

export async function listFireIncidents(_req: Request, res: Response) {
  const incidents = await getActiveFireIncidents();
  res.json({ incidents, updatedAt: new Date().toISOString() });
}
