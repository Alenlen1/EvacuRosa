import type { Request, Response } from "express";
import { computeEvacuationRoute } from "../services/evacuationRouting.service";
import { isTravelMode } from "../algorithms/astar/access";

function isValidPoint(value: unknown): value is { latitude: number; longitude: number } {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.latitude === "number" && typeof v.longitude === "number";
}

export async function postEvacuationRoute(req: Request, res: Response) {
  const { start, travelMode = "walking" } = req.body ?? {};
  if (!isTravelMode(travelMode)) {
    res.status(400).json({ error: "Invalid travelMode. Use walking, biking, motorcycle, or car." });
    return;
  }
  if (!isValidPoint(start)) {
    res.status(400).json({
      error: "Request body must include start with numeric latitude and longitude.",
    });
    return;
  }

  const result = await computeEvacuationRoute(start, travelMode);

  if (!result.found) {
    res.status(422).json({ warnings: result.warnings, failureReason: result.failureReason });
    return;
  }

  // riskLevel now reflects real fuzzy-logic inference — see the ranking
  // note in evacuationRouting.service.ts.
  res.json({
    recommendedCenter: result.recommendedCenter,
    route: result.route,
    travelMode,
    distance: result.distanceMeters,
    riskLevel: result.riskLevel,
    warnings: result.warnings,
    lastUpdated: new Date().toISOString(),
  });
}
