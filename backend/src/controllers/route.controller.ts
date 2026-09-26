import type { Request, Response } from "express";
import { computeRoute } from "../services/routing.service";
import { isTravelMode } from "../algorithms/astar/access";

function isValidPoint(
  value: unknown
): value is { latitude: number; longitude: number } {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.latitude === "number" && typeof v.longitude === "number";
}

export async function postRoute(req: Request, res: Response) {
  const { start, destination, travelMode = "walking" } = req.body ?? {};
  if (!isTravelMode(travelMode)) {
    res.status(400).json({ error: "Invalid travelMode. Use walking, biking, motorcycle, or car." });
    return;
  }

  if (!isValidPoint(start) || !isValidPoint(destination)) {
    res.status(400).json({
      error:
        "Request body must include start and destination, each with numeric latitude and longitude.",
    });
    return;
  }

  const result = await computeRoute(start, destination, travelMode);

  if (!result.found) {
    res.status(422).json({ route: [], warnings: result.warnings, failureReason: result.failureReason });
    return;
  }

  // riskLevel now reflects real fuzzy-logic inference over active flood
  // reports and road condition — see routing.service.ts.
  res.json({
    route: result.path,
    travelMode,
    distance: result.distanceMeters,
    affectedRoads: result.affectedRoads,
    warnings: result.warnings,
    riskLevel: result.riskLevel,
    updatedAt: new Date().toISOString(),
  });
}
