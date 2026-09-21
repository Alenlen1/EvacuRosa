import type { Request, Response } from "express";
import { getAllCenters } from "../services/evacuation.service";

export async function listEvacuationCenters(_req: Request, res: Response) {
  const centers = await getAllCenters();
  res.json({ centers, updatedAt: new Date().toISOString() });
}
